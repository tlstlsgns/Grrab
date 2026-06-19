import * as ort from './vendor/ort.webgpu.bundle.min.mjs';

ort.env.wasm.wasmPaths = new URL('./vendor/', import.meta.url).href;
ort.env.wasm.numThreads = Math.min(8, (self.navigator && navigator.hardwareConcurrency) || 1); // PHASE_CLIP_SIZE_MT

const SR_MODEL_PATH = 'vendor/models/realesr-general-x4v3.onnx';
const SR_SCALE = 4;
// SR input width cap = max((targetWidth / SR_SCALE) * SR_INPUT_HEADROOM, SR_INPUT_MIN_CAP_W).
// SR_INPUT_HEADROOM: 1.0 = fastest (model's native 4x point, input≈target/4);
// raise to 1.5–2.0 for more detail (slower).
const SR_INPUT_HEADROOM = 1.5;
// Absolute floor for the SR input width. Without this, small targets (e.g. 512)
// would yield a tiny formula cap (target/4 * 1.5 = 192 for 512), forcing modest
// sources like 284px to be pre-downscaled to 192px and badly damaging quality —
// the SR model can't recover detail that was discarded before inference. The
// floor ensures small/medium sources reach the SR at full size; only sources
// larger than SR_INPUT_MIN_CAP_W are pre-downscaled, and only down to this
// floor. 384 = the established quality/speed sweet spot (~1s inference).
const SR_INPUT_MIN_CAP_W = 384;

let _srSession = null;
let _srProviders = null;

async function _createSrSession() {
  const buf = await (await fetch(chrome.runtime.getURL(SR_MODEL_PATH))).arrayBuffer();
  // realesr-general-x4v3 has dynamic output shapes that the WebGPU EP mishandles
  // ("Shape mismatch attempting to re-use buffer"); WASM runs it correctly.
  const s = await ort.InferenceSession.create(buf, {
    executionProviders: ['wasm'], graphOptimizationLevel: 'all',
  });
  _srProviders = 'wasm';
  return s;
}

export async function getSrSession() {
  if (_srSession) return _srSession;
  _srSession = await _createSrSession();
  try {
    console.log('[KICKCLIP-LOG] SR session ready', {
      providers: _srProviders,
      inputs: _srSession.inputNames,
      outputs: _srSession.outputNames,
    });
  } catch (_) {}
  return _srSession;
}

export async function warmUpSr() {
  try { await getSrSession(); } catch (_) {}
}

// RGB float32 NCHW [1,3,H,W], 0-1 (this export is channels-first; pixel/255, no mean/std).
function _bitmapToInputTensor(bitmap) {
  const w = bitmap.width, h = bitmap.height;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  // PHASE_CLIP_SIZE_ALPHA: composite over white before reading RGB. The model
  // is RGB-only; transparent pixels would otherwise read as (0,0,0) black and
  // the SR pass sharpens that black/content boundary into splatter artifacts
  // (and bleeds black into soft shadows). Flattening onto white keeps the SR
  // input clean; the source alpha is reapplied to the output separately (see
  // _reapplySourceAlpha). Fully opaque images are unaffected (white is covered).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h); // RGBA uint8
  const plane = w * h;
  const out = new Float32Array(3 * plane); // planar RGB (channels-first)
  for (let i = 0; i < plane; i++) {
    out[i]             = data[i * 4]     / 255;
    out[plane + i]     = data[i * 4 + 1] / 255;
    out[2 * plane + i] = data[i * 4 + 2] / 255;
  }
  return { tensor: new ort.Tensor('float32', out, [1, 3, h, w]), w, h };
}

// Output [1,3,4H,4W] float32 0-1 (channels-first) → PNG blob.
async function _outputTensorToBlob(out) {
  const dims = out.dims;            // [1,3,H,W] NCHW
  const oH = dims[2], oW = dims[3];
  const od = out.data;
  const plane = oW * oH;
  const canvas = new OffscreenCanvas(oW, oH);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(oW, oH);
  for (let i = 0; i < plane; i++) {
    img.data[i * 4]     = Math.max(0, Math.min(255, Math.round(od[i] * 255)));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(od[plane + i] * 255)));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(od[2 * plane + i] * 255)));
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return await canvas.convertToBlob({ type: 'image/png' });
}

// 4x upscale a PNG/image blob. Returns a 4x PNG blob, or null on failure.
export async function superResolveBlob(blob) {
  try {
    const session = await getSrSession();
    const bitmap = await createImageBitmap(blob);
    const { tensor } = _bitmapToInputTensor(bitmap);
    bitmap.close?.();
    const res = await session.run({ [session.inputNames[0]]: tensor });
    return await _outputTensorToBlob(res[session.outputNames[0]]);
  } catch (e) {
    console.log('[KICKCLIP-LOG] SR failed', e);
    return null;
  }
}

// Fit a blob to an exact target WIDTH (preserve aspect). Downscale if larger,
// interpolate up if smaller (high-quality). Used after 4x SR to hit the target.
async function _fitBlobToWidth(blob, targetWidth) {
  const bmp = await createImageBitmap(blob);
  const sw = bmp.width || 1, sh = bmp.height || 1;
  if (sw === targetWidth) { bmp.close?.(); return blob; }
  const scale = targetWidth / sw;
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  const canvas = new OffscreenCanvas(dw, dh);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, dw, dh);
  bmp.close?.();
  return await canvas.convertToBlob({ type: 'image/png' });
}

// PHASE_CLIP_SIZE_ALPHA: reapply the source image's alpha onto the (opaque) SR
// output so transparency and soft shadows survive the SR pass. The SR model is
// RGB-only and forces output alpha=255; with the white-composite at input, a
// transparent PNG would otherwise come out opaque on white. The source alpha is
// bilinearly upscaled to the SR output size and written into the output's alpha
// channel. Fully opaque sources are detected and returned unchanged.
async function _reapplySourceAlpha(srBlob, sourceBlob) {
  try {
    const [srBmp, srcBmp] = await Promise.all([
      createImageBitmap(srBlob),
      createImageBitmap(sourceBlob),
    ]);
    const w = srBmp.width, h = srBmp.height;

    // Upscale the source alpha to the SR output size (bilinear via drawImage).
    const aCanvas = new OffscreenCanvas(w, h);
    const aCtx = aCanvas.getContext('2d');
    aCtx.imageSmoothingEnabled = true;
    aCtx.imageSmoothingQuality = 'high';
    aCtx.drawImage(srcBmp, 0, 0, w, h);
    srcBmp.close?.();
    const srcData = aCtx.getImageData(0, 0, w, h).data;

    // Fully opaque source → nothing to restore; keep the SR output as-is.
    let hasTransparency = false;
    for (let i = 3; i < srcData.length; i += 4) {
      if (srcData[i] !== 255) { hasTransparency = true; break; }
    }
    if (!hasTransparency) { srBmp.close?.(); return srBlob; }

    // Overwrite the SR output's alpha channel with the upscaled source alpha.
    const oCanvas = new OffscreenCanvas(w, h);
    const oCtx = oCanvas.getContext('2d');
    oCtx.drawImage(srBmp, 0, 0, w, h);
    srBmp.close?.();
    const outImg = oCtx.getImageData(0, 0, w, h);
    const od = outImg.data;
    for (let i = 3; i < od.length; i += 4) od[i] = srcData[i];
    oCtx.putImageData(outImg, 0, 0);
    return await oCanvas.convertToBlob({ type: 'image/png' });
  } catch (_) {
    return srBlob; // on any failure, keep the SR output unchanged
  }
}

// SR (4x) then fit to exact target WIDTH. Returns PNG blob, or null on failure.
export async function superResolveToWidth(blob, targetWidth) {
  try {
    // Cap SR input near the 4x model's native point to cut compute ~ (srcW/capW)^2.
    // Only DOWNSCALE the input (never upscale before SR — that would feed a blurry image).
    let input = blob;
    if (targetWidth && targetWidth > 0) {
      const capW = Math.max(
        Math.ceil((targetWidth / SR_SCALE) * SR_INPUT_HEADROOM),
        SR_INPUT_MIN_CAP_W
      );
      const bmp = await createImageBitmap(blob);
      const sw = bmp.width || 1; bmp.close?.();
      if (sw > capW) input = await _fitBlobToWidth(blob, capW);
    }
    const up = await superResolveBlob(input);
    if (!up) return null;
    // PHASE_CLIP_SIZE_ALPHA: restore the original alpha onto the opaque SR
    // output (no-op for opaque sources) so transparency + soft shadows survive.
    if (!targetWidth || targetWidth <= 0) return await _reapplySourceAlpha(up, blob);
    const fitted = await _fitBlobToWidth(up, targetWidth);
    return await _reapplySourceAlpha(fitted, blob);
  } catch (e) {
    console.log('[KICKCLIP-LOG] SR-to-width failed', e);
    return null;
  }
}

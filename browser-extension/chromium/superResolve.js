import * as ort from './vendor/ort.webgpu.bundle.min.mjs';

ort.env.wasm.wasmPaths = new URL('./vendor/', import.meta.url).href;
ort.env.wasm.numThreads = Math.min(8, (self.navigator && navigator.hardwareConcurrency) || 1); // PHASE_CLIP_SIZE_MT

const SR_MODEL_PATH = 'vendor/models/realesr-general-x4v3.onnx';
const SR_SCALE = 4;
// Ceiling on pixels handed to the model. Measured end to end through this function in the
// offscreen document on WebGPU: 200k took 4.2s, 400k 6.0s, 500k 7.5s and 700k 11.3s. A
// real clip adds about 1.5s for encoding and the message round trip, against a ten-second
// timeout — so 400k lands near 7.5s with room for a slow moment.
//
// Inference is only part of it. At 400k input the model returns a 9.6-megapixel image,
// which is then resized to the clip width and composited with the source alpha; that
// canvas work costs about as much as the inference.
//
// WASM is roughly three times slower throughout, so its ceiling is set well below a
// third of the WebGPU one. It has not been measured at these sizes directly — a clip at
// 200k took 9.1 seconds, which left almost no margin, and 150k is the conservative
// response. Worth measuring properly if anyone reports failures without a GPU.
const SR_MAX_PIXELS_WEBGPU = 400000;
const SR_MAX_PIXELS_WASM = 150000;

let _srSession = null;
let _srProviders = null;
let _srForceWasm = false;

async function _createSrSession() {
  const buf = await (await fetch(chrome.runtime.getURL(SR_MODEL_PATH))).arrayBuffer();
  // WebGPU is roughly three times faster than WASM on this model, measured in the
  // offscreen document across every input size the clip path produces. It failed until
  // the model's output dimensions were renamed: the export declared them with the same
  // symbols as the input, so the EP tried to reuse a buffer a quarter of the size it
  // needed. Anything without WebGPU falls through to WASM, which is slower but correct.
  if (!_srForceWasm && typeof navigator !== 'undefined' && navigator.gpu) {
    try {
      const s = await ort.InferenceSession.create(buf, {
        executionProviders: ['webgpu'], graphOptimizationLevel: 'all',
      });
      _srProviders = 'webgpu';
      return s;
    } catch (e) {
      console.log('[KICKCLIP-LOG] SR webgpu unavailable, using wasm', String(e && e.message || e));
    }
  }
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

export async function getSrMaxPixels() {
  await getSrSession();
  return _srProviders === 'webgpu' ? SR_MAX_PIXELS_WEBGPU : SR_MAX_PIXELS_WASM;
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
    let session = await getSrSession();
    const bitmap = await createImageBitmap(blob);
    const { tensor } = _bitmapToInputTensor(bitmap);
    bitmap.close?.();
    let res;
    try {
      res = await session.run({ [session.inputNames[0]]: tensor });
    } catch (runErr) {
      if (_srProviders === 'webgpu') {
        console.log('[KICKCLIP-LOG] SR webgpu run failed, retrying wasm', String(runErr && runErr.message || runErr));
        _srSession = null;
        _srForceWasm = true;
        session = await getSrSession();
        res = await session.run({ [session.inputNames[0]]: tensor });
      } else {
        throw runErr;
      }
    }
    const outTensor = res[session.outputNames[0]];
    const outBlob = await _outputTensorToBlob(outTensor);
    return outBlob;
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

// Fit SR output to target width and restore source alpha in one canvas pass.
async function _fitAndRestoreAlpha(srBlob, sourceBlob, targetWidth) {
  const srBmp = await createImageBitmap(srBlob);
  const w = (targetWidth && targetWidth > 0) ? targetWidth : srBmp.width;
  const h = Math.max(1, Math.round(srBmp.height * (w / srBmp.width)));

  const srcBmp = await createImageBitmap(sourceBlob);
  let hasAlpha = false;
  if (srcBmp.width > 0 && srcBmp.height > 0) {
    const aCanvas = new OffscreenCanvas(srcBmp.width, srcBmp.height);
    const aCtx = aCanvas.getContext('2d', { willReadFrequently: true });
    aCtx.drawImage(srcBmp, 0, 0);
    const nativeData = aCtx.getImageData(0, 0, srcBmp.width, srcBmp.height).data;
    for (let i = 3; i < nativeData.length; i += 4) {
      if (nativeData[i] !== 255) { hasAlpha = true; break; }
    }
  }

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (hasAlpha) {
    ctx.drawImage(srcBmp, 0, 0, w, h);
    const srcData = ctx.getImageData(0, 0, w, h).data;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(srBmp, 0, 0, w, h);
    const out = ctx.getImageData(0, 0, w, h);
    for (let i = 3; i < out.data.length; i += 4) out.data[i] = srcData[i];
    ctx.putImageData(out, 0, 0);
  } else {
    ctx.drawImage(srBmp, 0, 0, w, h);
  }

  srBmp.close?.();
  srcBmp.close?.();
  return await canvas.convertToBlob({ type: 'image/png' });
}

// SR (4x) then fit to exact target WIDTH. Returns PNG blob, or null on failure.
export async function superResolveToWidth(blob, targetWidth) {
  try {
    const maxPixels = await getSrMaxPixels();
    const bmp = await createImageBitmap(blob);
    const sw = bmp.width || 1, sh = bmp.height || 1;
    bmp.close?.();

    let input = blob;
    let fitW = sw, fitH = sh;
    if (sw * sh > maxPixels) {
      const shrink = Math.sqrt(maxPixels / (sw * sh));
      fitW = Math.max(1, Math.floor(sw * shrink));
      fitH = Math.max(1, Math.round(sh * (fitW / sw)));
      input = await _fitBlobToWidth(blob, fitW);
    }
    console.log('[KICKCLIP-LOG] SR input', {
      ep: _srProviders, src: `${sw}x${sh}`, fit: `${fitW}x${fitH}`,
      px: fitW * fitH, max: maxPixels,
    });

    const up = await superResolveBlob(input);
    if (!up) return null;
    return await _fitAndRestoreAlpha(up, blob, targetWidth);
  } catch (e) {
    console.log('[KICKCLIP-LOG] SR-to-width failed', e);
    return null;
  }
}

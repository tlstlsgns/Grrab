import * as ort from './vendor/ort.webgpu.bundle.min.mjs';

ort.env.wasm.wasmPaths = new URL('./vendor/', import.meta.url).href;
ort.env.wasm.numThreads = Math.min(8, (self.navigator && navigator.hardwareConcurrency) || 1); // PHASE_CLIP_SIZE_MT

const SR_MODEL_PATH = 'vendor/models/realesr-general-x4v3.onnx';
const SR_SCALE = 4;
// Encoding a canvas through convertToBlob/toBlob costs a flat ~1,000 ms inside the
// offscreen document at any image size, while the synchronous toDataURL costs 6-26 ms
// for the same pixels. Measured in the offscreen console: 800x800 PNG 1014/1009/1010 ms
// via convertToBlob against 9/7/6 ms via toDataURL; 2528x2528 gave 1044/1034/1046
// against 26/23/22. A DOM canvas toBlob was just as slow, so the asynchronous encode
// path is what stalls, not OffscreenCanvas. toDataURL is not available on
// OffscreenCanvas, so the final encode uses a document canvas.
function _srCanvas(w, h) {
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
}
// Ceiling on pixels handed to the model, measured end to end through this function in
// the offscreen document after the encode stall was removed.
//
// WebGPU: 400,000 px takes 3,149 ms and 698,896 px takes 6,055 ms, dropping to 5,752 ms
// by the fourth consecutive clip as the pipeline warms. Against a ten-second timeout in
// the clip path that leaves room to spare, so the ceiling sits just above 698,896.
//
// WASM does not scale the same way. At 150,000 px a pass costs about 11.6 µs per pixel,
// but at 250,000 px it costs 25.6 µs — the curve bends somewhere between, and five
// consecutive clips at 250,000 px ran 6,480 ms rising to 6,818 ms. A machine without a
// usable GPU is generally slower than the one measured, and this is the path it takes,
// so the WASM ceiling stays below the bend.
//
// Inference is not all of it: at the ceiling the model returns an 11.2-megapixel image
// which is then resized to the clip width and composited with the source alpha.
const SR_MAX_PIXELS_WEBGPU = 700000;
const SR_MAX_PIXELS_WASM = 150000;
// The model enlarges by 4x on each axis, so one pass multiplies the pixel count by 16.
// A source under 62,500 px (250x250) therefore still lands under a megapixel after a
// pass, which is not enough to use as a reference image. A second pass is run when the
// first leaves the result short. Two passes are the maximum: the second already runs at
// the provider ceiling, and a third would approach the ten-second clip timeout.
const SR_MIN_OUTPUT_PIXELS = 1000000;
const SR_MAX_PASSES = 2;

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

// Output [1,3,4H,4W] float32 0-1 (channels-first) → a painted canvas. The caller
// encodes once at the end; encoding here would pay the offscreen encode stall twice.
function _outputTensorToCanvas(out) {
  const dims = out.dims;            // [1,3,H,W] NCHW
  const oH = dims[2], oW = dims[3];
  const od = out.data;
  const plane = oW * oH;
  const canvas = _srCanvas(oW, oH);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(oW, oH);
  for (let i = 0; i < plane; i++) {
    img.data[i * 4]     = Math.max(0, Math.min(255, Math.round(od[i] * 255)));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(od[plane + i] * 255)));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(od[2 * plane + i] * 255)));
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// 4x upscale an image source (Blob or canvas). Returns a painted canvas, or null.
export async function superResolveToCanvas(src) {
  try {
    let session = await getSrSession();
    const bitmap = await createImageBitmap(src);
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
    const outBlob = _outputTensorToCanvas(outTensor);
    return outBlob;
  } catch (e) {
    console.log('[KICKCLIP-LOG] SR failed', e);
    return null;
  }
}

// Fit an image source to an exact target WIDTH (preserve aspect). Returns a canvas
// so no encode happens here; only the final output is encoded.
async function _fitToWidthCanvas(blob, targetWidth) {
  const bmp = await createImageBitmap(blob);
  const sw = bmp.width || 1, sh = bmp.height || 1;
  if (sw === targetWidth) { bmp.close?.(); return null; }
  const scale = targetWidth / sw;
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  const canvas = _srCanvas(dw, dh);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, dw, dh);
  bmp.close?.();
  return canvas;
}

// Fit SR output to target width, restore source alpha, and encode ONCE. This is the
// only encode in the whole SR path — see the note on _srCanvas.
async function _fitRestoreAlphaAndEncode(srSrc, sourceBlob, targetWidth) {
  const srBmp = await createImageBitmap(srSrc);
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

  const canvas = _srCanvas(w, h);
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
  if (canvas.toDataURL) return canvas.toDataURL('image/png');
  const fallback = await canvas.convertToBlob({ type: 'image/png' });
  return await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(fallback);
  });
}

// PHASE_SR_MIN_OUTPUT: a second pass that fails should not discard the first pass's
// result. Encodes a canvas the same way _fitRestoreAlphaAndEncode does, without the
// alpha restoration — the caller only reaches this when it already has SR output.
async function _encodeCanvas(src) {
  try {
    if (src && src.toDataURL) return src.toDataURL('image/png');
    const bmp = await createImageBitmap(src);
    const c = _srCanvas(bmp.width, bmp.height);
    c.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close?.();
    if (c.toDataURL) return c.toDataURL('image/png');
    return null;
  } catch (_) {
    return null;
  }
}

// SR (4x) then fit to exact target WIDTH. Returns a PNG data URL string, or null.
export async function superResolveToWidth(blob, targetWidth) {
  try {
    const maxPixels = await getSrMaxPixels();
    const bmp = await createImageBitmap(blob);
    const sw = bmp.width || 1, sh = bmp.height || 1;
    bmp.close?.();

    // PHASE_SR_MIN_OUTPUT: each pass feeds the previous pass's canvas back in, shrunk
    // to the ceiling first when it overflows. `current` is a Blob on the first pass and
    // a canvas afterwards; createImageBitmap accepts both.
    let current = blob;
    let curW = sw, curH = sh;
    let fitW = sw, fitH = sh;
    let passes = 0;

    while (passes < SR_MAX_PASSES) {
      let input = current;
      fitW = curW; fitH = curH;
      if (curW * curH > maxPixels) {
        const shrink = Math.sqrt(maxPixels / (curW * curH));
        fitW = Math.max(1, Math.floor(curW * shrink));
        fitH = Math.max(1, Math.round(curH * (fitW / curW)));
        input = (await _fitToWidthCanvas(current, fitW)) || current;
      }
      if (passes === 0) {
        console.log('[KICKCLIP-LOG] SR input', {
          ep: _srProviders, src: `${sw}x${sh}`, fit: `${fitW}x${fitH}`,
          px: fitW * fitH, max: maxPixels,
        });
      }
      const _tPass = performance.now();
      const up = await superResolveToCanvas(input);
      if (!up) return (passes === 0) ? null : await _encodeCanvas(current);
      console.log('[KICKCLIP-LOG] SR pass', {
        pass: passes + 1, in: `${fitW}x${fitH}`, out: `${up.width}x${up.height}`,
        outPx: up.width * up.height, ms: Math.round(performance.now() - _tPass),
      });
      current = up;
      curW = up.width; curH = up.height;
      passes++;
      if (curW * curH >= SR_MIN_OUTPUT_PIXELS) break;
    }

    // PHASE_SR_MIN_OUTPUT: two passes multiply by 256, so anything from a source above
    // about 63x63 clears a megapixel. Below that even two passes fall short, and the
    // model cannot be asked again without risking the timeout — a plain interpolated
    // enlargement fills the remainder. It adds no detail, but neither does a third pass
    // add any that is real, and this costs nothing.
    // ⚠️ MAINTAINER: delete this block to leave sub-63x63 sources short of a megapixel.
    if (curW * curH < SR_MIN_OUTPUT_PIXELS && curW > 0) {
      const grow = Math.sqrt(SR_MIN_OUTPUT_PIXELS / (curW * curH));
      const topW = Math.max(1, Math.ceil(curW * grow));
      const topped = await _fitToWidthCanvas(current, topW);
      if (topped) {
        console.log('[KICKCLIP-LOG] SR topup', {
          from: `${curW}x${curH}`, to: `${topped.width}x${topped.height}`,
        });
        current = topped; curW = topped.width; curH = topped.height;
      }
    }

    const _outFinal = await _fitRestoreAlphaAndEncode(current, blob, targetWidth);
    return _outFinal;
  } catch (e) {
    console.log('[KICKCLIP-LOG] SR-to-width failed', e);
    return null;
  }
}

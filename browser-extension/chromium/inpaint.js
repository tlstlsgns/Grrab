import * as ort from './vendor/ort.webgpu.bundle.min.mjs';

ort.env.wasm.wasmPaths = new URL('./vendor/', import.meta.url).href;
ort.env.wasm.numThreads = Math.min(8, (self.navigator && navigator.hardwareConcurrency) || 1); // PHASE_CLIP_SIZE_MT

const IP_MODEL_PATH = 'vendor/models/migan-512.onnx';
const IP_IMAGE_INPUT = 'image'; // UINT8 [1,3,H,W]
const IP_MASK_INPUT = 'mask'; // UINT8 [1,1,H,W]
const IP_OUTPUT = 'result'; // UINT8 [1,3,H,W]

// Opposite of ormbg: 255 = keep, 0 = area to inpaint/erase.
const IP_KEEP = 255;
const IP_ERASE = 0;

let _ipSession = null;
let _ipProviders = null;

async function _createIpSession() {
  const buf = await (await fetch(chrome.runtime.getURL(IP_MODEL_PATH))).arrayBuffer();
  const s = await ort.InferenceSession.create(buf, {
    executionProviders: ['wasm'], graphOptimizationLevel: 'all',
  });
  _ipProviders = 'wasm';
  return s;
}

export async function getInpaintSession() {
  if (_ipSession) return _ipSession;
  _ipSession = await _createIpSession();
  try {
    console.log('[KICKCLIP-LOG] inpaint session ready', {
      providers: _ipProviders,
      inputs: _ipSession.inputNames,
      outputs: _ipSession.outputNames,
    });
  } catch (_) {}
  return _ipSession;
}

function _rgbaToPlanarUint8(rgba, w, h) {
  const plane = w * h;
  const out = new Uint8Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    const p = i * 4;
    out[i] = rgba[p];
    out[plane + i] = rgba[p + 1];
    out[2 * plane + i] = rgba[p + 2];
  }
  return out;
}

function _planarUint8ToRgba(planar, w, h) {
  const plane = w * h;
  const rgba = new Uint8ClampedArray(plane * 4);
  for (let i = 0; i < plane; i++) {
    const p = i * 4;
    rgba[p] = planar[i];
    rgba[p + 1] = planar[plane + i];
    rgba[p + 2] = planar[2 * plane + i];
    rgba[p + 3] = 255;
  }
  return rgba;
}

export async function inpaintWithMask(blob, maskBlob) {
  try {
    const bitmap = await createImageBitmap(blob);
    const maskBitmap = await createImageBitmap(maskBlob);
    const w = bitmap.width;
    const h = bitmap.height;

    if (maskBitmap.width !== w || maskBitmap.height !== h) {
      console.log('[KICKCLIP-LOG] inpaint mask size mismatch', {
        image: { w, h },
        mask: { w: maskBitmap.width, h: maskBitmap.height },
      });
      bitmap.close?.();
      maskBitmap.close?.();
      return null;
    }

    const maskCanvas = new OffscreenCanvas(w, h);
    const maskCtx = maskCanvas.getContext('2d');
    maskCtx.drawImage(maskBitmap, 0, 0, w, h);
    maskBitmap.close?.();
    const { data: maskRgba } = maskCtx.getImageData(0, 0, w, h);

    const plane = w * h;
    const mask = new Uint8Array(plane);
    let anyErase = false;
    for (let i = 0; i < plane; i += 1) {
      if (maskRgba[i * 4] > 127) {
        mask[i] = IP_ERASE;
        anyErase = true;
      } else {
        mask[i] = IP_KEEP;
      }
    }
    if (!anyErase) {
      bitmap.close?.();
      return blob;
    }

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const { data: rgba } = ctx.getImageData(0, 0, w, h);

    const imagePlanar = _rgbaToPlanarUint8(rgba, w, h);
    const session = await getInpaintSession();
    const res = await session.run({
      [IP_IMAGE_INPUT]: new ort.Tensor('uint8', imagePlanar, [1, 3, h, w]),
      [IP_MASK_INPUT]: new ort.Tensor('uint8', mask, [1, 1, h, w]),
    });
    const outTensor = res[IP_OUTPUT];
    if (!outTensor || outTensor.type !== 'uint8') {
      throw new Error(`unexpected output type: ${outTensor?.type}`);
    }

    const outRgba = _planarUint8ToRgba(outTensor.data, w, h);
    const outCanvas = new OffscreenCanvas(w, h);
    const oCtx = outCanvas.getContext('2d');
    const outImg = oCtx.createImageData(w, h);
    outImg.data.set(outRgba);
    oCtx.putImageData(outImg, 0, 0);
    return await outCanvas.convertToBlob({ type: 'image/png' });
  } catch (e) {
    console.log('[KICKCLIP-LOG] inpaint failed', e);
    return null;
  }
}

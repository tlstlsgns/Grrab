import * as ort from './vendor/ort.webgpu.bundle.min.mjs';

ort.env.wasm.wasmPaths = new URL('./vendor/', import.meta.url).href;
ort.env.wasm.numThreads = Math.min(8, (self.navigator && navigator.hardwareConcurrency) || 1); // PHASE_CLIP_SIZE_MT

const BG_MODEL_PATH = 'vendor/models/ormbg-int8.onnx';
const BG_INPUT_W = 1024; // preprocessor_config.json -> size.width
const BG_INPUT_H = 1024; // preprocessor_config.json -> size.height
const BG_RESCALE = 1 / 255; // preprocessor_config.json -> rescale_factor
const BG_INPUT_NAME = 'pixel_values';
const BG_OUTPUT_NAME = 'alphas';

let _bgSession = null;
let _bgProviders = null;

async function _createBgSession() {
  const buf = await (await fetch(chrome.runtime.getURL(BG_MODEL_PATH))).arrayBuffer();
  const s = await ort.InferenceSession.create(buf, {
    executionProviders: ['wasm'], graphOptimizationLevel: 'all',
  });
  _bgProviders = 'wasm';
  return s;
}

export async function getBgSession() {
  if (_bgSession) return _bgSession;
  _bgSession = await _createBgSession();
  try {
    console.log('[KICKCLIP-LOG] BG session ready', {
      providers: _bgProviders,
      inputs: _bgSession.inputNames,
      outputs: _bgSession.outputNames,
    });
  } catch (_) {}
  return _bgSession;
}

function _bitmapToInputTensor(bitmap) {
  const canvas = new OffscreenCanvas(BG_INPUT_W, BG_INPUT_H);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, BG_INPUT_W, BG_INPUT_H);
  const { data } = ctx.getImageData(0, 0, BG_INPUT_W, BG_INPUT_H);
  const plane = BG_INPUT_W * BG_INPUT_H;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    out[i]             = data[i * 4]     * BG_RESCALE;
    out[plane + i]     = data[i * 4 + 1] * BG_RESCALE;
    out[2 * plane + i] = data[i * 4 + 2] * BG_RESCALE;
  }
  return new ort.Tensor('float32', out, [1, 3, BG_INPUT_H, BG_INPUT_W]);
}

function _alphaTensorToCanvas(alphaTensor, targetW, targetH) {
  const dims = alphaTensor.dims;
  const aH = dims[dims.length - 2];
  const aW = dims[dims.length - 1];
  const od = alphaTensor.data;
  const plane = aW * aH;
  const small = new OffscreenCanvas(aW, aH);
  const sctx = small.getContext('2d');
  const img = sctx.createImageData(aW, aH);
  for (let i = 0; i < plane; i++) {
    const v = Math.max(0, Math.min(255, Math.round(od[i] * 255)));
    img.data[i * 4]     = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
  const out = new OffscreenCanvas(targetW, targetH);
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(small, 0, 0, targetW, targetH);
  return out;
}

export async function removeBackground(blob) {
  try {
    const session = await getBgSession();
    const bitmap = await createImageBitmap(blob);
    const w = bitmap.width;
    const h = bitmap.height;

    const tensor = _bitmapToInputTensor(bitmap);
    const res = await session.run({ [BG_INPUT_NAME]: tensor });
    const alpha = res[BG_OUTPUT_NAME];
    const alphaCanvas = _alphaTensorToCanvas(alpha, w, h);
    const alphaCtx = alphaCanvas.getContext('2d');
    const alphaData = alphaCtx.getImageData(0, 0, w, h).data;

    const outCanvas = new OffscreenCanvas(w, h);
    const oCtx = outCanvas.getContext('2d');
    oCtx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const outImg = oCtx.getImageData(0, 0, w, h);
    const od = outImg.data;
    for (let i = 3; i < od.length; i += 4) {
      od[i] = alphaData[i - 3];
    }
    oCtx.putImageData(outImg, 0, 0);
    return await outCanvas.convertToBlob({ type: 'image/png' });
  } catch (e) {
    console.log('[KICKCLIP-LOG] BG removal failed', e);
    return null;
  }
}

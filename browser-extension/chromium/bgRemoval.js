import * as ort from './vendor/ort.webgpu.bundle.min.mjs';

ort.env.wasm.wasmPaths = new URL('./vendor/', import.meta.url).href;
ort.env.wasm.numThreads = 1;

const INPUT_SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const PLANE_SIZE = INPUT_SIZE * INPUT_SIZE;

/** @type {import('onnxruntime-web').InferenceSession | null} */
let cachedSession = null;
/** @type {string[] | null} */
let sessionProviders = null;

export async function bgRemovalSelfTest() {
  const webgpu = typeof navigator.gpu !== 'undefined';
  console.log('[SEACLIP-BGR] ort.env.versions:', ort.env.versions);
  console.log('[SEACLIP-BGR] webgpu available:', webgpu);
  const ortVersion = ort.env.versions?.common ?? String(ort.env.versions);
  return { ortVersion, webgpu };
}

async function loadModelBuffer() {
  const modelUrl = chrome.runtime.getURL('vendor/models/u2netp.onnx');
  const res = await fetch(modelUrl);
  if (!res.ok) {
    throw new Error(`[SEACLIP-BGR] model fetch failed: HTTP ${res.status}`);
  }
  return res.arrayBuffer();
}

/**
 * @param {(stage: string) => void} [onProgress]
 */
async function getSession(onProgress) {
  if (cachedSession) return cachedSession;

  onProgress?.('model-loading');
  const t0 = performance.now();
  const buf = await loadModelBuffer();

  try {
    cachedSession = await ort.InferenceSession.create(buf, {
      executionProviders: ['webgpu', 'wasm'],
      graphOptimizationLevel: 'all',
    });
    sessionProviders = ['webgpu', 'wasm'];
  } catch (err) {
    console.log('[SEACLIP-BGR] webgpu session create failed, falling back to wasm:', err);
    cachedSession = await ort.InferenceSession.create(buf, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    sessionProviders = ['wasm'];
  }

  console.log(
    '[SEACLIP-BGR] session ready in',
    `${(performance.now() - t0).toFixed(0)}ms`,
    'providers:',
    sessionProviders,
    'input:',
    cachedSession.inputNames[0],
    'output:',
    cachedSession.outputNames[0]
  );
  onProgress?.('ready');
  return cachedSession;
}

async function recreateWasmSession() {
  const buf = await loadModelBuffer();
  cachedSession = await ort.InferenceSession.create(buf, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
  sessionProviders = ['wasm'];
  return cachedSession;
}

/**
 * @param {Blob} blob
 * @param {(stage: string) => void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function removeBackgroundPngBlob(blob, onProgress) {
  const tTotal = performance.now();
  let session = await getSession(onProgress);
  const inName = session.inputNames[0];
  const outName = session.outputNames[0];

  const bmp = await createImageBitmap(blob);
  const origW = bmp.width;
  const origH = bmp.height;

  const prepCanvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
  const prepCtx = prepCanvas.getContext('2d');
  prepCtx.drawImage(bmp, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const rgba = prepCtx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;

  const data = new Float32Array(3 * PLANE_SIZE);
  for (let i = 0; i < PLANE_SIZE; i++) {
    const j = i * 4;
    const r = rgba[j] / 255;
    const g = rgba[j + 1] / 255;
    const b = rgba[j + 2] / 255;
    data[i] = (r - MEAN[0]) / STD[0];
    data[PLANE_SIZE + i] = (g - MEAN[1]) / STD[1];
    data[2 * PLANE_SIZE + i] = (b - MEAN[2]) / STD[2];
  }

  const inputTensor = new ort.Tensor('float32', data, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  const tInfer = performance.now();
  let out;
  try {
    out = await session.run({ [inName]: inputTensor });
  } catch (err) {
    if (sessionProviders?.includes('webgpu')) {
      console.log('[SEACLIP-BGR] webgpu run failed, recreating wasm session:', err);
      cachedSession = null;
      sessionProviders = null;
      session = await recreateWasmSession();
      out = await session.run({ [inName]: inputTensor });
    } else {
      throw err;
    }
  }
  console.log('[SEACLIP-BGR] inference', `${(performance.now() - tInfer).toFixed(0)}ms`);

  const mask = out[outName].data;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] < min) min = mask[i];
    if (mask[i] > max) max = mask[i];
  }
  const range = max - min;

  const maskImageData = new ImageData(INPUT_SIZE, INPUT_SIZE);
  for (let i = 0; i < PLANE_SIZE; i++) {
    const v = range === 0 ? 1 : (mask[i] - min) / range;
    const a = Math.round(v * 255);
    const j = i * 4;
    maskImageData.data[j] = a;
    maskImageData.data[j + 1] = a;
    maskImageData.data[j + 2] = a;
    maskImageData.data[j + 3] = 255;
  }

  const maskCanvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
  maskCanvas.getContext('2d').putImageData(maskImageData, 0, 0);

  const scaledMaskCanvas = new OffscreenCanvas(origW, origH);
  const scaledCtx = scaledMaskCanvas.getContext('2d');
  scaledCtx.drawImage(maskCanvas, 0, 0, origW, origH);
  const scaledMask = scaledCtx.getImageData(0, 0, origW, origH);

  const outCanvas = new OffscreenCanvas(origW, origH);
  const outCtx = outCanvas.getContext('2d');
  outCtx.drawImage(bmp, 0, 0);
  const outImageData = outCtx.getImageData(0, 0, origW, origH);
  const pixels = outImageData.data;
  const sm = scaledMask.data;
  for (let i = 0; i < origW * origH; i++) {
    pixels[i * 4 + 3] = sm[i * 4];
  }
  outCtx.putImageData(outImageData, 0, 0);

  bmp.close();
  const result = await outCanvas.convertToBlob({ type: 'image/png' });
  console.log('[SEACLIP-BGR] total', `${(performance.now() - tTotal).toFixed(0)}ms`);
  return result;
}

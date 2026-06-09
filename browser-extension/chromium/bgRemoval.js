import * as ort from './vendor/ort.webgpu.bundle.min.mjs';

ort.env.wasm.wasmPaths = new URL('./vendor/', import.meta.url).href;
ort.env.wasm.numThreads = 1;

export async function bgRemovalSelfTest() {
  const webgpu = typeof navigator.gpu !== 'undefined';
  console.log('[SEACLIP-BGR] ort.env.versions:', ort.env.versions);
  console.log('[SEACLIP-BGR] webgpu available:', webgpu);
  const ortVersion = ort.env.versions?.common ?? String(ort.env.versions);
  return { ortVersion, webgpu };
}

export async function removeBackgroundPngBlob(blob) {
  throw new Error('not implemented yet (Step 2)');
}

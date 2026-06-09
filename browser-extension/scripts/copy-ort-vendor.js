/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ORT_DIST_FILES = [
  'ort.webgpu.bundle.min.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.wasm',
];

function copyOrtVendor(destDir) {
  const ortDistDir = path.join(__dirname, '..', 'node_modules', 'onnxruntime-web', 'dist');
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of ORT_DIST_FILES) {
    const src = path.join(ortDistDir, name);
    if (!fs.existsSync(src)) {
      console.error(`ERROR: missing onnxruntime-web dist file: ${src}`);
      process.exit(1);
    }
    fs.copyFileSync(src, path.join(destDir, name));
  }
  console.log(`[copy-ort-vendor] ${ORT_DIST_FILES.join(', ')} → ${destDir}`);
}

module.exports = { copyOrtVendor, ORT_DIST_FILES };

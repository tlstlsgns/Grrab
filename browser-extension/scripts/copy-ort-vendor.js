/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ORT_DIST_FILES = [
  'ort.webgpu.bundle.min.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.wasm',
];

const srcModelsDir = path.join(__dirname, '..', 'chromium', 'vendor', 'models');

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

function copyVendorModels(destVendorDir) {
  if (!fs.existsSync(srcModelsDir)) {
    console.error(`ERROR: missing model dir: ${srcModelsDir} — run fetch-model first`);
    process.exit(1);
  }
  const destModelsDir = path.join(destVendorDir, 'models');
  fs.mkdirSync(destModelsDir, { recursive: true });
  const entries = fs.readdirSync(srcModelsDir, { withFileTypes: true });
  let copied = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    fs.copyFileSync(
      path.join(srcModelsDir, entry.name),
      path.join(destModelsDir, entry.name)
    );
    copied += 1;
  }
  if (copied === 0) {
    console.error(`ERROR: no model files in ${srcModelsDir}`);
    process.exit(1);
  }
  console.log(`[copy-ort-vendor] models (${copied} file(s)) → ${destModelsDir}`);
}

module.exports = { copyOrtVendor, copyVendorModels, ORT_DIST_FILES };

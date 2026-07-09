/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ORT_VENDOR_FILES = [
  'ort.webgpu.bundle.min.mjs',
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
];

const STALE_ORT_WASM_RE = /^ort-wasm-.*\.(mjs|wasm)$/;

const srcModelsDir = path.join(__dirname, '..', 'chromium', 'vendor', 'models');

function removeStaleOrtWasm(destDir) {
  if (!fs.existsSync(destDir)) return;
  const whitelist = new Set(ORT_VENDOR_FILES);
  for (const entry of fs.readdirSync(destDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!STALE_ORT_WASM_RE.test(entry.name)) continue;
    if (whitelist.has(entry.name)) continue;
    const stale = path.join(destDir, entry.name);
    fs.unlinkSync(stale);
    console.log(`[copy-ort-vendor] removed stale ${entry.name}`);
  }
}

function copyOrtVendor(destDir) {
  const ortDistDir = path.join(__dirname, '..', 'node_modules', 'onnxruntime-web', 'dist');
  fs.mkdirSync(destDir, { recursive: true });
  removeStaleOrtWasm(destDir);
  for (const name of ORT_VENDOR_FILES) {
    const src = path.join(ortDistDir, name);
    if (!fs.existsSync(src)) {
      console.error(`ERROR: missing onnxruntime-web dist file: ${src}`);
      process.exit(1);
    }
    fs.copyFileSync(src, path.join(destDir, name));
  }
  console.log(`[copy-ort-vendor] ${ORT_VENDOR_FILES.length} file(s) → ${destDir}`);
  console.log(`[copy-ort-vendor] ${ORT_VENDOR_FILES.join(', ')}`);
  return ORT_VENDOR_FILES;
}

function copyVendorModels(destVendorDir) {
  if (!fs.existsSync(srcModelsDir)) {
    console.error(`ERROR: missing model dir: ${srcModelsDir}`);
    process.exit(1);
  }
  const destModelsDir = path.join(destVendorDir, 'models');
  fs.mkdirSync(destModelsDir, { recursive: true });
  const MODEL_ALLOWLIST = new Set(['realesr-general-x4v3.onnx']);
  const entries = fs.readdirSync(srcModelsDir, { withFileTypes: true });
  let copied = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!MODEL_ALLOWLIST.has(entry.name)) continue;
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

module.exports = { copyOrtVendor, copyVendorModels, ORT_VENDOR_FILES };

/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MODEL_URL = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx';
const MODEL_NAME = 'u2netp.onnx';
const LICENSE_NOTE = 'u2netp = U^2-Net weights, Apache-2.0';

const defaultTargetDir = path.join(__dirname, '..', 'chromium', 'vendor', 'models');

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function fetchModel(targetDir = defaultTargetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const dest = path.join(targetDir, MODEL_NAME);

  if (fs.existsSync(dest)) {
    const size = fs.statSync(dest).size;
    const hash = sha256Buffer(fs.readFileSync(dest));
    console.log(`[fetch-model] cached ${MODEL_NAME}: ${size} bytes, sha256=${hash}`);
    console.log(`[fetch-model] ${LICENSE_NOTE}`);
    return { path: dest, size, sha256: hash, cached: true };
  }

  console.log(`[fetch-model] downloading ${MODEL_URL} ...`);
  const res = await fetch(MODEL_URL);
  if (!res.ok) {
    throw new Error(`[fetch-model] download failed: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  const hash = sha256Buffer(buf);
  console.log(`[fetch-model] ${MODEL_NAME}: ${buf.length} bytes, sha256=${hash}`);
  console.log(`[fetch-model] ${LICENSE_NOTE}`);
  return { path: dest, size: buf.length, sha256: hash, cached: false };
}

module.exports = { fetchModel, MODEL_NAME, LICENSE_NOTE };

if (require.main === module) {
  fetchModel().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

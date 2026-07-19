#!/usr/bin/env node
/**
 * Generate .webp alongside landing rasters (same folder, same basename).
 * Does not modify or delete originals.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LANDING = path.join(ROOT, 'docs/assets/landing');

/** @type {{ label: string; glob: RegExp; dir: string; width: number }[]} */
const RULES = [
  {
    label: 'hero tiles',
    dir: path.join(LANDING, 'img'),
    glob: /^hero-\d+\.png$/i,
    width: 900,
  },
  {
    label: 'rowA before/after',
    dir: path.join(LANDING, 'img'),
    glob: /^rowA_(before|after)\.png$/i,
    width: 1400,
  },
  {
    label: 'profile avatar',
    dir: path.join(LANDING, 'img'),
    glob: /^example_profile\.png$/i,
    width: 200,
  },
  {
    label: 'preview jpg',
    dir: path.join(LANDING, 'img'),
    glob: /^.+_preview\.jpg$/i,
    width: 800,
  },
  {
    label: 'rowB mockup thumbs',
    dir: path.join(LANDING, 'img/rowB'),
    glob: /\.jpg$/i,
    width: 600,
  },
];

async function collectJpgUnderIcons(dir) {
  const out = [];
  async function walk(current) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (/\.jpg$/i.test(ent.name)) {
        out.push(full);
      }
    }
  }
  await walk(dir);
  return out;
}

async function collectFromRule(rule) {
  let entries;
  try {
    entries = await fs.readdir(rule.dir);
  } catch {
    return [];
  }
  return entries
    .filter((name) => rule.glob.test(name))
    .map((name) => path.join(rule.dir, name));
}

async function shouldSkip(src, dest) {
  try {
    const [srcStat, destStat] = await Promise.all([fs.stat(src), fs.stat(dest)]);
    return destStat.mtimeMs >= srcStat.mtimeMs;
  } catch {
    return false;
  }
}

function kb(bytes) {
  return bytes / 1024;
}

function pct(saved, original) {
  if (original <= 0) return '0%';
  return `${Math.round((saved / original) * 100)}%`;
}

async function convertOne(src, targetWidth) {
  const dest = src.replace(/\.(png|jpe?g)$/i, '.webp');
  const origStat = await fs.stat(src);
  const origBytes = origStat.size;

  if (await shouldSkip(src, dest)) {
    const destStat = await fs.stat(dest);
    return {
      src,
      dest,
      skipped: true,
      origBytes,
      webpBytes: destStat.size,
    };
  }

  await sharp(src)
    .resize({ width: targetWidth, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(dest);

  const destStat = await fs.stat(dest);
  return {
    src,
    dest,
    skipped: false,
    origBytes,
    webpBytes: destStat.size,
  };
}

async function main() {
  /** @type {{ src: string; width: number }[]} */
  const jobs = [];

  for (const rule of RULES) {
    const files = await collectFromRule(rule);
    for (const file of files) {
      jobs.push({ src: file, width: rule.width });
    }
  }

  const iconJpg = await collectJpgUnderIcons(path.join(LANDING, 'icons'));
  for (const file of iconJpg) {
    jobs.push({ src: file, width: 200 });
  }

  jobs.sort((a, b) => a.src.localeCompare(b.src));

  if (jobs.length === 0) {
    console.log('No input files matched conversion rules.');
    return;
  }

  console.log(`Converting ${jobs.length} raster file(s) to WebP (quality 80)...\n`);
  console.log(
    `${'file'.padEnd(72)} ${'orig KB'.padStart(9)} ${'webp KB'.padStart(9)} ${'saved'.padStart(7)}`
  );
  console.log('-'.repeat(102));

  let totalOrig = 0;
  let totalWebp = 0;
  /** @type {{ rel: string; origBytes: number; webpBytes: number }[]} */
  const results = [];

  for (const job of jobs) {
    const result = await convertOne(job.src, job.width);
    totalOrig += result.origBytes;
    totalWebp += result.webpBytes;
    const rel = path.relative(ROOT, result.src);
    const saved = result.origBytes - result.webpBytes;
    const tag = result.skipped ? ' (skip)' : '';
    console.log(
      `${(rel + tag).padEnd(72)} ${kb(result.origBytes).toFixed(0).padStart(9)} ${kb(result.webpBytes).toFixed(0).padStart(9)} ${pct(saved, result.origBytes).padStart(7)}`
    );
    results.push({ rel, origBytes: result.origBytes, webpBytes: result.webpBytes });
  }

  console.log('-'.repeat(102));
  const totalSaved = totalOrig - totalWebp;
  console.log(
    `${'TOTAL'.padEnd(72)} ${kb(totalOrig).toFixed(0).padStart(9)} ${kb(totalWebp).toFixed(0).padStart(9)} ${pct(totalSaved, totalOrig).padStart(7)}`
  );
  console.log(
    `\nOriginal total: ${(totalOrig / 1024 / 1024).toFixed(2)} MB → WebP total: ${(totalWebp / 1024 / 1024).toFixed(2)} MB (${pct(totalSaved, totalOrig)} saved)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

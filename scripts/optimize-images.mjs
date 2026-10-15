#!/usr/bin/env node
/**
 * npm run optimize-images
 *
 * Mengompres gambar baru di public/uploads/ menjadi WebP:
 *   - barbers/, site/ : lebar maks. 800 px
 *   - gallery/, promos/ (dan folder lain): lebar maks. 1600 px
 * Lalu memperbarui path gambar di src/content/*.json (mis. foto.jpg → foto.webp).
 *
 * Aman dijalankan berulang: file .webp yang sudah tidak melebihi lebar maks. dilewati.
 * Dijalankan otomatis oleh GitHub Actions saat ada gambar baru di-commit, dan sebelum build.
 */
import { existsSync } from 'node:fs';
import { readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

sharp.cache(false);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPLOADS = path.join(ROOT, 'public', 'uploads');
const CONTENT = path.join(ROOT, 'src', 'content');

const MAX_WIDTH = { barbers: 800, site: 800, gallery: 1600, promos: 1600 };
const DEFAULT_MAX_WIDTH = 1600;
const QUALITY = 78;
const CONVERTIBLE = /\.(jpe?g|png|gif|tiff?|avif|webp)$/i;

const toPublicUrl = (abs) => '/' + path.relative(path.join(ROOT, 'public'), abs).split(path.sep).join('/');

async function walk(dir) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])),
  );
  return files.flat();
}

async function uniqueTarget(file) {
  let candidate = file;
  for (let i = 1; ; i += 1) {
    try {
      await stat(candidate);
      candidate = file.replace(/\.webp$/, `-${i}.webp`);
    } catch {
      return candidate;
    }
  }
}

async function optimize(file) {
  const folder = path.relative(UPLOADS, file).split(path.sep)[0];
  const maxWidth = MAX_WIDTH[folder] ?? DEFAULT_MAX_WIDTH;
  const isWebp = /\.webp$/i.test(file);
  // Baca ke memori dulu: di Windows, sharp yang membuka file langsung akan menguncinya (tidak bisa dihapus)
  const input = await readFile(file);
  const meta = await sharp(input).metadata();

  // WebP yang sudah sesuai ukuran: tidak disentuh (hindari kompres berulang)
  if (isWebp && (meta.width ?? 0) <= maxWidth) return null;

  const before = input.length;
  const tmp = `${file}.tmp.webp`;
  await sharp(input)
    .rotate() // ikuti orientasi EXIF foto HP
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 5 })
    .toFile(tmp);

  const target = isWebp ? file : await uniqueTarget(file.replace(CONVERTIBLE, '.webp'));
  if (isWebp) await rm(file);
  await rename(tmp, target);
  if (!isWebp) await rm(file);

  const after = (await stat(target)).size;
  return { from: toPublicUrl(file), to: toPublicUrl(target), before, after };
}

async function updateContentReferences(changes) {
  const renamed = changes.filter((c) => c.from !== c.to);
  if (renamed.length === 0) return [];
  const touched = [];
  for (const name of (await readdir(CONTENT)).filter((f) => f.endsWith('.json'))) {
    const file = path.join(CONTENT, name);
    const original = await readFile(file, 'utf8');
    let next = original;
    for (const { from, to } of renamed) next = next.split(`"${from}"`).join(`"${to}"`);
    if (next !== original) {
      await writeFile(file, next);
      touched.push(name);
    }
  }
  return touched;
}

/**
 * Perbaiki referensi yang menunjuk ke file asli (jpg/png) yang sudah dikonversi menjadi .webp.
 * Terjadi bila admin memilih foto di Pages CMS (foto langsung ter-upload & dioptimasi workflow)
 * lalu baru menyimpan entrinya beberapa saat kemudian dengan path lama.
 */
async function repairContentReferences() {
  const touched = [];
  const pattern = /"(\/uploads\/[^"]+?)\.(jpe?g|png|gif|tiff?|avif)"/gi;
  for (const name of (await readdir(CONTENT)).filter((f) => f.endsWith('.json'))) {
    const file = path.join(CONTENT, name);
    const original = await readFile(file, 'utf8');
    const next = original.replace(pattern, (match, base) => {
      const publicDir = path.join(ROOT, 'public');
      const exists = (url) => existsSync(path.join(publicDir, url));
      const originalUrl = match.slice(1, -1);
      if (exists(originalUrl) || !exists(`${base}.webp`)) return match;
      console.log(`✓ ${name}: ${originalUrl} → ${base}.webp (referensi diperbaiki)`);
      return `"${base}.webp"`;
    });
    if (next !== original) {
      await writeFile(file, next);
      touched.push(name);
    }
  }
  return touched;
}

const kb = (n) => `${Math.round(n / 1024)} KB`;

async function main() {
  const files = (await walk(UPLOADS)).filter((f) => CONVERTIBLE.test(f) && !f.endsWith('.tmp.webp'));
  const changes = [];
  for (const file of files) {
    try {
      const result = await optimize(file);
      if (result) {
        changes.push(result);
        console.log(`✓ ${result.from} → ${result.to}  (${kb(result.before)} → ${kb(result.after)})`);
      }
    } catch (error) {
      console.error(`✗ Gagal memproses ${toPublicUrl(file)}: ${error.message}`);
      process.exitCode = 1;
    }
  }
  const touched = new Set([...(await updateContentReferences(changes)), ...(await repairContentReferences())]);
  if (touched.size) console.log(`Path gambar diperbarui di: ${[...touched].join(', ')}`);
  console.log(changes.length ? `Selesai: ${changes.length} gambar dioptimasi.` : 'Tidak ada gambar baru untuk dioptimasi.');
}

main();

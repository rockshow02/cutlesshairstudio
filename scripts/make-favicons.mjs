#!/usr/bin/env node
/**
 * npm run favicons
 *
 * Membuat set favicon dari monogram Cutless (public/images/brand/cutless-mark-white.png, putih transparan):
 * monogram di tengah kanvas persegi berlatar warna brand (--c-ink #0c1014) dengan padding, agar terbaca di 16–48 px.
 *   public/favicon.ico            16, 32, 48 px (PNG di dalam ICO)
 *   public/favicon-48x48.png      Google: kelipatan 48 px
 *   public/favicon-96x96.png
 *   public/favicon-192x192.png
 *   public/favicon-32.png         lama (tidak dirujuk lagi, tetap ada untuk cache/bookmark lama)
 *   public/apple-touch-icon.png   180 × 180 (iOS membulatkan sudut sendiri)
 *   public/icon-192.png, icon-512.png   site.webmanifest (purpose any + maskable: monogram di dalam zona aman 80 %)
 * Nama file tetap (tanpa hash) agar URL favicon stabil untuk Google. Tidak ada favicon.svg: logo hanya tersedia PNG.
 * Hasil di-commit; jalankan ulang hanya bila logo berubah.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const MARK = path.join(PUBLIC, 'images', 'brand', 'cutless-mark-white.png');
/** --c-ink (src/styles/tokens.css) */
const BRAND_BG = '#0c1014';

/** Tinggi monogram relatif terhadap sisi kanvas: lebih besar di ukuran kecil agar tetap terbaca */
const markRatio = (size) => (size <= 16 ? 0.82 : size <= 48 ? 0.74 : 0.62);

/** Favicon persegi `size` px: latar brand + monogram di tengah */
export async function favicon(size, ratio = markRatio(size)) {
  const markHeight = Math.round(size * ratio);
  const mark = await sharp(MARK).resize({ height: markHeight, kernel: 'lanczos3' }).png().toBuffer();
  const { width: mw = 0, height: mh = 0 } = await sharp(mark).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background: BRAND_BG } })
    .composite([{ input: mark, left: Math.round((size - mw) / 2), top: Math.round((size - mh) / 2) }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** ICO berisi gambar PNG (didukung Windows Vista+, semua browser, dan Google) */
export function icoFromPngs(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // 1 = ikon
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palet
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bit per piksel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

async function main() {
  const out = (name, data) => writeFile(path.join(PUBLIC, name), data);
  const ico = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await favicon(size) })));
  await out('favicon.ico', icoFromPngs(ico));
  for (const size of [48, 96, 192]) await out(`favicon-${size}x${size}.png`, await favicon(size));
  await out('favicon-32.png', await favicon(32));
  await out('apple-touch-icon.png', await favicon(180, 0.6));
  // Manifest: satu ikon untuk "any" & "maskable" → monogram ≤ 62 % sisi (zona aman maskable = lingkaran 80 %)
  await out('icon-192.png', await favicon(192, 0.56));
  await out('icon-512.png', await favicon(512, 0.56));
  console.log('✓ favicon.ico (16/32/48), favicon-48x48/96x96/192x192.png, apple-touch-icon.png, icon-192/512.png');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

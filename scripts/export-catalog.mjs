#!/usr/bin/env node
/**
 * Salin data cabang, hairstylist, dan harga dari database booking (lewat API) ke
 * src/content/branches.json, barbers.json, pricing.json.
 *
 * Setelah booking aktif, D1 adalah sumber utama; JSON hanya salinan untuk hal yang dibuat saat build:
 * halaman /cabang/<slug>/ (SEO & JSON-LD), sitemap, dan pilihan cabang di Promo/Pengumuman (Pages CMS).
 * Jalankan setelah menambah/mengubah cabang di /admin, lalu commit hasilnya.
 *
 *   npm run export-catalog                          → dari staging (VITE_SITE_URL di .env.staging)
 *   npm run export-catalog -- --url http://localhost:8787
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const i = args.indexOf('--url');
let base = i >= 0 ? args[i + 1] : '';
if (!base) {
  const env = await readFile(path.join(process.cwd(), '.env.staging'), 'utf8');
  base = env.match(/^VITE_SITE_URL=(.+)$/m)?.[1]?.trim() ?? '';
}
if (!base) {
  console.error('URL tidak diketahui. Pakai --url https://… atau isi VITE_SITE_URL di .env.staging');
  process.exit(1);
}

const res = await fetch(new URL('/api/public/catalog', base));
if (!res.ok) {
  console.error(`Gagal mengambil katalog dari ${base}: HTTP ${res.status}`);
  process.exit(1);
}
const catalog = await res.json();

/** Buang field undefined/null agar JSON rapi seperti hasil Pages CMS */
const clean = (v) => JSON.parse(JSON.stringify(v, (_k, x) => (x === null ? undefined : x)));
for (const [name, data] of Object.entries({ branches: catalog.branches, barbers: catalog.barbers, pricing: catalog.pricing })) {
  const file = path.join(process.cwd(), 'src', 'content', `${name}.json`);
  await writeFile(file, `${JSON.stringify(clean(data), null, 2)}\n`);
  console.log(`✓ ${path.relative(process.cwd(), file)}: ${data.length} entri`);
}

// Pilihan cabang di Pages CMS (Promo/Pengumuman) ikut diperbarui
const sync = spawnSync(process.execPath, ['scripts/sync-pages-config.mjs'], { stdio: 'inherit' });
process.exit(sync.status ?? 0);

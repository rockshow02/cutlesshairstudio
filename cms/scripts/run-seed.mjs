/**
 * Menjalankan scripts/seed.ts dengan Node biasa (bukan tsx):
 * 1. Bundle seed.ts + konten frontend (TypeScript) menjadi satu file CommonJS dengan esbuild;
 *    semua paket npm (termasuk Strapi) tetap eksternal.
 * 2. Jalankan hasilnya dengan `node`, sehingga Strapi dimuat persis seperti di production.
 * (tsx memuat sebagian dependensi Strapi lewat kondisi ESM yang membuat Koa gagal start.)
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outdir = path.resolve(here, '..', '.tmp');
const outfile = path.join(outdir, 'seed.cjs');
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: [path.join(here, 'seed.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  packages: 'external',
  sourcemap: 'inline',
  logLevel: 'warning',
});

const result = spawnSync(process.execPath, ['--enable-source-maps', outfile, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 1);

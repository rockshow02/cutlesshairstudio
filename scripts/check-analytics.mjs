/**
 * Cek hasil build: beacon Cloudflare Web Analytics ada di SEMUA halaman HTML (termasuk 404) bila build produksi dengan
 * token valid, dan TIDAK ada sama sekali di build lain / tanpa token. Dipakai CI setelah build produksi & staging.
 *   node scripts/check-analytics.mjs <mode> [dir]   (mode: production | staging | e2e | ...; dir default: dist)
 * Aturan sama dengan analyticsTokenFor() di scripts/vite-content-plugin.ts.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from 'vite';

const [mode = 'production', dir = 'dist'] = process.argv.slice(2);
const env = loadEnv(mode, process.cwd(), '');
const raw = (env.VITE_CF_ANALYTICS_TOKEN ?? '').trim();
const token = env.VITE_APP_ENV === 'production' && /^[0-9a-f]{32}$/i.test(raw) ? raw : '';

const files = (await readdir(dir, { recursive: true })).filter((f) => f.endsWith('.html')).map((f) => path.join(dir, f));
if (!files.length) {
  console.error(`✗ Tidak ada file HTML di ${dir}/ (jalankan build dulu)`);
  process.exit(1);
}
// Skrip pemuat dari withAnalytics(): setelah event load menambahkan <script defer src=beacon.min.js data-cf-beacon>
const loader = /<script>addEventListener\('load',function\(\)\{var s=document\.createElement\('script'\);s\.defer=true;s\.src='https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js';s\.setAttribute\('data-cf-beacon',"\{\\"token\\":\\"([0-9a-f]{32})\\"\}"\);document\.body\.appendChild\(s\)\}\)<\/script>\s*<\/body>/i;
const wrong = [];
for (const file of files) {
  const html = await readFile(file, 'utf8');
  const count = html.split('cloudflareinsights').length - 1;
  if (token ? count !== 1 || html.match(loader)?.[1] !== token : count > 0) wrong.push(file);
}
if (wrong.length) {
  const want = token ? `harus berisi tepat satu beacon (defer setelah load, token .env.${mode}) tepat sebelum </body>` : 'tidak boleh berisi beacon Web Analytics';
  console.error(`✗ Web Analytics (${mode}): ${wrong.length} halaman ${want}:\n  ${wrong.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ Web Analytics (${mode}): ${token ? 'beacon terpasang' : 'tidak dipasang'} di ${files.length} halaman HTML`);

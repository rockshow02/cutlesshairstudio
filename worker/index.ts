/**
 * Worker statis: semua permintaan dilayani dari dist/ (SPA + aset + _headers + _redirects + robots/sitemap).
 * Tidak ada API, database, atau login. File ini hanya ada karena blok produksi wrangler.jsonc masih menunjuk
 * "main": "worker/index.ts". Rute yang tidak dikenal → dist/404.html (not_found_handling).
 */
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  fetch: (request: Request, env: Env) => env.ASSETS.fetch(request),
};

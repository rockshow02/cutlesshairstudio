/**
 * Worker situs: file statis dari dist/ (SPA + aset + _headers + _redirects + robots/sitemap), kecuali:
 *   POST /api/klik-wa  hitungan klik tombol WhatsApp → D1 (waClicks.ts)
 *   /statistik/        statistik klik, hanya lewat Cloudflare Access (stats.ts, access.ts)
 * Hanya rute di assets.run_worker_first (wrangler.jsonc) yang sampai ke sini; rute yang tidak dikenal → dist/404.html.
 */
import { WA_CLICK_ENDPOINT } from '../src/content/waClicks';
import type { Env } from './env';
import { handleStats } from './stats';
import { handleWaClick } from './waClicks';

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === WA_CLICK_ENDPOINT) return handleWaClick(request, env);
    if (pathname === '/statistik' || pathname.startsWith('/statistik/')) return handleStats(request, env);
    return env.ASSETS.fetch(request);
  },
};

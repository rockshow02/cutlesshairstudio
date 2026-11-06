/**
 * Worker situs: file statis dari dist/ (SPA + aset + _headers + _redirects + robots/sitemap), kecuali:
 *   POST /api/klik-wa  hitungan klik tombol WhatsApp → D1 (waClicks.ts)
 *   /statistik/        statistik klik, hanya lewat Cloudflare Access (stats.ts, access.ts)
 *   scheduled          Cron Trigger tiap jam: sinkron ulasan Google (ulasan/sync.ts)
 * Hanya rute di assets.run_worker_first (wrangler.jsonc) yang sampai ke sini; rute yang tidak dikenal → dist/404.html.
 */
import { WA_CLICK_ENDPOINT } from '../src/content/waClicks';
import type { Env } from './env';
import { handleStats } from './stats';
import { loadReviewConfig } from './ulasan/config';
import { createGbpClient } from './ulasan/gbp';
import { runReviewSync } from './ulasan/sync';
import { handleWaClick } from './waClicks';

/** Cron per jam. Tanpa klien (secret OAuth belum diisi) atau tanpa konfigurasi build = tidak berbuat apa-apa. */
export async function runScheduled(env: Env, now = Date.now()): Promise<void> {
  const client = createGbpClient(env, now);
  const config = await loadReviewConfig(env, now);
  if (!client || !config) return;
  try {
    await runReviewSync(env, { client, config, now });
  } catch (error) {
    console.error('ulasan: sinkron gagal', error instanceof Error ? error.message : 'galat');
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === WA_CLICK_ENDPOINT) return handleWaClick(request, env);
    if (pathname === '/statistik' || pathname.startsWith('/statistik/')) return handleStats(request, env);
    return env.ASSETS.fetch(request);
  },
  scheduled(_controller: unknown, env: Env): Promise<void> {
    return runScheduled(env);
  },
};

/**
 * Worker Cutless Hair Studio: situs statis (dist/, langsung dari CDN) + API booking (/api/*) + halaman aplikasi
 * (/masuk, /profil, /booking, /admin, /kebijakan-privasi) yang dilayani dari entri Vite masing-masing.
 */
import type { Context } from 'hono';
import { createRouter, type AppEnv } from './app';
import type { Env } from './env';
import { ApiError } from './lib/errors';
import { publicRoutes } from './routes/public';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { bookingRoutes } from './routes/bookings';
import { adminRoutes } from './routes/admin';
import { catalogRoutes } from './routes/catalog';
import { loyaltyRoutes } from './routes/loyalty';
import { shopRoutes } from './routes/shop';
import { runScheduled } from './cron';

export const app = createRouter();

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
  }
  console.error(err);
  return c.json({ error: { code: 'INTERNAL', message: 'Terjadi kesalahan di server. Silakan coba lagi.' } }, 500);
});

app.get('/api/health', async (c) => {
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM branches').first<{ n: number }>();
  return c.json({ ok: true, env: c.env.APP_ENV, branches: row?.n ?? 0 });
});

app.route('/api', publicRoutes);
app.route('/api', catalogRoutes);
app.route('/api', authRoutes);
app.route('/api', meRoutes);
app.route('/api', bookingRoutes);
app.route('/api', loyaltyRoutes);
app.route('/api', shopRoutes);
app.route('/api/admin', adminRoutes);

app.all('/api/*', (c) => c.json({ error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } }, 404));

/** Halaman aplikasi: rute klien diarahkan ke HTML entri (SPA) */
const serveEntry = (entry: string) => async (c: Context<AppEnv>) => {
  const url = new URL(c.req.url);
  url.pathname = entry;
  url.search = '';
  const res = await c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'no-store');
  return out;
};
app.get('/admin', serveEntry('/admin/'));
app.get('/admin/*', serveEntry('/admin/'));
for (const p of ['/masuk', '/masuk/*', '/profil', '/profil/*', '/booking', '/booking/*', '/kebijakan-privasi', '/kebijakan-privasi/*', '/shop', '/shop/*', '/pesanan', '/pesanan/*']) {
  app.get(p, serveEntry('/booking/'));
}

// Lainnya: file statis
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(env, event.cron));
  },
} satisfies ExportedHandler<Env>;

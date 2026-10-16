/** Anti-spam gratis: Cloudflare Turnstile (diverifikasi di server) + rate limit per IP di D1. */
import type { Context } from 'hono';
import type { AppEnv } from '../app';
import { ApiError } from './errors';

/** Verifikasi token Turnstile. Tanpa TURNSTILE_SECRET_KEY: lolos HANYA di development lokal. */
export async function verifyTurnstile(c: Context<AppEnv>, token: string | undefined): Promise<void> {
  const secret = c.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (c.env.APP_ENV === 'development') return;
    throw new ApiError(500, 'INTERNAL', 'Turnstile belum dikonfigurasi di server.');
  }
  if (!token) throw new ApiError(400, 'TURNSTILE_FAILED', 'Verifikasi keamanan belum selesai. Tunggu sebentar lalu coba lagi.');
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  const ip = c.req.header('cf-connecting-ip');
  if (ip) form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const data = (await res.json()) as { success: boolean };
  if (!data.success) throw new ApiError(400, 'TURNSTILE_FAILED', 'Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi.');
}

/**
 * Rate limit sederhana (jendela tetap) per IP + jenis aksi, disimpan di D1 (tanpa layanan berbayar).
 * Satu baris per IP per jendela; dibersihkan Cron.
 */
export async function rateLimit(c: Context<AppEnv>, action: string, limit: number, windowMinutes: number): Promise<void> {
  const ip = c.req.header('cf-connecting-ip') ?? 'local';
  const windowMs = windowMinutes * 60_000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
  const row = await c.env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1 RETURNING count`,
  )
    .bind(`${action}:${ip}`, windowStart)
    .first<{ count: number }>();
  if ((row?.count ?? 0) > limit) {
    throw new ApiError(429, 'RATE_LIMITED', 'Terlalu banyak percobaan dari jaringan Anda. Coba lagi beberapa menit lagi.');
  }
}

/**
 * CSRF: request yang mengubah data (POST/PATCH/PUT/DELETE) harus berasal dari situs ini sendiri.
 * Cookie sesi sudah SameSite=Lax; pengecekan Origin menambah lapisan kedua.
 */
export function assertSameOrigin(c: Context<AppEnv>): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) return;
  const origin = c.req.header('origin');
  const self = new URL(c.req.url).origin;
  if (!origin || origin !== self) throw new ApiError(403, 'FORBIDDEN', 'Permintaan ditolak (asal tidak sah).');
}

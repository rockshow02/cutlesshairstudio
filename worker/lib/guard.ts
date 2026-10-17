/** Anti-spam gratis: Cloudflare Turnstile (diverifikasi di server) + rate limit per IP di D1. */
import type { Context } from 'hono';
import type { AppEnv } from '../app';
import { ApiError } from './errors';

/** Header yang dikirim E2E staging (berisi AUTH_MOCK_SECRET) agar verifikasi Turnstile dilewati */
export const E2E_SECRET_HEADER = 'x-e2e-secret';

/**
 * Bandingkan secret dalam waktu konstan: kedua nilai di-hash SHA-256 (panjang selalu sama),
 * lalu dibandingkan byte demi byte dengan XOR tanpa berhenti di selisih pertama.
 */
export async function secretEquals(given: string | undefined | null, expected: string | undefined | null): Promise<boolean> {
  if (!given || !expected) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(given)), crypto.subtle.digest('SHA-256', enc.encode(expected))]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/**
 * Jalur uji otomatis (E2E) di STAGING saja: Turnstile asli tidak bisa diselesaikan browser otomatis.
 * Syarat semuanya: APP_ENV tepat 'staging', AUTH_MOCK_ENABLED 'true', AUTH_MOCK_SECRET terisi,
 * dan header x-e2e-secret cocok. Produksi (APP_ENV 'production') tidak pernah lolos jalur ini.
 */
export async function isE2EBypass(c: Context<AppEnv>): Promise<boolean> {
  if (c.env.APP_ENV !== 'staging' || c.env.AUTH_MOCK_ENABLED !== 'true') return false;
  return secretEquals(c.req.header(E2E_SECRET_HEADER), c.env.AUTH_MOCK_SECRET);
}

/** Verifikasi token Turnstile. Tanpa TURNSTILE_SECRET_KEY: lolos HANYA di development lokal. */
export async function verifyTurnstile(c: Context<AppEnv>, token: string | undefined): Promise<void> {
  if (await isE2EBypass(c)) return;
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
  // Lokal: semua request dari IP yang sama (tes berulang) → batas IP tidak dipakai. Staging & produksi tetap.
  if (c.env.APP_ENV === 'development') return;
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

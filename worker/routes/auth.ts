/**
 * Login pelanggan.
 * - Utama: Google OAuth (Authorization Code + PKCE, library Arctic). Email Google sudah terverifikasi;
 *   akun dengan email_verified=false ditolak.
 * - Mock (E2E): hanya bila AUTH_MOCK_ENABLED=true, bukan produksi, dan (di staging) memakai AUTH_MOCK_SECRET.
 * - Nomor WA + password: disiapkan, NONAKTIF (AUTH_PHONE_PASSWORD_ENABLED=false).
 */
import { Google, decodeIdToken, generateCodeVerifier, generateState } from 'arctic';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { phoneLoginBody } from '../../shared/schemas';
import { createRouter, type AppEnv } from '../app';
import { ApiError, badRequest } from '../lib/errors';
import { assertSameOrigin, rateLimit, verifyTurnstile } from '../lib/guard';
import { body } from '../lib/http';
import { verifyPassword } from '../lib/password';
import { createSession, destroySession, safeNext } from '../lib/session';
import { auditStmt } from '../lib/bookings';

export const authRoutes = createRouter();

const OAUTH_COOKIES = ['oauth_state', 'oauth_verifier', 'oauth_next'] as const;

function google(c: Context<AppEnv>) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = c.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new ApiError(503, 'FEATURE_DISABLED', 'Login Google belum dikonfigurasi.');
  const redirect = `${new URL(c.req.url).origin}/api/auth/google/callback`;
  return new Google(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirect);
}

const mockEnabled = (c: Context<AppEnv>) => c.env.AUTH_MOCK_ENABLED === 'true' && c.env.APP_ENV !== 'production';
const phoneEnabled = (c: Context<AppEnv>) => c.env.AUTH_PHONE_PASSWORD_ENABLED === 'true';

/** Login selesai: pelanggan baru / profil belum lengkap → /profil/lengkapi, selain itu kembali ke halaman asal */
async function finishLogin(c: Context<AppEnv>, customerId: string, next: string) {
  await createSession(c, customerId);
  const row = await c.env.DB.prepare('SELECT name, phone, privacy_consent_at FROM customers WHERE id = ?')
    .bind(customerId)
    .first<{ name: string; phone: string | null; privacy_consent_at: string | null }>();
  const complete = Boolean(row?.name && row.phone && row.privacy_consent_at);
  return c.redirect(complete ? next : `/profil/lengkapi?next=${encodeURIComponent(next)}`, 302);
}

/** Cari/buat pelanggan dari identitas Google (sub unik) */
async function upsertGoogleCustomer(c: Context<AppEnv>, sub: string, email: string, name: string): Promise<string> {
  const existing = await c.env.DB.prepare('SELECT id, anonymized_at FROM customers WHERE google_sub = ?')
    .bind(sub)
    .first<{ id: string; anonymized_at: string | null }>();
  if (existing) {
    await c.env.DB.prepare('UPDATE customers SET email = ? WHERE id = ?').bind(email, existing.id).run();
    return existing.id;
  }
  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO customers (id, google_sub, email, name) VALUES (?, ?, ?, ?)').bind(id, sub, email, name.slice(0, 60)),
    auditStmt(c.env.DB, { type: 'customer', id }, 'customer.register', 'customer', id, { method: sub.startsWith('mock:') ? 'mock' : 'google' }),
  ]);
  return id;
}

/** Metode login yang aktif (dipakai halaman /masuk) */
authRoutes.get('/auth/config', (c) =>
  c.json({
    google: Boolean(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET),
    phonePassword: phoneEnabled(c),
    mock: mockEnabled(c),
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || null,
  }),
);

/** GET /api/auth/google?next=/booking/... → ke halaman login Google */
authRoutes.get('/auth/google', async (c) => {
  await rateLimit(c, 'auth', 30, 10);
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = google(c).createAuthorizationURL(state, verifier, ['openid', 'email', 'profile']);
  url.searchParams.set('prompt', 'select_account');
  const opts = { httpOnly: true, secure: true, sameSite: 'Lax' as const, path: '/', maxAge: 600 };
  setCookie(c, 'oauth_state', state, opts);
  setCookie(c, 'oauth_verifier', verifier, opts);
  setCookie(c, 'oauth_next', safeNext(c.req.query('next')), opts);
  return c.redirect(url.toString(), 302);
});

authRoutes.get('/auth/google/callback', async (c) => {
  const { code, state, error } = c.req.query();
  const savedState = getCookie(c, 'oauth_state');
  const verifier = getCookie(c, 'oauth_verifier');
  const next = safeNext(getCookie(c, 'oauth_next'));
  for (const name of OAUTH_COOKIES) deleteCookie(c, name, { path: '/', secure: true });
  if (error) return c.redirect(`/masuk?error=dibatalkan&next=${encodeURIComponent(next)}`, 302);
  if (!code || !state || !savedState || !verifier || state !== savedState) {
    return c.redirect(`/masuk?error=sesi&next=${encodeURIComponent(next)}`, 302);
  }
  let claims: { sub: string; email?: string; email_verified?: boolean; name?: string; aud?: string; iss?: string };
  try {
    const tokens = await google(c).validateAuthorizationCode(code, verifier);
    // ID token diterima langsung dari endpoint token Google lewat TLS; tetap cek audiens & penerbit
    claims = decodeIdToken(tokens.idToken()) as typeof claims;
  } catch (e) {
    console.error('google oauth', e);
    return c.redirect(`/masuk?error=google&next=${encodeURIComponent(next)}`, 302);
  }
  if (claims.aud !== c.env.GOOGLE_CLIENT_ID || !['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss ?? '')) {
    return c.redirect(`/masuk?error=google&next=${encodeURIComponent(next)}`, 302);
  }
  if (!claims.email || claims.email_verified !== true) {
    return c.redirect(`/masuk?error=email&next=${encodeURIComponent(next)}`, 302);
  }
  const id = await upsertGoogleCustomer(c, claims.sub, claims.email, claims.name ?? '');
  return finishLogin(c, id, next);
});

/**
 * Login uji (E2E): GET /api/auth/mock?email=&name=&secret=&next=
 * Tidak pernah aktif di produksi. Di staging wajib secret (AUTH_MOCK_SECRET).
 */
authRoutes.get('/auth/mock', async (c) => {
  if (!mockEnabled(c)) throw new ApiError(404, 'NOT_FOUND', 'Endpoint tidak ditemukan.');
  if (c.env.APP_ENV !== 'development' && (!c.env.AUTH_MOCK_SECRET || c.req.query('secret') !== c.env.AUTH_MOCK_SECRET)) {
    throw new ApiError(403, 'FORBIDDEN', 'Login uji membutuhkan secret.');
  }
  const email = (c.req.query('email') ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw badRequest('Email tidak valid.');
  const id = await upsertGoogleCustomer(c, `mock:${email}`, email, c.req.query('name') ?? '');
  return finishLogin(c, id, safeNext(c.req.query('next')));
});

authRoutes.post('/auth/logout', async (c) => {
  assertSameOrigin(c);
  await destroySession(c);
  return c.json({ ok: true });
});

/** Login nomor WA + password (nonaktif default). Password hanya bisa direset admin. */
authRoutes.post('/auth/phone', async (c) => {
  assertSameOrigin(c);
  if (!phoneEnabled(c)) throw new ApiError(404, 'FEATURE_DISABLED', 'Login dengan nomor WhatsApp belum diaktifkan.');
  await rateLimit(c, 'auth-phone', 10, 15);
  const input = await body(c, phoneLoginBody);
  await verifyTurnstile(c, input.turnstileToken);
  const row = await c.env.DB.prepare(
    `SELECT id, password_hash FROM customers WHERE phone = ? AND password_hash IS NOT NULL AND anonymized_at IS NULL AND is_guest = 0`,
  )
    .bind(input.phone)
    .first<{ id: string; password_hash: string }>();
  const ok = row ? await verifyPassword(input.password, row.password_hash) : false;
  if (!row || !ok) throw new ApiError(401, 'UNAUTHENTICATED', 'Nomor atau password salah.');
  await createSession(c, row.id);
  return c.json({ ok: true });
});

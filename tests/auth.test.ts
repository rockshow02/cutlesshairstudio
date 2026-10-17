/** Tes integrasi login & profil lewat Hono (D1 lokal). Google OAuth asli diganti mock (hanya non-produksi). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../worker/index';
import { hashPassword, verifyPassword } from '../worker/lib/password';
import { sha256Hex } from '../worker/lib/session';
import { createBooking } from '../worker/lib/bookings';
import { createTestDb } from './helpers/d1';

const ORIGIN = 'http://localhost';
let t: Awaited<ReturnType<typeof createTestDb>>;
let env: Record<string, unknown>;

const req = (path: string, init: RequestInit & { cookie?: string } = {}) => {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set('cookie', init.cookie);
  if (init.method && init.method !== 'GET') headers.set('origin', ORIGIN);
  if (init.body) headers.set('content-type', 'application/json');
  return app.request(`${ORIGIN}${path}`, { ...init, headers }, env);
};
const cookieFrom = (res: Response) => res.headers.get('set-cookie')?.match(/cutless_session=([^;]+)/)?.[1];

async function login(email: string) {
  const res = await req(`/api/auth/mock?email=${encodeURIComponent(email)}&next=/booking/?cabang=bogor-bantarjati`);
  return { res, cookie: `cutless_session=${cookieFrom(res)}` };
}

beforeAll(async () => {
  t = await createTestDb();
  env = { DB: t.db, APP_ENV: 'development', AUTH_MOCK_ENABLED: 'true', AUTH_PHONE_PASSWORD_ENABLED: 'false' };
});
afterAll(async () => {
  await t?.dispose();
});

describe('login & sesi', () => {
  it('mock login: pelanggan baru diarahkan ke /profil/lengkapi dengan next tersimpan', async () => {
    const { res } = await login('baru1@test.local');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/profil/lengkapi?next=%2Fbooking%2F%3Fcabang%3Dbogor-bantarjati');
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
  });

  it('database hanya menyimpan hash ID sesi', async () => {
    const { res } = await login('hash@test.local');
    const token = cookieFrom(res)!;
    const raw = await t.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE id_hash = ?').bind(token).first<{ n: number }>();
    const hashed = await t.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE id_hash = ?').bind(await sha256Hex(token)).first<{ n: number }>();
    expect(raw?.n).toBe(0);
    expect(hashed?.n).toBe(1);
  });

  it('pelanggan dengan profil lengkap langsung kembali ke halaman asal', async () => {
    const { res } = await login('budi@test.local'); // akun uji seed (profil lengkap)
    expect(res.headers.get('location')).toBe('/booking/?cabang=bogor-bantarjati');
  });

  it('mock login ditolak di produksi & tanpa secret di staging', async () => {
    const prod = await app.request(`${ORIGIN}/api/auth/mock?email=x@y.z`, {}, { ...env, APP_ENV: 'production' });
    expect(prod.status).toBe(404);
    const staging = await app.request(`${ORIGIN}/api/auth/mock?email=x@y.z`, {}, { ...env, APP_ENV: 'staging', AUTH_MOCK_SECRET: 's3cret' });
    expect(staging.status).toBe(403);
    const wrong = await app.request(`${ORIGIN}/api/auth/mock?email=x@y.z&secret=s3cre`, {}, { ...env, APP_ENV: 'staging', AUTH_MOCK_SECRET: 's3cret' });
    expect(wrong.status).toBe(403);
    const ok = await app.request(`${ORIGIN}/api/auth/mock?email=x@y.z&secret=s3cret`, {}, { ...env, APP_ENV: 'staging', AUTH_MOCK_SECRET: 's3cret' });
    expect(ok.status).toBe(302);
  });

  it('next berbahaya (open redirect) diganti /booking/', async () => {
    const res = await req('/api/auth/mock?email=budi@test.local&next=//evil.example');
    expect(res.headers.get('location')).toBe('/booking/');
  });

  it('tanpa login → 401', async () => {
    const res = await req('/api/me');
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('UNAUTHENTICATED');
  });
});

describe('profil', () => {
  it('lengkapi profil: nomor dinormalisasi 62xxx, persetujuan privasi wajib', async () => {
    const { cookie } = await login('profil@test.local');
    const noConsent = await req('/api/me/profile', { method: 'POST', cookie, body: JSON.stringify({ name: 'Raka', phone: '0812 3456 7890' }) });
    expect(noConsent.status).toBe(400);
    const badPhone = await req('/api/me/profile', { method: 'POST', cookie, body: JSON.stringify({ name: 'Raka', phone: '12345', privacyConsent: true }) });
    expect(badPhone.status).toBe(400);
    const ok = await req('/api/me/profile', { method: 'POST', cookie, body: JSON.stringify({ name: 'Raka', phone: '0812 3456 7890', privacyConsent: true }) });
    expect(ok.status).toBe(200);
    const me = (await (await req('/api/me', { cookie })).json()) as { customer: { phone: string; profileComplete: boolean } };
    expect(me.customer.phone).toBe('6281234567890');
    expect(me.customer.profileComplete).toBe(true);
  });

  it('request dari situs lain (Origin berbeda) ditolak', async () => {
    const { cookie } = await login('csrf@test.local');
    const res = await app.request(
      `${ORIGIN}/api/me/profile`,
      { method: 'POST', headers: { cookie, origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' },
      env,
    );
    expect(res.status).toBe(403);
  });

  it('logout menghapus sesi', async () => {
    const { cookie } = await login('logout@test.local');
    expect((await req('/api/me', { cookie })).status).toBe(200);
    expect((await req('/api/auth/logout', { method: 'POST', cookie })).status).toBe(200);
    expect((await req('/api/me', { cookie })).status).toBe(401);
  });

  it('hapus akun: data pribadi dianonimkan, booking historis tetap, booking mendatang dibatalkan', async () => {
    const { cookie } = await login('hapus@test.local');
    await req('/api/me/profile', { method: 'POST', cookie, body: JSON.stringify({ name: 'Hapus', phone: '081299998888', privacyConsent: true }) });
    const cust = await t.db.prepare(`SELECT id FROM customers WHERE email = 'hapus@test.local'`).first<{ id: string }>();
    const start = new Date(Date.now() + 3 * 86_400_000);
    start.setUTCHours(8, 0, 0, 0); // 15.00 WIB (buka setiap hari)
    const { booking } = await createBooking(t.db, {
      branch: 'bogor-bantarjati', service: 'signature-haircut', startAt: start.toISOString(), customerId: cust!.id,
      source: 'admin', actor: { type: 'system', id: null },
    });
    expect((await req('/api/me', { method: 'DELETE', cookie })).status).toBe(200);
    const row = await t.db.prepare('SELECT name, email, phone, google_sub, anonymized_at FROM customers WHERE id = ?').bind(cust!.id).first<Record<string, unknown>>();
    expect(row).toMatchObject({ name: 'Pengguna dihapus', email: null, phone: null, google_sub: null });
    expect(row?.anonymized_at).toBeTruthy();
    const b = await t.db.prepare('SELECT status FROM bookings WHERE id = ?').bind(booking.id).first<{ status: string }>();
    expect(b?.status).toBe('cancelled');
    const slots = await t.db.prepare('SELECT COUNT(*) AS n FROM booking_slots WHERE booking_id = ?').bind(booking.id).first<{ n: number }>();
    expect(slots?.n).toBe(0);
    expect((await req('/api/me', { cookie })).status).toBe(401);
  });
});

describe('nomor WA + password (fitur nonaktif)', () => {
  it('endpoint ditolak saat flag mati', async () => {
    const res = await req('/api/auth/phone', { method: 'POST', body: JSON.stringify({ phone: '081234567890', password: 'rahasia123' }) });
    expect(res.status).toBe(404);
  });

  it('PBKDF2-SHA256: salt per pengguna, verifikasi benar/salah', async () => {
    const a = await hashPassword('rahasia123', 1000);
    const b = await hashPassword('rahasia123', 1000);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^pbkdf2-sha256\$1000\$/);
    expect(await verifyPassword('rahasia123', a)).toBe(true);
    expect(await verifyPassword('salah', a)).toBe(false);
  });
});

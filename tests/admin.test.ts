/** Tes API admin: Cloudflare Access wajib, hak akses per peran, walk-in, pelanggan, CSV, cuti barber. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../worker/index';
import { createBooking } from '../worker/lib/bookings';
import { createTestDb } from './helpers/d1';

const ORIGIN = 'http://localhost';
let t: Awaited<ReturnType<typeof createTestDb>>;
let env: Record<string, unknown>;
// Seed --dev-admin: owner@localhost (owner), admin.cabang@localhost (cabang 1), barber@localhost (barber id 2 = Dimas, cabang 1)
const OWNER = 'owner@localhost';
const BRANCH_ADMIN = 'admin.cabang@localhost';
const BARBER = 'barber@localhost';

const call = (as: string, path: string, init: { method?: string; json?: unknown } = {}) =>
  app.request(
    `${ORIGIN}/api/admin${path}`,
    {
      method: init.method ?? 'GET',
      headers: { 'x-dev-admin': as, origin: ORIGIN, ...(init.json ? { 'content-type': 'application/json' } : {}) },
      body: init.json ? JSON.stringify(init.json) : undefined,
    },
    env,
  );

/** Jadwal besok 15.00 WIB (selalu dalam jam kerja) */
const tomorrowAt = (h: number, m = 0) => {
  const d = new Date(Date.now() + 2 * 86_400_000);
  d.setUTCHours(h - 7, m, 0, 0);
  return d.toISOString();
};

beforeAll(async () => {
  t = await createTestDb();
  env = { DB: t.db, APP_ENV: 'development', ADMIN_DEV_EMAIL: OWNER, AUTH_PHONE_PASSWORD_ENABLED: 'false' };
  // Cabang 2 (Cibubur) diberi satu barber agar ada data lintas cabang
  await t.db.prepare(`INSERT INTO barbers (id, branch_id, name, is_active, sort_order) VALUES (50, 2, 'Barber Cibubur', 1, 1)`).run();
});
afterAll(async () => {
  await t?.dispose();
});

describe('akses', () => {
  it('staging/produksi tanpa konfigurasi Access → 503, tanpa JWT → 401', async () => {
    const r1 = await app.request(`${ORIGIN}/api/admin/me`, {}, { ...env, APP_ENV: 'staging' });
    expect(r1.status).toBe(503);
    const r2 = await app.request(`${ORIGIN}/api/admin/me`, {}, { ...env, APP_ENV: 'staging', ACCESS_TEAM_DOMAIN: 'cutless.cloudflareaccess.com', ACCESS_AUD: 'abc' });
    expect(r2.status).toBe(401);
    // Header dev diabaikan di luar development
    const r3 = await app.request(`${ORIGIN}/api/admin/me`, { headers: { 'x-dev-admin': OWNER } }, { ...env, APP_ENV: 'staging', ACCESS_TEAM_DOMAIN: 'cutless.cloudflareaccess.com', ACCESS_AUD: 'abc' });
    expect(r3.status).toBe(401);
  });

  it('email yang tidak terdaftar sebagai admin → 403', async () => {
    const r = await call('orang@luar.com', '/me');
    expect(r.status).toBe(403);
  });

  it('cakupan cabang: owner melihat semua cabang, admin cabang hanya cabangnya', async () => {
    const owner = (await (await call(OWNER, '/me')).json()) as { branches: unknown[] };
    const ba = (await (await call(BRANCH_ADMIN, '/me')).json()) as { branches: { id: number }[] };
    expect(owner.branches).toHaveLength(2);
    expect(ba.branches.map((b) => b.id)).toEqual([1]);
    const forbidden = await call(BRANCH_ADMIN, '/branches/2/settings', {
      method: 'PUT',
      json: { booking_lead_min: 30, booking_max_days: 7, cancel_deadline_min: 60, require_manual_confirmation: false },
    });
    expect(forbidden.status).toBe(403);
    expect((await call(BRANCH_ADMIN, '/admin-users')).status).toBe(403);
    expect((await call(OWNER, '/admin-users')).status).toBe(200);
  });
});

describe('booking oleh admin', () => {
  it('walk-in tamu tanpa akun: dibuat pelanggan tamu (tidak bisa login), sumber walk_in', async () => {
    const r = await call(BRANCH_ADMIN, '/bookings', {
      method: 'POST',
      json: { branch: 1, service: 1, barber: 3, startAt: tomorrowAt(15), source: 'walk_in', guestName: 'Tamu Jalan', guestPhone: '0812 5555 0001', note: 'datang langsung' },
    });
    expect(r.status).toBe(201);
    const { booking } = (await r.json()) as { booking: { source: string; status: string; customer_id: string } };
    expect(booking.source).toBe('walk_in');
    expect(booking.status).toBe('confirmed');
    const guest = await t.db.prepare('SELECT is_guest, google_sub, phone FROM customers WHERE id = ?').bind(booking.customer_id).first();
    expect(guest).toEqual({ is_guest: 1, google_sub: null, phone: '6281255550001' });
  });

  it('jadwal: admin cabang tidak melihat cabang lain; barber hanya bookingnya sendiri', async () => {
    await call(OWNER, '/bookings', { method: 'POST', json: { branch: 1, service: 1, barber: 2, startAt: tomorrowAt(16), guestName: 'Untuk Dimas', guestPhone: '081255550002' } });
    const day = tomorrowAt(12).slice(0, 10);
    const q = `/bookings?from=${day}&to=${day}`;
    const all = (await (await call(OWNER, q)).json()) as { bookings: { barber_id: number }[] };
    const mine = (await (await call(BARBER, q)).json()) as { bookings: { barber_id: number }[] };
    expect(all.bookings.length).toBeGreaterThanOrEqual(2);
    expect(mine.bookings.length).toBeGreaterThanOrEqual(1);
    expect(mine.bookings.every((b) => b.barber_id === 2)).toBe(true);
    const otherBranch = await call(BRANCH_ADMIN, `/bookings?from=${day}&to=${day}&branch=2`);
    expect(((await otherBranch.json()) as { bookings: { branch_id: number }[] }).bookings.every((b) => b.branch_id === 1)).toBe(true);
  });

  it('barber tidak boleh membatalkan; admin wajib alasan saat batal', async () => {
    const day = tomorrowAt(12).slice(0, 10);
    const { bookings } = (await (await call(BARBER, `/bookings?from=${day}&to=${day}`)).json()) as { bookings: { id: string }[] };
    const id = bookings[0].id;
    expect((await call(BARBER, `/bookings/${id}/status`, { method: 'POST', json: { status: 'cancelled', reason: 'x' } })).status).toBe(403);
    expect((await call(BRANCH_ADMIN, `/bookings/${id}/status`, { method: 'POST', json: { status: 'cancelled' } })).status).toBe(400);
    const ok = await call(BRANCH_ADMIN, `/bookings/${id}/status`, { method: 'POST', json: { status: 'cancelled', reason: 'Pelanggan minta batal via telepon' } });
    expect(ok.status).toBe(200);
    const audit = await t.db.prepare(`SELECT actor_id FROM audit_log WHERE entity_id = ? AND action = 'booking.cancelled'`).bind(id).first<{ actor_id: string }>();
    expect(audit?.actor_id).toBe(BRANCH_ADMIN);
  });
});

describe('pelanggan & laporan', () => {
  it('buka blokir mereset no-show; cari pelanggan dengan nomor 08…', async () => {
    await t.db.prepare(`UPDATE customers SET status = 'blocked', no_show_count = 3 WHERE id = 'test-cust-1'`).run();
    await createBooking(t.db, { branch: 1, service: 1, barberId: 4, startAt: tomorrowAt(17), customerId: 'test-cust-1', source: 'admin', actor: { type: 'system', id: null } });
    const found = (await (await call(BRANCH_ADMIN, '/customers?q=0812000')).json()) as { customers: { id: string }[] };
    expect(found.customers.map((c) => c.id)).toContain('test-cust-1');
    expect((await call(BRANCH_ADMIN, '/customers/test-cust-1/unblock', { method: 'POST' })).status).toBe(200);
    const row = await t.db.prepare(`SELECT status, no_show_count FROM customers WHERE id = 'test-cust-1'`).first();
    expect(row).toEqual({ status: 'active', no_show_count: 0 });
    expect((await call(BARBER, '/customers?q=budi')).status).toBe(403);
  });

  it('ekspor CSV: kolom lengkap, formula tidak dieksekusi', async () => {
    await t.db.prepare(`UPDATE bookings SET customer_note = '=HYPERLINK("x")' WHERE id = (SELECT id FROM bookings LIMIT 1)`).run();
    const day = tomorrowAt(12).slice(0, 10);
    const r = await call(OWNER, `/reports/export.csv?from=${day}&to=${day}`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/csv');
    const text = await r.text();
    expect(text).toContain('kode,cabang,tanggal,jam_mulai,layanan');
    expect(text).not.toMatch(/(^|,)=HYPERLINK/m);
  });

  it('ringkasan', async () => {
    const r = await call(OWNER, '/reports/summary');
    const json = (await r.json()) as { branches: unknown[]; popularServices: unknown[] };
    expect(r.status).toBe(200);
    expect(json.branches).toHaveLength(2);
  });
});

describe('cuti barber', () => {
  it('barber mengajukan cuti → pending (belum memblokir jadwal) → disetujui admin cabang', async () => {
    const start = tomorrowAt(18);
    const end = tomorrowAt(20);
    const r = await call(BARBER, '/time-off', { method: 'POST', json: { barber_id: 2, start_at: start, end_at: end, reason: 'cuti' } });
    expect(r.status).toBe(201);
    const { id, status } = (await r.json()) as { id: number; status: string };
    expect(status).toBe('pending');
    expect((await call(BARBER, '/time-off', { method: 'POST', json: { barber_id: 3, start_at: start, end_at: end, reason: 'cuti' } })).status).toBe(403);
    const day = start.slice(0, 10);
    const avail = async () =>
      ((await (await call(OWNER, `/availability?branch=1&service=1&barber=2&date=${day}`)).json()) as { slots: { time: string }[] }).slots.map((s) => s.time);
    expect(await avail()).toContain('18:30');
    expect((await call(BRANCH_ADMIN, `/time-off/${id}/approve`, { method: 'POST' })).status).toBe(200);
    expect(await avail()).not.toContain('18:30');
  });
});

/** Cutless Stamp: stempel saat Selesai, pengecualian, batas harian (zona waktu cabang), hadiah 5 & 10, cron, gabung tamu, voucher. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../worker/index';
import { runScheduled } from '../worker/cron';
import { createTestDb } from './helpers/d1';
import { CODE_ATTEMPTS, setVoucherCodeGenerator } from '../worker/lib/loyalty';

const ORIGIN = 'http://localhost';
const OWNER = 'owner@localhost';
const BRANCH_ADMIN = 'admin.cabang@localhost'; // cabang 1
const BARBER = 'barber@localhost';
let t: Awaited<ReturnType<typeof createTestDb>>;
let env: Record<string, unknown>;
let svc: { haircut: number; wash: number; towel: number; paket: number };
let barber1: number; // barber milik akun barber@localhost (cabang 1)
const BARBER2 = 80; // barber cabang 2

const api = async <T = Record<string, unknown>>(as: string, path: string, init: { method?: string; json?: unknown } = {}, e = env) => {
  const r = await app.request(
    `${ORIGIN}/api/admin${path}`,
    {
      method: init.method ?? 'GET',
      headers: { 'x-dev-admin': as, origin: ORIGIN, ...(init.json ? { 'content-type': 'application/json' } : {}) },
      body: init.json ? JSON.stringify(init.json) : undefined,
    },
    e,
  );
  return { status: r.status, body: (await r.json().catch(() => ({}))) as T };
};

let seq = 0;
const uid = (p: string) => `${p}-${++seq}`;

async function customer(opts: { guest?: boolean; phone?: string; name?: string } = {}) {
  const id = uid('lc');
  await t.db
    .prepare(`INSERT INTO customers (id, name, phone, is_guest, privacy_consent_at) VALUES (?, ?, ?, ?, '2026-01-01T00:00:00.000Z')`)
    .bind(id, opts.name ?? `Pelanggan ${id}`, opts.phone ?? null, opts.guest ? 1 : 0)
    .run();
  return id;
}

/** Booking lampau berstatus confirmed (siap ditandai Selesai) */
async function booking(customerId: string, startIso: string, o: { service?: number; branch?: number; barber?: number; status?: string; price?: number } = {}) {
  const id = uid('lb');
  const start = Date.parse(startIso);
  await t.db
    .prepare(
      `INSERT INTO bookings (id, code, branch_id, barber_id, service_id, customer_id, start_at, end_at, price_snapshot, duration_snapshot, service_name_snapshot, status, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 45, 'Layanan uji', ?, 'admin')`,
    )
    .bind(id, `LY${String(seq).padStart(6, '0')}`, o.branch ?? 1, o.barber ?? barber1, o.service ?? svc.haircut, customerId, startIso, new Date(start + 45 * 60_000).toISOString(), o.price ?? 100000, o.status ?? 'confirmed')
    .run();
  return id;
}

const complete = (id: string, as = OWNER, e = env) => api(as, `/bookings/${id}/status`, { method: 'POST', json: { status: 'completed' } }, e);
const day = (n: number, hourUtc = 3) => new Date(Date.UTC(2026, 0, 1 + n, hourUtc, 0, 0)).toISOString(); // tanggal lampau berbeda

const stamps = async (customerId: string, status = 'active') =>
  (await t.db.prepare('SELECT COUNT(*) AS n FROM loyalty_stamps WHERE customer_id = ? AND status = ?').bind(customerId, status).first<{ n: number }>())!.n;
const vouchers = (customerId: string) =>
  t.db.prepare('SELECT * FROM loyalty_vouchers WHERE customer_id = ? ORDER BY tier, issued_at').bind(customerId).all<{ id: string; tier: number; status: string; code: string; expires_at: string; redeemed_booking_id: string | null }>().then((r) => r.results);
const loyaltyRows = async () => {
  const one = async (tbl: string) => (await t.db.prepare(`SELECT COUNT(*) AS n FROM ${tbl}`).first<{ n: number }>())!.n;
  return (await one('loyalty_stamps')) + (await one('loyalty_vouchers')) + (await one('loyalty_cards'));
};

async function setProgram(enabled: boolean, extra: Record<string, unknown> = {}) {
  const r = await api(OWNER, '/loyalty/settings', {
    method: 'PUT',
    json: { enabled, tier1_stamps: 5, tier1_service_ids: [svc.wash, svc.towel], tier2_stamps: 10, tier2_service_ids: [svc.haircut], stamp_valid_months: 12, voucher_valid_days: 60, ...extra },
  });
  expect(r.status).toBe(200);
}

beforeAll(async () => {
  t = await createTestDb();
  env = { DB: t.db, APP_ENV: 'development', ADMIN_DEV_EMAIL: OWNER, AUTH_MOCK_ENABLED: 'true', AUTH_PHONE_PASSWORD_ENABLED: 'false', LOYALTY_ENABLED: 'true' };
  const id = async (slug: string) => (await t.db.prepare('SELECT id FROM services WHERE slug = ?').bind(slug).first<{ id: number }>())!.id;
  svc = { haircut: await id('signature-haircut'), wash: await id('hair-wash-styling'), towel: await id('hot-towel-shave'), paket: await id('student-deal') };
  barber1 = (await t.db.prepare(`SELECT barber_id FROM admin_users WHERE email = ?`).bind(BARBER).first<{ barber_id: number }>())!.barber_id;
  await t.db.prepare(`INSERT INTO barbers (id, branch_id, name, is_active, sort_order) VALUES (?, 2, 'Barber Cabang 2', 1, 1)`).bind(BARBER2).run();
});
afterAll(async () => {
  await t?.dispose();
});

describe('flag mati = tidak ada efek', () => {
  it('env LOYALTY_ENABLED kosong atau program nonaktif → Selesai tidak menulis baris loyalty apa pun', async () => {
    const off = { ...env, LOYALTY_ENABLED: undefined };
    const c = await customer();
    const before = await loyaltyRows();
    expect((await complete(await booking(c, day(0)), OWNER, off)).status).toBe(200);
    expect(await loyaltyRows()).toBe(before);
    // env aktif, program masih mati (default migrasi)
    expect((await complete(await booking(c, day(1)))).status).toBe(200);
    expect(await loyaltyRows()).toBe(before);
    const me = await app.request(`${ORIGIN}/api/loyalty/program`, {}, env);
    expect(await me.json()).toEqual({ enabled: false });
  });
});

describe('stempel', () => {
  beforeEach(async () => setProgram(true));

  it('Selesai → 1 stempel (tanggal lokal cabang, dicatat siapa & di audit); dua kali tetap 1', async () => {
    const c = await customer();
    const b = await booking(c, '2026-02-01T03:00:00.000Z');
    expect((await complete(b, BARBER)).status).toBe(200);
    const row = await t.db.prepare('SELECT * FROM loyalty_stamps WHERE booking_id = ?').bind(b).first<{ stamp_date: string; created_by: string; status: string }>();
    expect(row).toMatchObject({ stamp_date: '2026-02-01', created_by: BARBER, status: 'active' });
    const audit = await t.db.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE action = 'loyalty.stamp' AND entity_id = ?`).bind(b).first<{ n: number }>();
    expect(audit!.n).toBe(1);
    expect((await complete(b)).status).toBe(409); // status sudah completed
    expect(await stamps(c)).toBe(1);
  });

  it('tidak dapat stempel: batal, tidak datang, layanan paket', async () => {
    const c = await customer();
    expect((await api(OWNER, `/bookings/${await booking(c, day(10))}/status`, { method: 'POST', json: { status: 'cancelled', reason: 'uji' } })).status).toBe(200);
    expect((await api(OWNER, `/bookings/${await booking(c, day(11))}/status`, { method: 'POST', json: { status: 'no_show' } })).status).toBe(200);
    expect((await complete(await booking(c, day(12), { service: svc.paket }))).status).toBe(200);
    expect(await stamps(c)).toBe(0);
  });

  it('maks. 1 stempel per pelanggan per tanggal lokal, lintas cabang; batas tengah malam mengikuti zona waktu cabang', async () => {
    const c = await customer();
    // 23.30 WIB 10 Mar & 00.15 WIB 11 Mar → dua tanggal lokal berbeda (UTC-nya sama-sama 10 Mar)
    await complete(await booking(c, '2026-03-10T16:30:00.000Z'));
    await complete(await booking(c, '2026-03-10T17:15:00.000Z'));
    expect(await stamps(c)).toBe(2);
    // 10.00 WIB 11 Mar di cabang lain → tanggal lokal sama dengan 00.15 WIB → tidak dapat
    await complete(await booking(c, '2026-03-11T03:00:00.000Z', { branch: 2, barber: BARBER2 }));
    expect(await stamps(c)).toBe(2);
    const dates = (await t.db.prepare('SELECT stamp_date FROM loyalty_stamps WHERE customer_id = ? ORDER BY stamp_date').bind(c).all<{ stamp_date: string }>()).results.map((r) => r.stamp_date);
    expect(dates).toEqual(['2026-03-10', '2026-03-11']);

    // Cabang zona WITA (UTC+8): 16.30Z = 00.30 WITA keesokan harinya
    await t.db.prepare(`UPDATE branches SET timezone = 'Asia/Makassar' WHERE id = 2`).run();
    try {
      const c2 = await customer();
      const b = await booking(c2, '2026-03-12T16:30:00.000Z', { branch: 2, barber: BARBER2 });
      await complete(b);
      const row = await t.db.prepare('SELECT stamp_date FROM loyalty_stamps WHERE booking_id = ?').bind(b).first<{ stamp_date: string }>();
      expect(row!.stamp_date).toBe('2026-03-13');
    } finally {
      await t.db.prepare(`UPDATE branches SET timezone = 'Asia/Jakarta' WHERE id = 2`).run();
    }
  });

  it('voucher terbit di stempel ke-5 & ke-10, lalu kartu kembali ke 0 (siklus baru)', async () => {
    const c = await customer();
    for (let i = 0; i < 4; i++) await complete(await booking(c, day(30 + i)));
    expect(await vouchers(c)).toHaveLength(0);
    await complete(await booking(c, day(34)));
    let v = await vouchers(c);
    expect(v.map((x) => x.tier)).toEqual([1]);
    expect(v[0].code).toMatch(/^CS-[A-HJ-NP-Z2-9]{6}$/);
    for (let i = 5; i < 9; i++) await complete(await booking(c, day(30 + i)));
    expect((await vouchers(c)).map((x) => x.tier)).toEqual([1]);
    await complete(await booking(c, day(39)));
    v = await vouchers(c);
    expect(v.map((x) => x.tier)).toEqual([1, 2]);
    expect(await stamps(c, 'active')).toBe(0);
    expect(await stamps(c, 'used')).toBe(10);
    const card = await api<{ card: { stamps: number; cycle: number } }>(OWNER, `/customers/${c}/loyalty`);
    expect(card.body.card).toMatchObject({ stamps: 0, cycle: 1 });
    // Siklus baru mulai menghitung dari 1
    await complete(await booking(c, day(40)));
    expect(await stamps(c, 'active')).toBe(1);
    expect((await vouchers(c)).length).toBe(2);
  });
});

describe('voucher', () => {
  beforeEach(async () => setProgram(true));

  async function withVoucher(tierServices = [svc.wash, svc.towel], expiresAt = '2099-01-01T00:00:00.000Z') {
    const c = await customer();
    const vid = uid('lv');
    await t.db
      .prepare(`INSERT INTO loyalty_vouchers (id, code, customer_id, issue_key, tier, service_ids, status, issued_at, expires_at) VALUES (?, ?, ?, ?, 1, ?, 'active', '2026-01-01T00:00:00.000Z', ?)`)
      .bind(vid, `CS-T${String(seq).padStart(5, '0')}`, c, `${c}:0:1`, JSON.stringify(tierServices), expiresAt)
      .run();
    return { c, vid };
  }

  it('ditukar admin: harga Rp0, booking itu tidak dapat stempel; tidak bisa ditukar dua kali', async () => {
    const { c, vid } = await withVoucher();
    const b = await booking(c, day(60), { service: svc.wash, price: 35000 });
    expect((await api(OWNER, `/bookings/${b}/voucher`, { method: 'POST', json: { voucherId: vid } })).status).toBe(200);
    const row = await t.db.prepare('SELECT price_snapshot FROM bookings WHERE id = ?').bind(b).first<{ price_snapshot: number }>();
    expect(row!.price_snapshot).toBe(0);
    // Sekali lagi di booking lain → ditolak
    const b2 = await booking(c, day(61), { service: svc.wash });
    const again = await api<{ error: { code: string } }>(OWNER, `/bookings/${b2}/voucher`, { method: 'POST', json: { voucherId: vid } });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('VOUCHER_UNAVAILABLE');
    await complete(b);
    expect(await stamps(c)).toBe(0);
    expect((await vouchers(c))[0]).toMatchObject({ status: 'redeemed', redeemed_booking_id: b });
  });

  it('layanan tidak cocok / kedaluwarsa → ditolak', async () => {
    const { c, vid } = await withVoucher();
    const wrong = await booking(c, day(62), { service: svc.haircut });
    expect((await api(OWNER, `/bookings/${wrong}/voucher`, { method: 'POST', json: { voucherId: vid } })).status).toBe(409);
    const exp = await withVoucher(undefined, '2026-01-02T00:00:00.000Z');
    const b = await booking(exp.c, day(63), { service: svc.wash });
    expect((await api(OWNER, `/bookings/${b}/voucher`, { method: 'POST', json: { voucherId: exp.vid } })).status).toBe(409);
  });

  it('admin cabang hanya bisa menukar di cabangnya', async () => {
    const { c, vid } = await withVoucher();
    const other = await booking(c, day(64), { service: svc.wash, branch: 2, barber: BARBER2 });
    expect((await api(BRANCH_ADMIN, `/bookings/${other}/voucher`, { method: 'POST', json: { voucherId: vid } })).status).toBe(403);
    const own = await booking(c, day(65), { service: svc.wash });
    expect((await api(BRANCH_ADMIN, `/bookings/${own}/voucher`, { method: 'POST', json: { voucherId: vid } })).status).toBe(200);
  });

  it('booking batal / tidak datang → voucher aktif lagi & harga pulih; bila sudah lewat masa berlaku → expired', async () => {
    const a = await withVoucher();
    const b1 = await booking(a.c, day(66), { service: svc.wash, price: 35000 });
    await api(OWNER, `/bookings/${b1}/voucher`, { method: 'POST', json: { voucherId: a.vid } });
    await api(OWNER, `/bookings/${b1}/status`, { method: 'POST', json: { status: 'cancelled', reason: 'uji' } });
    expect((await vouchers(a.c))[0]).toMatchObject({ status: 'active', redeemed_booking_id: null });
    expect((await t.db.prepare('SELECT price_snapshot FROM bookings WHERE id = ?').bind(b1).first<{ price_snapshot: number }>())!.price_snapshot).toBe(35000);

    const z = await withVoucher();
    const b2 = await booking(z.c, day(67), { service: svc.wash });
    await api(OWNER, `/bookings/${b2}/voucher`, { method: 'POST', json: { voucherId: z.vid } });
    // Masa berlaku habis setelah ditukar, lalu pelanggan tidak datang
    await t.db.prepare(`UPDATE loyalty_vouchers SET expires_at = '2026-01-02T00:00:00.000Z' WHERE id = ?`).bind(z.vid).run();
    await api(OWNER, `/bookings/${b2}/status`, { method: 'POST', json: { status: 'no_show' } });
    expect((await vouchers(z.c))[0]).toMatchObject({ status: 'expired', redeemed_booking_id: null });
  });

  it('cron harian menghanguskan stempel & voucher yang lewat masa berlaku', async () => {
    const c = await customer();
    await complete(await booking(c, day(70)));
    const { vid } = await withVoucher();
    await t.db.prepare(`UPDATE loyalty_stamps SET expires_at = '2026-01-05T00:00:00.000Z' WHERE customer_id = ?`).bind(c).run();
    await t.db.prepare(`UPDATE loyalty_vouchers SET expires_at = '2026-01-05T00:00:00.000Z' WHERE id = ?`).bind(vid).run();
    await runScheduled(env as never, '0 19 * * *', Date.parse('2026-06-01T19:00:00.000Z'));
    expect(await stamps(c, 'expired')).toBe(1);
    expect((await t.db.prepare('SELECT status FROM loyalty_vouchers WHERE id = ?').bind(vid).first<{ status: string }>())!.status).toBe('expired');
  });
});

describe('gabung tamu → akun & penyesuaian manual', () => {
  beforeEach(async () => setProgram(true));

  it('stempel & voucher tamu bernomor sama digabung (dijalankan dua kali tetap sama, tercatat audit sekali)', async () => {
    const phone = '6281299990001';
    const guest = await customer({ guest: true, phone });
    for (let i = 0; i < 3; i++) await complete(await booking(guest, day(80 + i)));
    const acc = await customer({ phone });
    // Akun sudah punya stempel di tanggal yang sama dengan salah satu stempel tamu
    await complete(await booking(acc, day(80, 10)));

    const view = await api<{ mergeCandidates: { id: string; stamps: number }[] }>(OWNER, `/customers/${acc}/loyalty`);
    expect(view.body.mergeCandidates).toEqual([expect.objectContaining({ id: guest, stamps: 3 })]);
    const r1 = await api<{ moved: { stamps: number } }>(OWNER, `/customers/${acc}/loyalty/merge`, { method: 'POST', json: { guestId: guest } });
    expect(r1.body.moved.stamps).toBe(2);
    expect(await stamps(acc)).toBe(3); // 1 milik akun + 2 dari tamu (tanggal bentrok tidak dipindah)
    const r2 = await api<{ moved: { stamps: number; vouchers: number } }>(OWNER, `/customers/${acc}/loyalty/merge`, { method: 'POST', json: { guestId: guest } });
    expect(r2.body.moved).toEqual({ stamps: 0, vouchers: 0 });
    expect(await stamps(acc)).toBe(3);
    const audits = await t.db.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE action = 'loyalty.merge' AND entity_id = ?`).bind(acc).first<{ n: number }>();
    expect(audits!.n).toBe(1);
  });

  it('nomor dipakai dua akun terdaftar → tidak ada kandidat gabung', async () => {
    const phone = '6281299990002';
    const guest = await customer({ guest: true, phone });
    await complete(await booking(guest, day(90)));
    const a = await customer({ phone });
    await customer({ phone });
    const view = await api<{ mergeCandidates: unknown[] }>(OWNER, `/customers/${a}/loyalty`);
    expect(view.body.mergeCandidates).toEqual([]);
  });

  it('penyesuaian manual: owner saja, alasan wajib, tercatat audit', async () => {
    const c = await customer();
    await complete(await booking(c, day(95)));
    expect((await api(OWNER, `/customers/${c}/loyalty/adjust`, { method: 'POST', json: { delta: 1, reason: '' } })).status).toBe(400);
    expect((await api(BRANCH_ADMIN, `/customers/${c}/loyalty/adjust`, { method: 'POST', json: { delta: 1, reason: 'Kompensasi' } })).status).toBe(403);
    expect((await api(OWNER, `/customers/${c}/loyalty/adjust`, { method: 'POST', json: { delta: 1, reason: 'Kompensasi keluhan' } })).status).toBe(200);
    expect(await stamps(c)).toBe(2);
    expect((await api(OWNER, `/customers/${c}/loyalty/adjust`, { method: 'POST', json: { delta: -1, reason: 'Salah input' } })).status).toBe(200);
    expect(await stamps(c)).toBe(1);
    const audits = await t.db.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE action = 'loyalty.adjust' AND entity_id = ?`).bind(c).first<{ n: number }>();
    expect(audits!.n).toBe(2);
  });
});

describe('pelanggan & ringkasan', () => {
  beforeEach(async () => setProgram(true));

  it('GET /me/loyalty: kartu & voucher aktif; riwayat stempel berhalaman', async () => {
    const email = 'loyal@test.local';
    const login = await app.request(`${ORIGIN}/api/auth/mock?email=${encodeURIComponent(email)}&next=/booking/`, {}, env);
    const cookie = `cutless_session=${login.headers.get('set-cookie')?.match(/cutless_session=([^;]+)/)?.[1]}`;
    const me = (await t.db.prepare('SELECT id FROM customers WHERE email = ?').bind(email).first<{ id: string }>())!.id;
    for (let i = 0; i < 6; i++) await complete(await booking(me, day(100 + i)));
    const r = (await (await app.request(`${ORIGIN}/api/me/loyalty`, { headers: { cookie } }, env)).json()) as {
      card: { stamps: number; next: { tier: number; remaining: number } };
      vouchers: { tier: number; services: string[] }[];
    };
    expect(r.card).toMatchObject({ stamps: 6, next: { tier: 2, remaining: 4 } });
    expect(r.vouchers).toEqual([expect.objectContaining({ tier: 1, services: expect.arrayContaining(['Hair Wash & Styling']) })]);
    const p1 = (await (await app.request(`${ORIGIN}/api/me/loyalty/stamps?limit=4`, { headers: { cookie } }, env)).json()) as { stamps: unknown[]; nextCursor: string };
    const p2 = (await (await app.request(`${ORIGIN}/api/me/loyalty/stamps?limit=4&cursor=${p1.nextCursor}`, { headers: { cookie } }, env)).json()) as { stamps: unknown[]; nextCursor: null };
    expect([p1.stamps.length, p2.stamps.length, p2.nextCursor]).toEqual([4, 2, null]);
  });

  it('ringkasan: stempel per admin/hairstylist (30 hari)', async () => {
    const c = await customer();
    // created_at stempel = waktu sekarang → masuk 30 hari terakhir
    await complete(await booking(c, day(120)), BARBER);
    await complete(await booking(c, day(121)), OWNER);
    const r = await api<{ loyalty: { stamps: number; stampsByAdmin: { admin: string; kind: string; n: number }[] } }>(OWNER, '/reports/summary');
    const byAdmin = Object.fromEntries(r.body.loyalty.stampsByAdmin.filter((x) => x.kind === 'booking').map((x) => [x.admin, x.n]));
    expect(byAdmin[BARBER]).toBeGreaterThanOrEqual(2);
    expect(byAdmin[OWNER]).toBeGreaterThanOrEqual(1);
  });
});

describe('tabrakan kode voucher', () => {
  const TAKEN = 'CS-AAAAAA';
  beforeAll(async () => {
    await setProgram(true);
    const owner = await customer();
    await t.db
      .prepare(`INSERT INTO loyalty_vouchers (id, code, customer_id, issue_key, tier, service_ids, status, issued_at, expires_at) VALUES ('taken', ?, ?, 'taken:0:1', 1, '[]', 'active', '2026-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z')`)
      .bind(TAKEN, owner)
      .run();
  });
  afterEach(() => setVoucherCodeGenerator());

  const failures = async (c: string) =>
    (await t.db.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE action = 'loyalty.voucher_issue_failed' AND entity_id = ?`).bind(c).first<{ n: number }>())!.n;

  it('kode bentrok → dicoba kandidat berikutnya; voucher tetap terbit', async () => {
    const c = await customer();
    for (let i = 0; i < 4; i++) await complete(await booking(c, day(150 + i)));
    // Hanya kandidat ke-5 tiap voucher yang belum dipakai
    let calls = 0;
    setVoucherCodeGenerator(() => (++calls % CODE_ATTEMPTS === 0 ? `CS-NEW${String(calls).padStart(3, '0')}` : TAKEN));
    expect((await complete(await booking(c, day(154)))).status).toBe(200);
    const v = await vouchers(c);
    expect(v).toHaveLength(1);
    expect(v[0].code).toMatch(/^CS-NEW\d{3}$/);
    expect(await failures(c)).toBe(0);
  });

  it('semua kandidat bentrok → Selesai tetap berhasil, kegagalan dicatat & tampil di Ringkasan, lalu terbit di stempel berikutnya', async () => {
    const c = await customer();
    for (let i = 0; i < 4; i++) await complete(await booking(c, day(160 + i)));
    setVoucherCodeGenerator(() => TAKEN);
    const b = await booking(c, day(164));
    expect((await complete(b)).status).toBe(200);
    expect((await t.db.prepare('SELECT status FROM bookings WHERE id = ?').bind(b).first<{ status: string }>())!.status).toBe('completed');
    expect(await stamps(c)).toBe(5);
    expect(await vouchers(c)).toHaveLength(0);
    expect(await failures(c)).toBe(1);
    const sum = await api<{ loyalty: { voucherIssueFailures: number } }>(OWNER, '/reports/summary');
    expect(sum.body.loyalty.voucherIssueFailures).toBeGreaterThanOrEqual(1);

    // Generator normal lagi: stempel berikutnya menerbitkan voucher yang tertunda (tanpa duplikat)
    setVoucherCodeGenerator();
    await complete(await booking(c, day(165)));
    const v = await vouchers(c);
    expect(v.map((x) => x.tier)).toEqual([1]);
    expect(v[0].code).toMatch(/^CS-[A-HJ-NP-Z2-9]{6}$/);
    expect(await failures(c)).toBe(1);
  });
});

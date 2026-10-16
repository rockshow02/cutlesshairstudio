/**
 * Tes integrasi D1 (lokal): anti-bentrok, konkurensi, transisi status, jadwal ulang, batas per akun.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBooking, rescheduleBooking, transitionBooking } from '../worker/lib/bookings';
import { loadAvailability, getBranch, getBranchService } from '../worker/lib/availability';
import { ApiError } from '../worker/lib/errors';
import { app } from '../worker/index';
import { createTestDb } from './helpers/d1';

// Senin 19 Okt 2026 06.00 WIB; cabang Bogor (id 1) buka 10.00–21.00, barber aktif id 2–5
const NOW = Date.parse('2026-10-18T23:00:00Z');
const at = (hhmm: string, date = '2026-10-19') => new Date(`${date}T${hhmm}:00+07:00`).toISOString();
const SYSTEM = { type: 'system' as const, id: null };

let t: Awaited<ReturnType<typeof createTestDb>>;
let db: D1Database;

async function newCustomer(id: string) {
  await db.prepare(`INSERT INTO customers (id, google_sub, email, name, phone, privacy_consent_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, `mock:${id}`, `${id}@test.local`, `Pelanggan ${id}`, '6281299990000', new Date().toISOString())
    .run();
  return id;
}

const book = (customerId: string, startAt: string, barberId?: number, service = 'signature-haircut') =>
  createBooking(db, { branch: 'bogor-bantarjati', service, barberId, startAt, customerId, source: 'online', actor: { type: 'customer', id: customerId }, now: NOW });

async function expectApiError(p: Promise<unknown>, code: string) {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
  return err as ApiError;
}

beforeAll(async () => {
  t = await createTestDb();
  db = t.db;
});
afterAll(async () => {
  await t?.dispose();
});

describe('anti-bentrok', () => {
  it('10 request bersamaan untuk jam & barber yang sama: hanya 1 berhasil, sisanya 409 + 3 slot terdekat', async () => {
    const customers = await Promise.all(Array.from({ length: 10 }, (_, i) => newCustomer(`race-${i}`)));
    const results = await Promise.allSettled(customers.map((c) => book(c, at('15:00'), 2)));
    const ok = results.filter((r) => r.status === 'fulfilled');
    const fail = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(9);
    for (const f of fail) {
      expect(f.reason).toBeInstanceOf(ApiError);
      expect(f.reason.code).toBe('SLOT_TAKEN');
      expect(f.reason.status).toBe(409);
      expect(f.reason.details.alternatives).toHaveLength(3);
    }
    const rows = await db.prepare(`SELECT COUNT(*) AS n FROM bookings WHERE barber_id = 2 AND start_at = ?`).bind(at('15:00')).first<{ n: number }>();
    expect(rows?.n).toBe(1);
    // 45 menit + buffer 10 = 4 blok 15 menit
    const slots = await db.prepare(`SELECT COUNT(*) AS n FROM booking_slots WHERE barber_id = 2 AND slot_start >= ? AND slot_start < ?`).bind(at('15:00'), at('16:00')).first<{ n: number }>();
    expect(slots?.n).toBe(4);
  });

  it('batch atomik: pelanggaran UNIQUE membatalkan booking & semua slotnya', async () => {
    const c = await newCustomer('atomic');
    const before = await db.prepare('SELECT COUNT(*) AS n FROM bookings').first<{ n: number }>();
    const err = await db
      .batch([
        db.prepare(`INSERT INTO bookings (id, code, branch_id, barber_id, service_id, customer_id, start_at, end_at, price_snapshot, duration_snapshot, service_name_snapshot, status, source)
                    VALUES ('x-atomic', 'ZZZZZZZZ', 1, 2, 1, ?, ?, ?, 1, 45, 'x', 'confirmed', 'online')`).bind(c, at('15:30'), at('16:15')),
        db.prepare(`INSERT INTO booking_slots (booking_id, barber_id, slot_start) VALUES ('x-atomic', 2, ?)`).bind(new Date(at('15:15')).toISOString()),
      ])
      .then(() => null, (e) => e);
    expect(String(err)).toContain('UNIQUE');
    const after = await db.prepare('SELECT COUNT(*) AS n FROM bookings').first<{ n: number }>();
    expect(after?.n).toBe(before?.n);
  });

  it('"Siapa saja" memilih barber lain bila barber pertama penuh', async () => {
    const c = await newCustomer('any-1');
    const { booking } = await book(c, at('15:00'));
    expect(booking.barber_id).not.toBe(2);
  });

  it('jam di luar slot (mis. jam istirahat) → 409', async () => {
    const c = await newCustomer('outside');
    await expectApiError(book(c, at('13:15'), 3), 'SLOT_TAKEN');
  });
});

describe('transisi status & jadwal ulang', () => {
  it('batal oleh pelanggan melepas slot; jam itu bisa dibooking lagi', async () => {
    const a = await newCustomer('cancel-a');
    const { booking } = await book(a, at('17:00'), 3);
    await transitionBooking(db, { bookingId: booking.id, to: 'cancelled', actor: 'customer', audit: { type: 'customer', id: a }, now: NOW });
    const left = await db.prepare('SELECT COUNT(*) AS n FROM booking_slots WHERE booking_id = ?').bind(booking.id).first<{ n: number }>();
    expect(left?.n).toBe(0);
    const b = await newCustomer('cancel-b');
    const again = await book(b, at('17:00'), 3);
    expect(again.booking.status).toBe('confirmed');
  });

  it('pelanggan tidak bisa batal setelah batas cancel_deadline_min (120 menit)', async () => {
    const c = await newCustomer('late');
    const { booking } = await book(c, at('18:00'), 4);
    const nearStart = Date.parse(at('16:30')); // 90 menit sebelum
    await expectApiError(
      transitionBooking(db, { bookingId: booking.id, to: 'cancelled', actor: 'customer', audit: SYSTEM, now: nearStart }),
      'DEADLINE_PASSED',
    );
  });

  it('transisi tidak sah ditolak; no-show baru boleh 15 menit setelah mulai & menambah hitungan', async () => {
    const c = await newCustomer('noshow');
    const { booking } = await book(c, at('19:00'), 4);
    await expectApiError(transitionBooking(db, { bookingId: booking.id, to: 'confirmed', actor: 'admin', audit: SYSTEM, now: NOW }), 'INVALID_TRANSITION');
    await expectApiError(
      transitionBooking(db, { bookingId: booking.id, to: 'no_show', actor: 'admin', audit: SYSTEM, now: Date.parse(at('19:10')) }),
      'INVALID_TRANSITION',
    );
    const done = await transitionBooking(db, { bookingId: booking.id, to: 'no_show', actor: 'admin', audit: SYSTEM, now: Date.parse(at('19:20')) });
    expect(done.status).toBe('no_show');
    const cust = await db.prepare('SELECT no_show_count FROM customers WHERE id = ?').bind(c).first<{ no_show_count: number }>();
    expect(cust?.no_show_count).toBe(1);
    await expectApiError(transitionBooking(db, { bookingId: booking.id, to: 'completed', actor: 'admin', audit: SYSTEM, now: Date.parse(at('19:30')) }), 'INVALID_TRANSITION');
  });

  it('3 kali no-show → akun tidak bisa booking online', async () => {
    const c = await newCustomer('noshow3');
    await db.prepare('UPDATE customers SET no_show_count = 2 WHERE id = ?').bind(c).run();
    const { booking } = await book(c, at('20:00'), 5);
    await transitionBooking(db, { bookingId: booking.id, to: 'no_show', actor: 'admin', audit: SYSTEM, now: Date.parse(at('20:20')) });
    const row = await db.prepare('SELECT status, no_show_count FROM customers WHERE id = ?').bind(c).first<{ status: string; no_show_count: number }>();
    expect(row).toEqual({ status: 'blocked', no_show_count: 3 });
    await expectApiError(book(c, at('10:00', '2026-10-20'), 5), 'ACCOUNT_BLOCKED');
  });

  it('jadwal ulang: slot lama dilepas, slot baru dikunci; bentrok → tidak berubah sama sekali', async () => {
    const a = await newCustomer('resched-a');
    const b = await newCustomer('resched-b');
    const first = await book(a, at('10:00', '2026-10-20'), 2);
    const other = await book(b, at('11:00', '2026-10-20'), 2);
    // Pindah ke jam yang dipakai booking lain → 409, booking asli utuh
    await expectApiError(rescheduleBooking(db, { bookingId: first.booking.id, startAt: at('11:00', '2026-10-20'), barberId: 2, actor: 'customer', audit: SYSTEM, now: NOW }), 'SLOT_TAKEN');
    const kept = await db.prepare('SELECT start_at FROM bookings WHERE id = ?').bind(first.booking.id).first<{ start_at: string }>();
    expect(kept?.start_at).toBe(at('10:00', '2026-10-20'));
    // Pindah ke jam kosong
    const moved = await rescheduleBooking(db, { bookingId: first.booking.id, startAt: at('14:00', '2026-10-20'), barberId: 2, actor: 'customer', audit: SYSTEM, now: NOW });
    expect(moved.start_at).toBe(at('14:00', '2026-10-20'));
    const oldSlot = await db.prepare('SELECT COUNT(*) AS n FROM booking_slots WHERE barber_id = 2 AND slot_start = ?').bind(at('10:00', '2026-10-20')).first<{ n: number }>();
    expect(oldSlot?.n).toBe(0);
    expect(other.booking.status).toBe('confirmed');
  });

  it('maksimal 2 booking aktif per akun', async () => {
    const c = await newCustomer('limit');
    await book(c, at('10:00', '2026-10-21'), 2);
    await book(c, at('11:00', '2026-10-21'), 2);
    await expectApiError(book(c, at('14:00', '2026-10-21'), 2), 'LIMIT_ACTIVE');
  });

  it('cabang dengan konfirmasi manual → status pending', async () => {
    await db.prepare('UPDATE branches SET require_manual_confirmation = 1 WHERE id = 1').run();
    const c = await newCustomer('manual');
    const { booking } = await book(c, at('10:00', '2026-10-22'), 3);
    expect(booking.status).toBe('pending');
    const confirmed = await transitionBooking(db, { bookingId: booking.id, to: 'confirmed', actor: 'admin', audit: SYSTEM, now: NOW });
    expect(confirmed.status).toBe('confirmed');
    await db.prepare('UPDATE branches SET require_manual_confirmation = 0 WHERE id = 1').run();
  });
});

describe('ketersediaan', () => {
  it('libur cabang & time off barber dari database', async () => {
    const branch = await getBranch(db, 'bogor-bantarjati');
    const service = await getBranchService(db, branch.id, 'signature-haircut');
    await db.prepare(`INSERT INTO time_off (branch_id, start_at, end_at, reason) VALUES (1, ?, ?, 'hari_raya')`).bind(at('00:00', '2026-10-23'), at('00:00', '2026-10-24')).run();
    const holiday = await loadAvailability(db, { branch, service, date: '2026-10-23', now: NOW });
    expect(holiday.slots).toEqual([]);
    await db.prepare(`INSERT INTO time_off (barber_id, start_at, end_at, reason) VALUES (2, ?, ?, 'sakit')`).bind(at('00:00', '2026-10-26'), at('00:00', '2026-10-27')).run();
    const sick = await loadAvailability(db, { branch, service, barberId: 2, date: '2026-10-26', now: NOW });
    expect(sick.slots).toEqual([]);
    const others = await loadAvailability(db, { branch, service, date: '2026-10-26', now: NOW });
    expect(others.slots.length).toBeGreaterThan(0);
    expect(others.slots.every((s) => !s.barberIds.includes(2))).toBe(true);
  });

  it('GET /api/availability lewat Hono', async () => {
    const res = await app.request('/api/availability?branch=bogor-bantarjati&service=signature-haircut&barber=any&date=2099-01-01', {}, { DB: db, APP_ENV: 'test' } as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { slots: unknown[]; timezone: string };
    expect(json.timezone).toBe('Asia/Jakarta');
    expect(json.slots).toEqual([]); // di luar batas 14 hari
    const bad = await app.request('/api/availability?branch=bogor-bantarjati&service=signature-haircut&date=19-10-2026', {}, { DB: db } as never);
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: { code: string } }).error.code).toBe('BAD_REQUEST');
  });
});

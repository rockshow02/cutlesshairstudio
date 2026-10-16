/** Tes Cron: pending kedaluwarsa dibatalkan & slot dilepas, sesi kedaluwarsa dihapus, anonimisasi 24 bulan, katalog. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonymizeInactive, cleanup, expirePendingBookings } from '../worker/cron';
import { createBooking } from '../worker/lib/bookings';
import { buildCatalog } from '../worker/routes/catalog';
import type { Env } from '../worker/env';
import { createTestDb } from './helpers/d1';

const NOW = Date.parse('2026-10-18T23:00:00Z'); // Senin 19 Okt 06.00 WIB
const at = (hhmm: string, date = '2026-10-19') => new Date(`${date}T${hhmm}:00+07:00`).toISOString();
let t: Awaited<ReturnType<typeof createTestDb>>;
let env: Env;

beforeAll(async () => {
  t = await createTestDb();
  env = { DB: t.db } as Env;
  await t.db.prepare('UPDATE branches SET require_manual_confirmation = 1 WHERE id = 1').run();
});
afterAll(async () => {
  await t?.dispose();
});

describe('cron', () => {
  it('pending > 2 jam atau < 60 menit sebelum jadwal → dibatalkan otomatis, slot dilepas; pending baru tetap', async () => {
    const old = await createBooking(t.db, { branch: 1, service: 1, barberId: 2, startAt: at('15:00', '2026-10-20'), customerId: 'test-cust-1', source: 'online', actor: { type: 'system', id: null }, now: NOW });
    const soon = await createBooking(t.db, { branch: 1, service: 1, barberId: 3, startAt: at('10:00'), customerId: 'test-cust-2', source: 'online', actor: { type: 'system', id: null }, now: NOW });
    const fresh = await createBooking(t.db, { branch: 1, service: 1, barberId: 4, startAt: at('16:00', '2026-10-20'), customerId: 'test-cust-2', source: 'online', actor: { type: 'system', id: null }, now: NOW });
    expect([old, soon, fresh].map((x) => x.booking.status)).toEqual(['pending', 'pending', 'pending']);
    // "old" dibuat 3 jam lalu
    await t.db.prepare('UPDATE bookings SET created_at = ? WHERE id = ?').bind(new Date(NOW - 3 * 3_600_000).toISOString(), old.booking.id).run();
    const runAt = Date.parse(at('09:15')); // 45 menit sebelum "soon"
    await t.db.prepare('UPDATE bookings SET created_at = ? WHERE id IN (?, ?)').bind(new Date(runAt - 30 * 60_000).toISOString(), soon.booking.id, fresh.booking.id).run();
    const n = await expirePendingBookings(env, runAt);
    expect(n).toBe(2);
    const status = async (id: string) => (await t.db.prepare('SELECT status, cancelled_by FROM bookings WHERE id = ?').bind(id).first()) as { status: string; cancelled_by: string };
    expect(await status(old.booking.id)).toEqual({ status: 'cancelled', cancelled_by: 'system' });
    expect(await status(soon.booking.id)).toEqual({ status: 'cancelled', cancelled_by: 'system' });
    expect((await status(fresh.booking.id)).status).toBe('pending');
    const slots = await t.db.prepare('SELECT COUNT(*) AS n FROM booking_slots WHERE booking_id IN (?, ?)').bind(old.booking.id, soon.booking.id).first<{ n: number }>();
    expect(slots?.n).toBe(0);
  });

  it('sesi kedaluwarsa dihapus', async () => {
    await t.db.prepare(`INSERT INTO sessions (id_hash, customer_id, expires_at) VALUES ('old', 'test-cust-1', ?), ('new', 'test-cust-1', ?)`)
      .bind(new Date(NOW - 1000).toISOString(), new Date(NOW + 86_400_000).toISOString()).run();
    await cleanup(env, NOW);
    const { results } = await t.db.prepare('SELECT id_hash FROM sessions').all<{ id_hash: string }>();
    expect(results.map((r) => r.id_hash)).toEqual(['new']);
  });

  it('pelanggan tidak aktif > 24 bulan dianonimkan, yang aktif tidak', async () => {
    await t.db.prepare(`INSERT INTO customers (id, google_sub, email, name, phone, created_at, last_login_at) VALUES ('lama', 'g-lama', 'lama@x.id', 'Lama', '6281200000009', '2023-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`).run();
    const n = await anonymizeInactive(env, NOW);
    expect(n).toBe(1);
    const row = await t.db.prepare(`SELECT name, email, phone FROM customers WHERE id = 'lama'`).first();
    expect(row).toEqual({ name: 'Pengguna dihapus', email: null, phone: null });
    const active = await t.db.prepare(`SELECT anonymized_at FROM customers WHERE id = 'test-cust-1'`).first<{ anonymized_at: string | null }>();
    expect(active?.anonymized_at).toBeNull();
  });
});

describe('katalog untuk landing page', () => {
  it('bentuk sama dengan branches/barbers/pricing.json', async () => {
    const c = await buildCatalog(t.db);
    const bogor = c.branches.find((b) => b.slug === 'bogor-bantarjati')!;
    expect(bogor.status).toBe('Aktif');
    expect(bogor.openingHours[0]).toEqual({ day: 'Senin', openTime: '10:00', closeTime: '21:00', isClosed: false });
    expect(bogor.openingHours.map((h) => h.day)).toEqual(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']);
    expect(c.barbers.some((b) => b.name === 'Dimas' && b.branchSlug === 'bogor-bantarjati' && b.isActive)).toBe(true);
    const haircut = c.pricing.find((p) => p.name === 'Signature Haircut')!;
    expect(haircut).toMatchObject({ category: 'Haircut', price: 100000, isActive: true });
  });
});

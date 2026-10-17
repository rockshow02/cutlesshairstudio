/** Migrasi 0003 di D1 berisi data: loyalty_stamps dibangun ulang tanpa kehilangan baris, indeks & constraint lengkap. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from './helpers/d1';

let t: Awaited<ReturnType<typeof createTestDb>>;
let barber: number;
let service: number;
const before: Record<string, unknown>[] = [];

async function customer(id: string) {
  await t.db.prepare(`INSERT INTO customers (id, name, phone) VALUES (?, ?, '6281200000099')`).bind(id, `Migrasi ${id}`).run();
}
async function booking(id: string, customerId: string, start: string) {
  await t.db
    .prepare(
      `INSERT INTO bookings (id, code, branch_id, barber_id, service_id, customer_id, start_at, end_at, price_snapshot, duration_snapshot, service_name_snapshot, status, source)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?, 100000, 45, 'Uji', 'completed', 'admin')`,
    )
    .bind(id, `MG${id.slice(-6).padStart(6, '0')}`, barber, service, customerId, start, new Date(Date.parse(start) + 45 * 60_000).toISOString())
    .run();
}

beforeAll(async () => {
  t = await createTestDb({ until: '0002_loyalty.sql' });
  barber = (await t.db.prepare('SELECT id FROM barbers WHERE branch_id = 1 ORDER BY id LIMIT 1').first<{ id: number }>())!.id;
  service = (await t.db.prepare('SELECT id FROM services ORDER BY id LIMIT 1').first<{ id: number }>())!.id;
  // Data loyalty sebelum migrasi: stempel booking, manual, berbagai status
  await customer('mg-a');
  await customer('mg-b');
  await booking('mg-bk1', 'mg-a', '2026-05-01T03:00:00.000Z');
  await booking('mg-bk2', 'mg-a', '2026-05-02T03:00:00.000Z');
  await t.db.prepare(`INSERT INTO loyalty_cards (customer_id, cycle) VALUES ('mg-a', 1), ('mg-b', 0)`).run();
  const rows = [
    ['mg-s1', 'mg-a', 'mg-bk1', 1, '2026-05-01', 0, 'booking', 'used', null],
    ['mg-s2', 'mg-a', 'mg-bk2', 1, '2026-05-02', 1, 'booking', 'active', null],
    ['mg-s3', 'mg-a', null, null, '2026-05-02', 1, 'manual', 'active', 'Kompensasi'],
    ['mg-s4', 'mg-b', null, null, '2026-05-03', 0, 'manual', 'removed', 'Salah input'],
  ];
  for (const r of rows) {
    await t.db
      .prepare(
        `INSERT INTO loyalty_stamps (id, customer_id, booking_id, branch_id, stamp_date, cycle, kind, status, reason, created_by, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'owner@localhost', '2026-05-05T00:00:00.000Z', '2027-05-05T00:00:00.000Z')`,
      )
      .bind(...r)
      .run();
  }
  before.push(...(await t.db.prepare('SELECT * FROM loyalty_stamps ORDER BY id').all()).results);
  await t.migrate('0003_shop.sql');
});
afterAll(async () => {
  await t?.dispose();
});

describe('migrasi 0003_shop', () => {
  it('jumlah & isi baris loyalty_stamps sama sebelum-sesudah (kolom order_id baru = NULL)', async () => {
    const after = (await t.db.prepare('SELECT * FROM loyalty_stamps ORDER BY id').all<Record<string, unknown>>()).results;
    expect(after).toHaveLength(before.length);
    expect(after.map(({ order_id, ...r }) => (expect(order_id).toBeNull(), r))).toEqual(before);
  });

  it('semua indeks lama dibuat ulang (indeks harian kini mencakup booking + order)', async () => {
    const idx = (await t.db.prepare(`SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'loyalty_stamps'`).all<{ name: string; sql: string | null }>()).results;
    const named = Object.fromEntries(idx.filter((i) => i.sql).map((i) => [i.name, i.sql]));
    expect(Object.keys(named).sort()).toEqual(['loyalty_stamps_card', 'loyalty_stamps_created', 'loyalty_stamps_daily', 'loyalty_stamps_expiry']);
    expect(named.loyalty_stamps_daily).toMatch(/UNIQUE INDEX .*\(customer_id, stamp_date\) WHERE kind IN \('booking', 'order'\)/);
    // PK + UNIQUE(booking_id) + UNIQUE(order_id)
    expect(idx.filter((i) => !i.sql).length).toBe(3);
  });

  it('constraint lama tetap berlaku + aturan baru', async () => {
    const ins = (id: string, o: { booking?: string | null; order?: string | null; date: string; kind: string; customer?: string }) =>
      t.db
        .prepare(
          `INSERT INTO loyalty_stamps (id, customer_id, booking_id, order_id, stamp_date, cycle, kind, status, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, 0, ?, 'active', '2026-06-01T00:00:00.000Z', '2027-06-01T00:00:00.000Z')`,
        )
        .bind(id, o.customer ?? 'mg-b', o.booking ?? null, o.order ?? null, o.date, o.kind)
        .run();
    // UNIQUE(booking_id)
    await expect(ins('x1', { booking: 'mg-bk1', date: '2026-07-01', kind: 'booking' })).rejects.toThrow();
    // CHECK kind
    await expect(ins('x2', { date: '2026-07-02', kind: 'hadiah' })).rejects.toThrow();
    // FK customer
    await expect(ins('x3', { date: '2026-07-03', kind: 'manual', customer: 'tidak-ada' })).rejects.toThrow();
    // Stempel order + booking di tanggal sama untuk pelanggan sama → ditolak (maks 1/hari gabungan)
    await t.db
      .prepare(
        `INSERT INTO orders (id, code, customer_id, branch_id, fulfillment, status, subtotal, total, payment_method) VALUES ('mg-o1', 'SH-MIG001', 'mg-a', 1, 'pickup', 'completed', 150000, 150000, 'transfer')`,
      )
      .run();
    await expect(ins('x4', { order: 'mg-o1', date: '2026-05-01', kind: 'order', customer: 'mg-a' })).rejects.toThrow();
    await ins('x5', { order: 'mg-o1', date: '2026-08-01', kind: 'order', customer: 'mg-a' });
    // UNIQUE(order_id)
    await expect(ins('x6', { order: 'mg-o1', date: '2026-08-02', kind: 'order', customer: 'mg-a' })).rejects.toThrow();
    // booking_id dan order_id tidak boleh keduanya terisi
    await expect(ins('x7', { booking: 'mg-bk2', order: 'mg-o1', date: '2026-08-03', kind: 'order', customer: 'mg-a' })).rejects.toThrow();
    // Manual tetap tidak dibatasi per hari
    await ins('x8', { date: '2026-05-01', kind: 'manual', customer: 'mg-a' });
  });

  it('pengaturan toko default: MATI', async () => {
    const s = await t.db.prepare('SELECT enabled, payment_window_min, pickup_window_days, stamp_min_subtotal FROM shop_settings WHERE id = 1').first();
    expect(s).toEqual({ enabled: 0, payment_window_min: 1440, pickup_window_days: 7, stamp_min_subtotal: 100000 });
  });

  it('anti-oversell di tingkat tabel: reserved tidak bisa melebihi on_hand', async () => {
    await t.db.prepare(`INSERT INTO products (id, slug, name, category) VALUES (900, 'uji-stok', 'Uji stok', 'Pomade')`).run();
    await t.db.prepare(`INSERT INTO product_variants (id, product_id, name, price) VALUES (900, 900, '100 gr', 95000)`).run();
    await t.db.prepare(`INSERT INTO variant_stock (branch_id, variant_id, on_hand, reserved) VALUES (1, 900, 2, 0)`).run();
    await t.db.prepare(`UPDATE variant_stock SET reserved = reserved + 2 WHERE branch_id = 1 AND variant_id = 900`).run();
    await expect(t.db.prepare(`UPDATE variant_stock SET reserved = reserved + 1 WHERE branch_id = 1 AND variant_id = 900`).run()).rejects.toThrow();
  });
});

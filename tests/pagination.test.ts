/** Paginasi keyset: halaman pertama/berikutnya/terakhir, data dengan waktu sama, pencarian, cakupan cabang. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../worker/index';
import { decodeCursor, encodeCursor, PAGE_DEFAULT, PAGE_MAX } from '../worker/lib/pagination';
import { createTestDb } from './helpers/d1';

const ORIGIN = 'http://localhost';
const OWNER = 'owner@localhost';
const BRANCH_ADMIN = 'admin.cabang@localhost'; // cabang 1
let t: Awaited<ReturnType<typeof createTestDb>>;
let env: Record<string, unknown>;
let barber1: number;
let serviceId: number;

const admin = async <T,>(as: string, path: string) => {
  const r = await app.request(`${ORIGIN}/api/admin${path}`, { headers: { 'x-dev-admin': as } }, env);
  return { status: r.status, body: (await r.json()) as T };
};

const iso = (ms: number) => new Date(ms).toISOString();
const HOUR = 3_600_000;

let seq = 0;
/** Sisipkan booking langsung (tanpa mesin slot) untuk menguji urutan & cursor */
async function insertBooking(customerId: string, startMs: number, opts: { branch?: number; barber?: number; status?: string } = {}) {
  seq += 1;
  const id = `pg-${String(seq).padStart(4, '0')}`;
  await t.db
    .prepare(
      `INSERT INTO bookings (id, code, branch_id, barber_id, service_id, customer_id, start_at, end_at, price_snapshot, duration_snapshot, service_name_snapshot, status, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 100000, 45, 'Signature Haircut', ?, 'admin')`,
    )
    .bind(id, `PG${String(seq).padStart(6, '0')}`, opts.branch ?? 1, opts.barber ?? barber1, serviceId, customerId, iso(startMs), iso(startMs + 45 * 60_000), opts.status ?? 'completed')
    .run();
  return id;
}

async function insertCustomer(id: string, name: string, createdAt: string) {
  await t.db.prepare(`INSERT INTO customers (id, name, phone, created_at) VALUES (?, ?, '6281200000000', ?)`).bind(id, name, createdAt).run();
}

/** Ikuti nextCursor sampai habis; kembalikan semua halaman */
async function allPages<T>(fetchPage: (cursor: string | null) => Promise<{ items: T[]; nextCursor: string | null }>) {
  const pages: T[][] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 20; i++) {
    const p = await fetchPage(cursor);
    pages.push(p.items);
    if (!p.nextCursor) break;
    cursor = p.nextCursor;
  }
  return pages;
}

beforeAll(async () => {
  t = await createTestDb();
  env = { DB: t.db, APP_ENV: 'development', ADMIN_DEV_EMAIL: OWNER, AUTH_MOCK_ENABLED: 'true', AUTH_PHONE_PASSWORD_ENABLED: 'false' };
  barber1 = (await t.db.prepare('SELECT id FROM barbers WHERE branch_id = 1 AND is_active = 1 ORDER BY id LIMIT 1').first<{ id: number }>())!.id;
  serviceId = (await t.db.prepare('SELECT id FROM services WHERE is_bookable = 1 ORDER BY id LIMIT 1').first<{ id: number }>())!.id;
  await t.db.prepare(`INSERT INTO barbers (id, branch_id, name, is_active, sort_order) VALUES (60, 2, 'Barber Cibubur', 1, 1)`).run();
});
afterAll(async () => {
  await t?.dispose();
});

describe('cursor', () => {
  it('encode/decode bolak-balik; cursor rusak → 400', async () => {
    expect(decodeCursor(encodeCursor(['2026-10-18T02:00:00.000Z', 'abc']))).toEqual(['2026-10-18T02:00:00.000Z', 'abc']);
    expect(decodeCursor(encodeCursor([42, 42]))).toEqual([42, 42]);
    expect(() => decodeCursor('bukan-cursor')).toThrow();
    const r = await admin(OWNER, '/customers?cursor=xxx');
    expect(r.status).toBe(400);
  });

  it('limit default 20, dibatasi maks. 50', async () => {
    for (let i = 0; i < 60; i++) await insertCustomer(`pg-many-${String(i).padStart(2, '0')}`, `Banyak ${i}`, '2026-01-01T00:00:00.000Z');
    const def = await admin<{ customers: unknown[] }>(OWNER, '/customers?q=Banyak');
    expect(def.body.customers).toHaveLength(PAGE_DEFAULT);
    const big = await admin<{ customers: unknown[] }>(OWNER, '/customers?q=Banyak&limit=999');
    expect(big.body.customers).toHaveLength(PAGE_MAX);
    const bad = await admin<{ customers: unknown[] }>(OWNER, '/customers?q=Banyak&limit=0');
    expect(bad.body.customers).toHaveLength(PAGE_DEFAULT);
  });
});

describe('GET /api/admin/customers', () => {
  it('halaman pertama → berikutnya → terakhir: tanpa duplikat walau created_at sama; total hanya di halaman pertama', async () => {
    // 25 pelanggan dengan waktu sama persis (pemecah seri = id)
    for (let i = 0; i < 25; i++) await insertCustomer(`pg-tie-${String(i).padStart(2, '0')}`, `Seri ${i}`, '2026-02-02T00:00:00.000Z');
    const first = await admin<{ customers: { id: string }[]; nextCursor: string | null; total?: number }>(OWNER, '/customers?q=Seri&limit=10');
    expect(first.body.total).toBe(25);
    const pages = await allPages(async (cursor) => {
      const r = await admin<{ customers: { id: string }[]; nextCursor: string | null; total?: number }>(OWNER, `/customers?q=Seri&limit=10${cursor ? `&cursor=${cursor}` : ''}`);
      if (cursor) expect(r.body.total).toBeUndefined();
      return { items: r.body.customers, nextCursor: r.body.nextCursor };
    });
    expect(pages.map((p) => p.length)).toEqual([10, 10, 5]);
    const ids = pages.flat().map((c) => c.id);
    expect(new Set(ids).size).toBe(25);
    expect(ids).toEqual([...ids].sort().reverse()); // urut id menurun untuk waktu yang sama
  });

  it('pencarian tetap berlaku di halaman berikutnya', async () => {
    const r1 = await admin<{ customers: { name: string }[]; nextCursor: string | null }>(OWNER, '/customers?q=Seri 1&limit=5');
    const r2 = await admin<{ customers: { name: string }[]; nextCursor: string | null }>(OWNER, `/customers?q=Seri 1&limit=5&cursor=${r1.body.nextCursor}`);
    // "Seri 1" cocok: 1, 10–19 = 11 pelanggan
    expect([...r1.body.customers, ...r2.body.customers].every((c) => c.name.startsWith('Seri 1'))).toBe(true);
    expect(r1.body.customers.length + r2.body.customers.length).toBe(10);
  });

  it('admin cabang hanya melihat pelanggan yang pernah booking di cabangnya, juga di halaman berikutnya', async () => {
    const base = Date.parse('2026-03-01T03:00:00.000Z');
    for (let i = 0; i < 7; i++) {
      const id = `pg-br-${i}`;
      await insertCustomer(id, `Cabang ${i}`, '2026-03-01T00:00:00.000Z');
      // genap: cabang 1, ganjil: cabang 2
      await insertBooking(id, base + i * HOUR, i % 2 === 0 ? {} : { branch: 2, barber: 60 });
    }
    const pages = await allPages(async (cursor) => {
      const r = await admin<{ customers: { name: string }[]; nextCursor: string | null }>(BRANCH_ADMIN, `/customers?q=Cabang&limit=2${cursor ? `&cursor=${cursor}` : ''}`);
      return { items: r.body.customers, nextCursor: r.body.nextCursor };
    });
    expect(pages.flat().map((c) => c.name).sort()).toEqual(['Cabang 0', 'Cabang 2', 'Cabang 4', 'Cabang 6']);
    const owner = await admin<{ total: number }>(OWNER, '/customers?q=Cabang&limit=2');
    expect(owner.body.total).toBe(7);
  });
});

describe('riwayat booking pelanggan (admin)', () => {
  it('detail memuat halaman pertama; /bookings melanjutkan tanpa celah walau start_at sama; terakhir nextCursor null', async () => {
    const cid = 'pg-hist';
    await insertCustomer(cid, 'Riwayat Panjang', '2026-04-01T00:00:00.000Z');
    const base = Date.parse('2026-04-05T03:00:00.000Z');
    const ids: string[] = [];
    for (let i = 0; i < 22; i++) ids.push(await insertBooking(cid, base + Math.floor(i / 3) * HOUR)); // tiap 3 booking punya jam sama
    for (let i = 0; i < 3; i++) ids.push(await insertBooking(cid, base + i * HOUR, { branch: 2, barber: 60 }));

    const detail = await admin<{ bookings: { id: string }[]; bookingsNextCursor: string | null; bookingsTotal: number }>(OWNER, `/customers/${cid}?limit=10`);
    expect(detail.body.bookings).toHaveLength(10);
    expect(detail.body.bookingsTotal).toBe(25);
    const rest = await allPages(async (cursor) => {
      const r = await admin<{ bookings: { id: string; start_at: string }[]; nextCursor: string | null }>(OWNER, `/customers/${cid}/bookings?limit=10&cursor=${cursor ?? detail.body.bookingsNextCursor}`);
      return { items: r.body.bookings, nextCursor: r.body.nextCursor };
    });
    const all = [...detail.body.bookings, ...rest.flat()];
    expect(all).toHaveLength(25);
    expect(new Set(all.map((b) => b.id)).size).toBe(25);
    expect(rest[rest.length - 1].length).toBe(5);

    // Admin cabang: hanya booking cabang 1
    const scoped = await admin<{ bookings: { branch_id: number }[]; bookingsTotal: number }>(BRANCH_ADMIN, `/customers/${cid}?limit=50`);
    expect(scoped.body.bookingsTotal).toBe(22);
    expect(scoped.body.bookings.every((b) => b.branch_id === 1)).toBe(true);
  });
});

describe('GET /api/me/bookings', () => {
  it('aktif selalu lengkap di halaman pertama; riwayat dipaginasi; halaman berikutnya active = []', async () => {
    const email = 'paginasi@test.local';
    const login = await app.request(`${ORIGIN}/api/auth/mock?email=${encodeURIComponent(email)}&next=/booking/`, {}, env);
    const cookie = `cutless_session=${login.headers.get('set-cookie')?.match(/cutless_session=([^;]+)/)?.[1]}`;
    const me = (await t.db.prepare('SELECT id FROM customers WHERE email = ?').bind(email).first<{ id: string }>())!;
    const future = Date.now() + 3 * 24 * HOUR;
    await insertBooking(me.id, future, { status: 'confirmed' });
    await insertBooking(me.id, future + 2 * HOUR, { status: 'pending' });
    const past = Date.parse('2026-05-01T03:00:00.000Z');
    for (let i = 0; i < 23; i++) await insertBooking(me.id, past + Math.floor(i / 2) * HOUR, { status: i % 4 === 0 ? 'cancelled' : 'completed' });

    const get = async (q: string) =>
      (await (await app.request(`${ORIGIN}/api/me/bookings${q}`, { headers: { cookie } }, env)).json()) as {
        active: { status: string }[];
        history: { id: string }[];
        nextCursor: string | null;
        historyTotal?: number;
      };
    const p1 = await get('');
    expect(p1.active.map((b) => b.status)).toEqual(['confirmed', 'pending']);
    expect(p1.history).toHaveLength(20);
    expect(p1.historyTotal).toBe(23);
    const p2 = await get(`?cursor=${p1.nextCursor}`);
    expect(p2.active).toEqual([]);
    expect(p2.history).toHaveLength(3);
    expect(p2.nextCursor).toBeNull();
    expect(new Set([...p1.history, ...p2.history].map((b) => b.id)).size).toBe(23);
  });
});

describe('audit & libur/cuti', () => {
  it('audit: id menurun, berhenti di halaman terakhir', async () => {
    for (let i = 0; i < 30; i++) {
      await t.db.prepare(`INSERT INTO audit_log (actor_type, actor_id, action, entity, entity_id) VALUES ('system', NULL, 'tes.paginasi', 'test', ?)`).bind(String(i)).run();
    }
    const pages = await allPages(async (cursor) => {
      const r = await admin<{ entries: { id: number }[]; nextCursor: string | null }>(OWNER, `/audit?limit=25${cursor ? `&cursor=${cursor}` : ''}`);
      return { items: r.body.entries, nextCursor: r.body.nextCursor };
    });
    const ids = pages.flat().map((e) => e.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(30);
    expect(pages[pages.length - 1].length).toBeLessThanOrEqual(25);
    // Bukan owner → ditolak
    expect((await admin(BRANCH_ADMIN, '/audit')).status).toBe(403);
  });

  it('libur/cuti: urut tanggal mulai, admin cabang hanya cabangnya', async () => {
    const start = Date.now() + 10 * 24 * HOUR;
    for (let i = 0; i < 12; i++) {
      await t.db
        .prepare(`INSERT INTO time_off (branch_id, start_at, end_at, reason) VALUES (?, ?, ?, 'libur_cabang')`)
        .bind(i % 3 === 0 ? 2 : 1, iso(start + Math.floor(i / 2) * 24 * HOUR), iso(start + Math.floor(i / 2) * 24 * HOUR + 8 * HOUR))
        .run();
    }
    const owner = await allPages(async (cursor) => {
      const r = await admin<{ timeOff: { id: number; start_at: string }[]; nextCursor: string | null; total: number }>(OWNER, `/time-off?limit=5${cursor ? `&cursor=${cursor}` : ''}`);
      expect(r.body.total).toBe(12);
      return { items: r.body.timeOff, nextCursor: r.body.nextCursor };
    });
    const all = owner.flat();
    expect(all).toHaveLength(12);
    expect(all.map((x) => x.start_at)).toEqual([...all.map((x) => x.start_at)].sort());
    const scoped = await admin<{ timeOff: { branch_id: number }[]; total: number }>(BRANCH_ADMIN, '/time-off?limit=50');
    expect(scoped.body.total).toBe(8);
    expect(scoped.body.timeOff.every((x) => x.branch_id === 1)).toBe(true);
  });
});

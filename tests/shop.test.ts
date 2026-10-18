/**
 * Cutless Shop: harga server, anti-oversell bersamaan, drop belum rilis, batas per pelanggan, transisi per peran,
 * cakupan cabang, cron (kedaluwarsa, selesai otomatis, lewat batas ambil + Telegram), stempel dari belanja,
 * ambil saat booking (booking batal → reservasi dilepas), kode unik transfer, konfirmasi nominal berbeda.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { app } from '../worker/index';
import { buildCatalog } from '../worker/routes/catalog';
import { createOrder, getShopSettings, runShopCron, transitionOrder, type ShopSettings } from '../worker/lib/shop';
import { ApiError } from '../worker/lib/errors';
import { sha256Hex } from '../worker/lib/session';
import { createTestDb } from './helpers/d1';

const ORIGIN = 'http://localhost';
const OWNER = 'owner@localhost';
const BRANCH_ADMIN = 'admin.cabang@localhost'; // cabang 1
const BARBER = 'barber@localhost';
const DAY = 86_400_000;
let t: Awaited<ReturnType<typeof createTestDb>>;
let env: Record<string, unknown>;
let settings: ShopSettings;
let svc: { haircut: number; wash: number };
let barber1: number;

let seq = 0;
const uid = (p: string) => `${p}-${++seq}`;

const admin = async <T = Record<string, unknown>>(as: string, path: string, init: { method?: string; json?: unknown } = {}) => {
  const r = await app.request(
    `${ORIGIN}/api/admin${path}`,
    {
      method: init.method ?? 'GET',
      headers: { 'x-dev-admin': as, origin: ORIGIN, ...(init.json ? { 'content-type': 'application/json' } : {}) },
      body: init.json ? JSON.stringify(init.json) : undefined,
    },
    env,
  );
  return { status: r.status, body: (await r.json().catch(() => ({}))) as T };
};

/** Pelanggan login (profil lengkap) → { id, req } */
async function customer() {
  const id = uid('sc');
  const token = `tok-${id}`;
  await t.db.batch([
    t.db.prepare(`INSERT INTO customers (id, google_sub, email, name, phone, privacy_consent_at) VALUES (?, ?, ?, ?, '6281299990000', ?)`).bind(id, `mock:${id}`, `${id}@test.local`, `Pelanggan ${id}`, new Date().toISOString()),
    t.db.prepare('INSERT INTO sessions (id_hash, customer_id, expires_at, user_agent) VALUES (?, ?, ?, ?)').bind(await sha256Hex(token), id, new Date(Date.now() + 30 * DAY).toISOString(), 'vitest'),
  ]);
  const req = async <T = Record<string, unknown>>(path: string, init: { method?: string; json?: unknown } = {}, e = env) => {
    const r = await app.request(
      `${ORIGIN}/api${path}`,
      {
        method: init.method ?? 'GET',
        headers: { cookie: `cutless_session=${token}`, origin: ORIGIN, ...(init.json ? { 'content-type': 'application/json' } : {}) },
        body: init.json ? JSON.stringify(init.json) : undefined,
      },
      e,
    );
    return { status: r.status, body: (await r.json().catch(() => ({}))) as T };
  };
  return { id, req };
}

type Variant = { id: number; price: number };
/** Produk 1 varian + stok cabang 1 (dan opsional cabang 2) */
async function product(o: { price?: number; stock?: number; stock2?: number; limit?: number | null; releaseAt?: string | null } = {}) {
  const slug = uid('produk');
  const r = await admin<{ product: { id: number; variants: Variant[] } }>(OWNER, '/shop/products', {
    method: 'POST',
    json: {
      slug,
      name: `Produk ${slug}`,
      category: 'Pomade',
      description: null,
      notes: null,
      badge: null,
      is_active: true,
      sort_order: seq,
      release_at: o.releaseAt ?? null,
      per_customer_limit: o.limit ?? null,
      images: [{ path: '/uploads/products/uji.webp' }],
      variants: [{ sku: `SKU-${slug}`, name: '100 gr', options: {}, price: o.price ?? 100000, compare_at_price: null, weight_gram: 150, is_active: true }],
    },
  });
  expect(r.status).toBe(201);
  const v = r.body.product.variants[0];
  if (o.stock !== 0) expect((await admin(OWNER, '/shop/stock', { method: 'PUT', json: { branchId: 1, variantId: v.id, onHand: o.stock ?? 10, reason: 'stok awal' } })).status).toBe(200);
  if (o.stock2) expect((await admin(OWNER, '/shop/stock', { method: 'PUT', json: { branchId: 2, variantId: v.id, onHand: o.stock2, reason: 'stok awal' } })).status).toBe(200);
  return { productId: r.body.product.id, variant: v };
}

const stock = (variantId: number, branch = 1) =>
  t.db.prepare('SELECT on_hand, reserved FROM variant_stock WHERE branch_id = ? AND variant_id = ?').bind(branch, variantId).first<{ on_hand: number; reserved: number }>();
const order = (id: string) => t.db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Record<string, unknown> & { status: string; total: number; subtotal: number; unique_code: number }>();
const SYS = { type: 'system' as const, id: 'tes' };
const ADM = { type: 'admin' as const, id: OWNER };

async function errorOf(p: Promise<unknown>) {
  const e = await p.then(
    () => null,
    (x) => x,
  );
  expect(e).toBeInstanceOf(ApiError);
  return e as ApiError;
}

const pickupOrder = (customerId: string, variantId: number, qty = 1, branchId = 1) =>
  createOrder(t.db, settings, { customerId, branchId, fulfillment: 'pickup', items: [{ variantId, qty }], paymentMethod: 'transfer', actor: { type: 'customer', id: customerId } });
const move = (orderId: string, action: Parameters<typeof transitionOrder>[2]['action'], data: Parameters<typeof transitionOrder>[2]['data'] = {}, now?: number, actor: 'admin' | 'customer' | 'system' = 'admin') =>
  transitionOrder(env as never, settings, { orderId, action, actor, audit: actor === 'admin' ? ADM : SYS, data, now });

async function shopSettings(extra: Record<string, unknown> = {}) {
  const r = await admin(OWNER, '/shop/settings', {
    method: 'PUT',
    json: {
      enabled: true,
      payment_window_min: 1440,
      pickup_window_days: 7,
      auto_complete_days: 7,
      stamp_min_subtotal: 100000,
      low_stock_threshold: 3,
      return_policy: 'Produk segel dapat ditukar dalam 3 hari.',
      shipping_provider: 'manual',
      shipping_daily_limit: 90,
      ...extra,
    },
  });
  expect(r.status).toBe(200);
  settings = (await getShopSettings(t.db))!;
}

const branchBody = (extra: Record<string, unknown> = {}) => ({
  pickup_enabled: true,
  with_booking_enabled: true,
  ship_manual_enabled: true,
  ship_auto_enabled: false,
  bank_name: 'BCA',
  bank_account_no: '1234567890',
  bank_account_name: 'Cutless Hair Studio',
  qris_image: null,
  payment_note: null,
  unique_code_enabled: false,
  origin_region_id: null,
  origin_label: null,
  ...extra,
});

beforeAll(async () => {
  t = await createTestDb();
  env = { DB: t.db, APP_ENV: 'development', ADMIN_DEV_EMAIL: OWNER, AUTH_MOCK_ENABLED: 'true', AUTH_PHONE_PASSWORD_ENABLED: 'false', SHOP_ENABLED: 'true', LOYALTY_ENABLED: 'true' };
  const id = async (slug: string) => (await t.db.prepare('SELECT id FROM services WHERE slug = ?').bind(slug).first<{ id: number }>())!.id;
  svc = { haircut: await id('signature-haircut'), wash: await id('hair-wash-styling') };
  barber1 = (await t.db.prepare(`SELECT barber_id FROM admin_users WHERE email = ?`).bind(BARBER).first<{ barber_id: number }>())!.barber_id;
  await shopSettings();
  expect((await admin(OWNER, '/shop/branches/1', { method: 'PUT', json: branchBody() })).status).toBe(200);
  expect((await admin(OWNER, '/shop/branches/2', { method: 'PUT', json: branchBody() })).status).toBe(200);
});
afterAll(async () => {
  await t?.dispose();
});

describe('flag', () => {
  it('SHOP_ENABLED kosong atau toko nonaktif → config enabled:false, pesanan 404, katalog tanpa produk', async () => {
    const off = { ...env, SHOP_ENABLED: undefined };
    const c = await customer();
    expect((await c.req('/shop/config', {}, off)).body).toEqual({ enabled: false });
    expect((await c.req('/shop/orders', { method: 'POST', json: { branch: 1, items: [{ variantId: 1, qty: 1 }], fulfillment: 'pickup' } }, off)).status).toBe(404);
    expect('products' in (await buildCatalog(t.db, off as never))).toBe(false);
    expect('products' in (await buildCatalog(t.db))).toBe(false);
    // aktif → produk D1 ikut di katalog landing page (bentuk products.json + slug)
    const { variant } = await product({ price: 95000 });
    const cat = (await buildCatalog(t.db, env as never)) as { products?: { slug: string; price: number; inStock: boolean }[] };
    expect(cat.products?.some((p) => p.price === 95000 && p.inStock && p.slug)).toBe(true);
    expect(variant.price).toBe(95000);
  });
});

describe('harga & stok', () => {
  it('harga dihitung server dan disimpan sebagai snapshot; ubah harga sesudahnya tidak mengubah pesanan', async () => {
    const c = await customer();
    const { productId, variant } = await product({ price: 120000 });
    // klien mengirim field harga palsu → diabaikan skema
    const r = await c.req<{ order: { id: string; subtotal: number; total: number; items: { unit_price: number }[] } }>('/shop/orders', {
      method: 'POST',
      json: { branch: 1, items: [{ variantId: variant.id, qty: 2, price: 1 }], fulfillment: 'pickup', paymentMethod: 'transfer' },
    });
    expect(r.status).toBe(201);
    expect(r.body.order).toMatchObject({ subtotal: 240000, total: 240000 });
    expect(r.body.order.items[0].unit_price).toBe(120000);
    await t.db.prepare('UPDATE product_variants SET price = 1000 WHERE id = ?').bind(variant.id).run();
    expect((await order(r.body.order.id))!.total).toBe(240000);
    expect(productId).toBeGreaterThan(0);
    expect(await stock(variant.id)).toEqual({ on_hand: 10, reserved: 2 });
  });

  it('pesanan bersamaan tidak pernah membuat stok minus: stok 3, 8 pembeli → 3 berhasil, 5 ditolak 409', async () => {
    const { variant } = await product({ stock: 3 });
    const buyers = await Promise.all(Array.from({ length: 8 }, () => customer()));
    const results = await Promise.allSettled(buyers.map((b) => pickupOrder(b.id, variant.id)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(failed).toHaveLength(5);
    for (const f of failed) expect(f.reason).toMatchObject({ status: 409, code: 'STOCK_UNAVAILABLE' });
    expect(await stock(variant.id)).toEqual({ on_hand: 3, reserved: 3 });
    const n = await t.db.prepare('SELECT COUNT(*) AS n FROM order_items WHERE variant_id = ?').bind(variant.id).first<{ n: number }>();
    expect(n!.n).toBe(3);
  });

  it('stok fisik berkurang saat diambil (bukan saat dibayar); stok tidak bisa diset di bawah yang sedang dipesan', async () => {
    const c = await customer();
    const { variant } = await product({ stock: 5 });
    const o = await pickupOrder(c.id, variant.id, 2);
    expect((await admin(OWNER, '/shop/stock', { method: 'PUT', json: { branchId: 1, variantId: variant.id, onHand: 1, reason: 'opname' } })).status).toBe(409);
    await move(o.id, 'paid');
    expect(await stock(variant.id)).toEqual({ on_hand: 5, reserved: 2 });
    await move(o.id, 'ready');
    await move(o.id, 'complete');
    expect(await stock(variant.id)).toEqual({ on_hand: 3, reserved: 0 });
  });

  it('drop belum rilis ditolak; tanpa stok baris di cabang → ditolak', async () => {
    const c = await customer();
    const { variant } = await product({ releaseAt: new Date(Date.now() + DAY).toISOString() });
    const e = await errorOf(pickupOrder(c.id, variant.id));
    expect(e.code).toBe('STOCK_UNAVAILABLE');
    expect((e.details as { lines: { error?: string }[] }).lines[0].error).toMatch(/belum dirilis/);
    const q = await c.req<{ ok: boolean; lines: { error?: string }[] }>('/shop/quote', { method: 'POST', json: { branch: 1, items: [{ variantId: variant.id, qty: 1 }] } });
    expect(q.body.ok).toBe(false);
    const other = await product({ stock: 0 });
    expect((await errorOf(pickupOrder(c.id, other.variant.id))).code).toBe('STOCK_UNAVAILABLE');
  });

  it('batas per pelanggan dihitung dari semua pesanan non-batal (termasuk yang selesai) untuk produk itu', async () => {
    const c = await customer();
    const { variant } = await product({ limit: 2 });
    const a = await pickupOrder(c.id, variant.id, 1);
    const b = await pickupOrder(c.id, variant.id, 1);
    await move(a.id, 'paid');
    await move(a.id, 'ready');
    await move(a.id, 'complete');
    const e = await errorOf(pickupOrder(c.id, variant.id, 1));
    expect((e.details as { lines: { error?: string }[] }).lines[0].error).toMatch(/Batas 2 per pelanggan/);
    // pesanan batal tidak dihitung
    await move(b.id, 'cancel', {}, undefined, 'customer');
    await pickupOrder(c.id, variant.id, 1);
    // pelanggan lain tidak terpengaruh
    await pickupOrder((await customer()).id, variant.id, 2);
  });
});

describe('transisi per peran', () => {
  it('pelanggan hanya bisa batal (sebelum bayar) & "pesanan diterima" (dikirim); bayar/siap/kirim hanya admin; kedaluwarsa hanya sistem', async () => {
    const c = await customer();
    const { variant } = await product();
    const o = await pickupOrder(c.id, variant.id);
    for (const a of ['paid', 'ready', 'ship', 'refund'] as const) expect((await errorOf(move(o.id, a, {}, undefined, 'customer'))).code).toBe('INVALID_TRANSITION');
    expect((await errorOf(move(o.id, 'expire'))).code).toBe('INVALID_TRANSITION');
    expect((await c.req(`/me/orders/${o.id}/received`, { method: 'POST' })).status).toBe(409);
    await move(o.id, 'paid');
    expect((await c.req(`/me/orders/${o.id}/cancel`, { method: 'POST' })).status).toBe(409); // sudah dibayar
    expect((await errorOf(move(o.id, 'ship', { trackingNo: 'X' }))).code).toBe('INVALID_TRANSITION'); // pesanan ambil, bukan kirim
    // admin wajib alasan saat batal/refund
    expect((await errorOf(move(o.id, 'refund', {}))).code).toBe('BAD_REQUEST');
    // pelanggan lain tidak bisa melihat / mengubah
    const other = await customer();
    expect((await other.req(`/me/orders/${o.id}`)).status).toBe(404);
    expect((await other.req(`/me/orders/${o.id}/cancel`, { method: 'POST' })).status).toBe(404);
  });

  it('kirim dengan ongkir manual: menunggu ongkir → admin isi ongkir → bayar → kirim (resi) → pelanggan "diterima"', async () => {
    const c = await customer();
    const { variant } = await product({ price: 80000, stock: 4 });
    const r = await c.req<{ order: { id: string; status: string; shipping_fee: number | null } }>('/shop/orders', {
      method: 'POST',
      json: { branch: 1, items: [{ variantId: variant.id, qty: 1 }], fulfillment: 'ship_manual', shipping: { recipientName: 'Budi Santoso', recipientPhone: '081299990000', address: 'Jl. Pajajaran No. 10, Bogor' } },
    });
    expect(r.status).toBe(201);
    expect(r.body.order).toMatchObject({ status: 'awaiting_quote', shipping_fee: null });
    const id = r.body.order.id;
    expect((await admin(OWNER, `/shop/orders/${id}/paid`, { method: 'POST', json: {} })).status).toBe(409);
    expect((await admin(OWNER, `/shop/orders/${id}/quote`, { method: 'POST', json: { shippingFee: 15000, courier: 'JNE', service: 'REG' } })).status).toBe(200);
    expect(await order(id)).toMatchObject({ status: 'awaiting_payment', total: 95000 });
    expect((await admin(OWNER, `/shop/orders/${id}/paid`, { method: 'POST', json: {} })).status).toBe(200);
    expect((await admin(OWNER, `/shop/orders/${id}/ship`, { method: 'POST', json: {} })).status).toBe(400); // resi wajib
    expect((await admin(OWNER, `/shop/orders/${id}/ship`, { method: 'POST', json: { trackingNo: 'JNE123' } })).status).toBe(200);
    expect(await stock(variant.id)).toEqual({ on_hand: 3, reserved: 0 });
    const done = await c.req<{ order: { status: string; completed_by: string } }>(`/me/orders/${id}/received`, { method: 'POST' });
    expect(done.status).toBe(200);
    expect(done.body.order.status).toBe('completed');
  });

  it('admin cabang hanya melihat & mengubah pesanan/stok cabangnya; barber ditolak', async () => {
    const c = await customer();
    const { variant } = await product({ stock: 3, stock2: 3 });
    const mine = await pickupOrder(c.id, variant.id, 1, 1);
    const theirs = await pickupOrder(c.id, variant.id, 1, 2);
    expect((await admin(BRANCH_ADMIN, `/shop/orders/${theirs.id}`)).status).toBe(403);
    expect((await admin(BRANCH_ADMIN, `/shop/orders/${theirs.id}/paid`, { method: 'POST', json: {} })).status).toBe(403);
    expect((await admin(BRANCH_ADMIN, `/shop/orders/${mine.id}/paid`, { method: 'POST', json: {} })).status).toBe(200);
    const list = await admin<{ orders: { branch_id: number }[] }>(BRANCH_ADMIN, '/shop/orders?branch=2&limit=50');
    expect(list.status).toBe(200);
    expect(list.body.orders.length).toBeGreaterThan(0);
    expect(list.body.orders.every((o) => o.branch_id === 1)).toBe(true);
    expect((await admin(BRANCH_ADMIN, '/shop/stock', { method: 'PUT', json: { branchId: 2, variantId: variant.id, onHand: 9, reason: 'opname' } })).status).toBe(403);
    expect((await admin(BRANCH_ADMIN, '/shop/stock', { method: 'PUT', json: { branchId: 1, variantId: variant.id, onHand: 9, reason: 'opname' } })).status).toBe(200);
    expect((await admin(BRANCH_ADMIN, '/shop/settings', { method: 'PUT', json: {} })).status).toBe(403);
    expect((await admin(BARBER, '/shop/orders')).status).toBe(403);
    const sum = await admin<{ revenue: { orders: number }; lowStock: { branch_id: number }[]; todo: Record<string, number> }>(BRANCH_ADMIN, '/shop/summary?branch=2');
    expect(sum.status).toBe(200);
    expect(sum.body.revenue.orders).toBeGreaterThan(0);
    expect(sum.body.lowStock.every((r) => r.branch_id === 1)).toBe(true);
  });
});

describe('pembayaran', () => {
  it('kode unik transfer (per cabang): total = subtotal + 1–999, tampil di instruksi bayar', async () => {
    expect((await admin(OWNER, '/shop/branches/2', { method: 'PUT', json: branchBody({ unique_code_enabled: true }) })).status).toBe(200);
    const c = await customer();
    const { variant } = await product({ price: 50000, stock: 2, stock2: 2 });
    const r = await c.req<{ order: { total: number; unique_code: number; payment: { amount: number; uniqueCode: number; bank: { accountNo: string } } } }>('/shop/orders', {
      method: 'POST',
      json: { branch: 2, items: [{ variantId: variant.id, qty: 1 }], fulfillment: 'pickup' },
    });
    expect(r.status).toBe(201);
    const o = r.body.order;
    expect(o.unique_code).toBeGreaterThanOrEqual(1);
    expect(o.unique_code).toBeLessThanOrEqual(999);
    expect(o.total).toBe(50000 + o.unique_code);
    expect(o.payment).toMatchObject({ amount: o.total, uniqueCode: o.unique_code, bank: { accountNo: '1234567890' } });
    // cabang 1 tanpa kode unik
    const plain = await pickupOrder(c.id, variant.id, 1, 1);
    expect((await order(plain.id))!.unique_code).toBe(0);
    await admin(OWNER, '/shop/branches/2', { method: 'PUT', json: branchBody() });
  });

  it('Tandai Lunas dengan nominal berbeda → 409 AMOUNT_MISMATCH; dengan konfirmasi → lunas & nominal dicatat', async () => {
    const c = await customer();
    const { variant } = await product({ price: 70000 });
    const o = await pickupOrder(c.id, variant.id);
    const r = await admin<{ error: { code: string; details: { total: number; amount: number } } }>(OWNER, `/shop/orders/${o.id}/paid`, { method: 'POST', json: { amount: 69000 } });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: 'AMOUNT_MISMATCH', details: { total: 70000, amount: 69000 } });
    expect((await order(o.id))!.status).toBe('awaiting_payment');
    expect((await admin(OWNER, `/shop/orders/${o.id}/paid`, { method: 'POST', json: { amount: 69000, confirmMismatch: true } })).status).toBe(200);
    const p = await t.db.prepare('SELECT amount, status FROM payments WHERE order_id = ?').bind(o.id).first();
    expect(p).toEqual({ amount: 69000, status: 'confirmed' });
  });
});

describe('cron', () => {
  it('belum dibayar lewat batas → kedaluwarsa & reservasi dilepas; dikirim > 7 hari → selesai otomatis', async () => {
    const c = await customer();
    const { variant } = await product({ stock: 5 });
    const unpaid = await pickupOrder(c.id, variant.id, 2);
    const shipped = await createOrder(t.db, settings, {
      customerId: c.id,
      branchId: 1,
      fulfillment: 'ship_manual',
      items: [{ variantId: variant.id, qty: 1 }],
      paymentMethod: 'transfer',
      shipping: { recipientName: 'Budi', recipientPhone: '081299990000', address: 'Jl. Uji No. 1, Bogor' },
      actor: SYS,
    });
    await move(shipped.id, 'quote', { shippingFee: 10000 });
    await move(shipped.id, 'paid');
    await move(shipped.id, 'ship', { trackingNo: 'R1' });
    expect(await stock(variant.id)).toEqual({ on_hand: 4, reserved: 2 });

    await runShopCron(env as never, Date.now() + 23 * 3600_000); // belum lewat 24 jam / 7 hari
    expect((await order(unpaid.id))!.status).toBe('awaiting_payment');
    await runShopCron(env as never, Date.now() + 8 * DAY);
    expect((await order(unpaid.id))!.status).toBe('expired');
    expect(await order(shipped.id)).toMatchObject({ status: 'completed', completed_by: 'system' });
    expect(await stock(variant.id)).toEqual({ on_hand: 4, reserved: 0 });
  });

  it('lewat batas ambil → ditandai "belum diambil" + Telegram sekali, tidak dibatalkan', async () => {
    await t.db.prepare(`UPDATE branches SET telegram_chat_id = '-100123' WHERE id = 1`).run();
    const tg = { ...env, TELEGRAM_BOT_TOKEN: 'uji' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    try {
      const c = await customer();
      const { variant } = await product();
      const o = await pickupOrder(c.id, variant.id);
      await move(o.id, 'paid');
      await move(o.id, 'ready');
      await runShopCron(tg as never, Date.now() + 6 * DAY);
      expect((await order(o.id))!.pickup_overdue_notified_at).toBeNull();
      await runShopCron(tg as never, Date.now() + 8 * DAY);
      await runShopCron(tg as never, Date.now() + 9 * DAY);
      expect(await order(o.id)).toMatchObject({ status: 'ready' });
      expect((await order(o.id))!.pickup_overdue_notified_at).not.toBeNull();
      const calls = fetchSpy.mock.calls.filter(([, init]) => String((init as RequestInit)?.body ?? '').includes('belum diambil'));
      expect(calls).toHaveLength(1);
      // daftar admin: filter "belum diambil" (relatif waktu nyata → set batas ke masa lalu)
      await t.db.prepare('UPDATE orders SET pickup_due_at = ? WHERE id = ?').bind(new Date(Date.now() - 1000).toISOString(), o.id).run();
      const list = await admin<{ orders: { id: string; pickupOverdue: boolean }[] }>(OWNER, '/shop/orders?status=overdue');
      expect(list.body.orders.find((x) => x.id === o.id)?.pickupOverdue).toBe(true);
    } finally {
      fetchSpy.mockRestore();
      await t.db.prepare(`UPDATE branches SET telegram_chat_id = NULL WHERE id = 1`).run();
    }
  });
});

describe('stempel dari belanja', () => {
  const stamps = async (customerId: string) =>
    (await t.db.prepare(`SELECT kind, order_id, booking_id FROM loyalty_stamps WHERE customer_id = ? AND status = 'active'`).bind(customerId).all<{ kind: string; order_id: string | null }>()).results;

  beforeAll(async () => {
    const r = await admin(OWNER, '/loyalty/settings', {
      method: 'PUT',
      json: { enabled: true, tier1_stamps: 5, tier1_service_ids: [svc.wash], tier2_stamps: 10, tier2_service_ids: [svc.haircut], stamp_valid_months: 12, voucher_valid_days: 60 },
    });
    expect(r.status).toBe(200);
  });

  it('subtotal ≥ minimum → 1 stempel saat selesai; di bawah minimum / batal → tidak ada; maks. 1/hari bersama booking', async () => {
    const c = await customer();
    const big = await product({ price: 100000 });
    const small = await product({ price: 99000 });
    const cheap = await pickupOrder(c.id, small.variant.id);
    await move(cheap.id, 'paid');
    await move(cheap.id, 'ready');
    await move(cheap.id, 'complete');
    expect(await stamps(c.id)).toHaveLength(0);
    const cancelled = await pickupOrder(c.id, big.variant.id);
    await move(cancelled.id, 'cancel', { reason: 'uji' });
    expect(await stamps(c.id)).toHaveLength(0);

    // 12.00 WIB kemarin (tanggal lokal tetap sama untuk pesanan & booking, berapa pun jam tes dijalankan)
    const d = new Date(Date.now() - DAY);
    const now = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 5, 0, 0);
    const a = await pickupOrder(c.id, big.variant.id);
    await move(a.id, 'paid');
    await move(a.id, 'ready');
    await move(a.id, 'complete', {}, now);
    expect(await stamps(c.id)).toEqual([{ kind: 'order', order_id: a.id, booking_id: null }]);
    // pesanan kedua di hari yang sama → tidak menambah
    const b = await pickupOrder(c.id, big.variant.id);
    await move(b.id, 'paid');
    await move(b.id, 'ready');
    await move(b.id, 'complete', {}, now + 60_000);
    expect(await stamps(c.id)).toHaveLength(1);
    // booking selesai di tanggal yang sama → tetap 1 (batas harian gabungan)
    const bookingId = uid('sb');
    await t.db
      .prepare(
        `INSERT INTO bookings (id, code, branch_id, barber_id, service_id, customer_id, start_at, end_at, price_snapshot, duration_snapshot, service_name_snapshot, status, source)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?, 100000, 45, 'Layanan uji', 'confirmed', 'admin')`,
      )
      .bind(bookingId, `SB${String(seq).padStart(6, '0')}`, barber1, svc.haircut, c.id, new Date(now - 2 * 3600_000).toISOString(), new Date(now - 3600_000).toISOString())
      .run();
    expect((await admin(OWNER, `/bookings/${bookingId}/status`, { method: 'POST', json: { status: 'completed' } })).status).toBe(200);
    expect(await stamps(c.id)).toHaveLength(1);
  });
});

describe('ambil saat booking', () => {
  async function futureBooking(customerId: string) {
    const id = uid('wb');
    const start = Date.now() + 3 * DAY;
    await t.db
      .prepare(
        `INSERT INTO bookings (id, code, branch_id, barber_id, service_id, customer_id, start_at, end_at, price_snapshot, duration_snapshot, service_name_snapshot, status, source)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?, 100000, 45, 'Layanan uji', 'confirmed', 'online')`,
      )
      .bind(id, `WB${String(seq).padStart(6, '0')}`, barber1, svc.haircut, customerId, new Date(start).toISOString(), new Date(start + 45 * 60_000).toISOString())
      .run();
    return id;
  }

  it('produk ditambahkan ke booking → reservasi; dibayar di kasir saat selesai (stok berkurang)', async () => {
    const c = await customer();
    const { variant } = await product({ stock: 4 });
    const bookingId = await futureBooking(c.id);
    const r = await c.req<{ order: { id: string; status: string; payment_method: string } }>(`/bookings/${bookingId}/products`, { method: 'POST', json: { items: [{ variantId: variant.id, qty: 2 }] } });
    expect(r.status).toBe(201);
    expect(r.body.order).toMatchObject({ status: 'reserved_booking', payment_method: 'cashier' });
    expect(await stock(variant.id)).toEqual({ on_hand: 4, reserved: 2 });
    const linked = await admin<{ orders: { id: string }[] }>(OWNER, `/bookings/${bookingId}/orders`);
    expect(linked.body.orders.map((o) => o.id)).toEqual([r.body.order.id]);
    expect((await admin(OWNER, `/shop/orders/${r.body.order.id}/complete`, { method: 'POST', json: {} })).status).toBe(200);
    expect(await stock(variant.id)).toEqual({ on_hand: 2, reserved: 0 });
    const p = await t.db.prepare('SELECT method, amount FROM payments WHERE order_id = ?').bind(r.body.order.id).first();
    expect(p).toEqual({ method: 'cashier', amount: 200000 });
    // booking milik orang lain ditolak
    expect((await (await customer()).req(`/bookings/${bookingId}/products`, { method: 'POST', json: { items: [{ variantId: variant.id, qty: 1 }] } })).status).toBe(404);
  });

  /** Booking hari ini yang sudah lewat (siap ditandai Selesai) + pesanan ambil saat booking */
  async function servedBookingWithOrder(qty = 1) {
    const c = await customer();
    const { variant } = await product({ stock: 5, price: 60000 });
    const id = uid('sv');
    const start = Date.now() - 2 * 3600_000;
    await t.db
      .prepare(
        `INSERT INTO bookings (id, code, branch_id, barber_id, service_id, customer_id, start_at, end_at, price_snapshot, duration_snapshot, service_name_snapshot, status, source)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?, 100000, 45, 'Layanan uji', 'confirmed', 'online')`,
      )
      .bind(id, `SV${String(seq).padStart(6, '0')}`, barber1, svc.wash, c.id, new Date(start).toISOString(), new Date(start + 45 * 60_000).toISOString())
      .run();
    const o = await createOrder(t.db, settings, { customerId: c.id, branchId: 1, fulfillment: 'with_booking', bookingId: id, items: [{ variantId: variant.id, qty }], paymentMethod: 'transfer', actor: { type: 'customer', id: c.id } });
    return { bookingId: id, orderId: o.id, variant };
  }
  const completeBooking = (bookingId: string, productOrders?: string, as = OWNER) =>
    admin<{ productOrders?: { done: number; failed: number } }>(as, `/bookings/${bookingId}/status`, { method: 'POST', json: { status: 'completed', ...(productOrders ? { productOrders } : {}) } });

  it('booking Selesai + "Produk sudah dibayar & diambil" → pesanan selesai, bayar kasir, stok berkurang', async () => {
    const { bookingId, orderId, variant } = await servedBookingWithOrder(2);
    const r = await completeBooking(bookingId, 'paid');
    expect(r.status).toBe(200);
    expect(r.body.productOrders).toEqual({ done: 1, failed: 0 });
    expect(await order(orderId)).toMatchObject({ status: 'completed', completed_by: 'admin' });
    expect(await stock(variant.id)).toEqual({ on_hand: 3, reserved: 0 });
    expect(await t.db.prepare('SELECT method, amount FROM payments WHERE order_id = ?').bind(orderId).first()).toEqual({ method: 'cashier', amount: 120000 });
  });

  it('booking Selesai + "Batalkan pesanan produk" → pesanan batal, reservasi dilepas', async () => {
    const { bookingId, orderId, variant } = await servedBookingWithOrder();
    expect((await completeBooking(bookingId, 'cancel')).status).toBe(200);
    expect(await order(orderId)).toMatchObject({ status: 'cancelled', cancel_reason: 'Dibatalkan saat booking ditandai Selesai' });
    expect(await stock(variant.id)).toEqual({ on_hand: 5, reserved: 0 });
  });

  it('booking Selesai tanpa pilihan → pesanan tetap terbuka & muncul di "Belum diambil"; hairstylist tidak bisa memproses produk', async () => {
    const { bookingId, orderId, variant } = await servedBookingWithOrder();
    expect((await completeBooking(bookingId, 'paid', BARBER)).status).toBe(403);
    expect((await completeBooking(bookingId, undefined, BARBER)).status).toBe(200);
    expect(await order(orderId)).toMatchObject({ status: 'reserved_booking' });
    expect(await stock(variant.id)).toEqual({ on_hand: 5, reserved: 1 });
    const list = await admin<{ orders: { id: string; pickupOverdue: boolean }[] }>(OWNER, '/shop/orders?status=overdue&limit=50');
    expect(list.body.orders.find((o) => o.id === orderId)?.pickupOverdue).toBe(true);
    const detail = await admin<{ order: { pickupOverdue: boolean; actions: string[] } }>(OWNER, `/shop/orders/${orderId}`);
    expect(detail.body.order).toMatchObject({ pickupOverdue: true });
    expect(detail.body.order.actions).toEqual(expect.arrayContaining(['complete', 'cancel']));
    const sum = await admin<{ pickupOverdue: number }>(OWNER, '/shop/summary');
    expect(sum.body.pickupOverdue).toBeGreaterThan(0);
    // booking yang belum Selesai tidak termasuk "Belum diambil"
    const fresh = await servedBookingWithOrder();
    const again = await admin<{ orders: { id: string }[] }>(OWNER, '/shop/orders?status=overdue&limit=50');
    expect(again.body.orders.some((o) => o.id === fresh.orderId)).toBe(false);
  });

  it('booking dibatalkan → pesanan ikut batal & reservasi dilepas (dalam batch yang sama)', async () => {
    const c = await customer();
    const { variant } = await product({ stock: 3 });
    const bookingId = await futureBooking(c.id);
    const r = await c.req<{ order: { id: string } }>(`/bookings/${bookingId}/products`, { method: 'POST', json: { items: [{ variantId: variant.id, qty: 1 }] } });
    expect(r.status).toBe(201);
    expect(await stock(variant.id)).toEqual({ on_hand: 3, reserved: 1 });
    expect((await admin(OWNER, `/bookings/${bookingId}/status`, { method: 'POST', json: { status: 'cancelled', reason: 'uji' } })).status).toBe(200);
    expect(await order(r.body.order.id)).toMatchObject({ status: 'cancelled', cancelled_by: 'system' });
    expect(await stock(variant.id)).toEqual({ on_hand: 3, reserved: 0 });
    const audit = await t.db.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE action = 'order.cancelled' AND entity_id = ?`).bind(r.body.order.id).first<{ n: number }>();
    expect(audit!.n).toBe(1);
  });
});

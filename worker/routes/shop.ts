/** Cutless Shop untuk pelanggan: konfigurasi, katalog, hitung keranjang, pesanan, pesanan saya, produk di booking. */
import type { Context } from 'hono';
import { bookingProductsBody, shopOrderBody, shopQuoteBody } from '../../shared/schemas';
import { createRouter, type AppEnv } from '../app';
import { getBooking } from '../lib/bookings';
import { ApiError, badRequest, notFound } from '../lib/errors';
import { assertSameOrigin, rateLimit, verifyTurnstile } from '../lib/guard';
import { body, defer } from '../lib/http';
import { finishPage, keysetWhere, pageParams } from '../lib/pagination';
import { shippingProvider } from '../lib/shipping';
import { readSession } from '../lib/session';
import {
  allowedActions,
  branchShop,
  createOrder,
  FULFILLMENT_LABEL,
  fulfillmentOptions,
  hydrateProducts,
  listBranchShops,
  notifyShop,
  NOT_PICKED_UP_SQL,
  ORDER_STATUS_LABEL,
  orderItems,
  paymentInfo,
  priceCart,
  shopActive,
  transitionOrder,
  type Fulfillment,
  type OrderRow,
  type ShopSettings,
} from '../lib/shop';
import { requireCompleteProfile, requireCustomer } from '../middleware/customer';

export const shopRoutes = createRouter();

async function requireShop(c: Context<AppEnv>): Promise<ShopSettings> {
  const s = await shopActive(c.env);
  if (!s) throw new ApiError(404, 'FEATURE_DISABLED', 'Toko belum dibuka.');
  return s;
}

const PRODUCT_COLS = 'id, slug, name, category, description, notes, badge, is_active, sort_order, release_at, per_customer_limit';

/** GET /api/shop/config → { enabled, branches (cara terima, pembayaran), aturan } */
shopRoutes.get('/shop/config', async (c) => {
  const s = await shopActive(c.env);
  c.header('Cache-Control', 'public, max-age=60');
  if (!s) return c.json({ enabled: false });
  const auto = shippingProvider(c.env, s).name !== 'manual';
  const branches = (await listBranchShops(c.env.DB)).map((b) => ({
    id: b.branch_id,
    slug: b.slug,
    name: b.name,
    city: b.city,
    status: b.status,
    whatsapp: b.whatsapp,
    fulfillment: fulfillmentOptions(b, auto),
    payment: { transfer: Boolean(b.bank_account_no), qris: Boolean(b.qris_image), uniqueCode: b.unique_code_enabled },
  }));
  const { results } = await c.env.DB.prepare(`SELECT DISTINCT category FROM products WHERE is_active = 1 ORDER BY category`).all<{ category: string }>();
  return c.json({
    enabled: true,
    branches,
    categories: results.map((r) => r.category),
    paymentWindowMin: s.payment_window_min,
    pickupWindowDays: s.pickup_window_days,
    returnPolicy: s.return_policy,
    stampMinSubtotal: s.stamp_min_subtotal,
  });
});

/** GET /api/shop/products?category=&limit=&cursor= → { products, nextCursor } (urutan tampil) */
shopRoutes.get('/shop/products', async (c) => {
  await requireShop(c);
  const page = pageParams(c);
  const category = c.req.query('category') ?? '';
  const { results } = await c.env.DB.prepare(
    `SELECT ${PRODUCT_COLS} FROM products WHERE is_active = 1 AND (?1 = '' OR category = ?1)
       ${page.cursor ? `AND ${keysetWhere('sort_order', 'id', 'asc', 2)}` : ''}
     ORDER BY sort_order, id LIMIT ?4`,
  )
    .bind(category, page.cursor?.[0] ?? null, page.cursor ? Number(page.cursor[1]) : null, page.limit + 1)
    .all<Parameters<typeof hydrateProducts>[1][number]>();
  const { items, nextCursor } = finishPage(results, page.limit, (r) => [r.sort_order, r.id]);
  c.header('Cache-Control', 'public, max-age=30');
  return c.json({ products: await hydrateProducts(c.env.DB, items), nextCursor });
});

shopRoutes.get('/shop/products/:slug', async (c) => {
  await requireShop(c);
  const row = await c.env.DB.prepare(`SELECT ${PRODUCT_COLS} FROM products WHERE slug = ? AND is_active = 1`).bind(c.req.param('slug')).first<Parameters<typeof hydrateProducts>[1][number]>();
  if (!row) throw notFound('Produk tidak ditemukan.');
  c.header('Cache-Control', 'public, max-age=30');
  return c.json({ product: (await hydrateProducts(c.env.DB, [row]))[0] });
});

/** POST /api/shop/quote → harga, stok, batas beli, opsi ongkir (dihitung server; keranjang klien tidak dipercaya) */
shopRoutes.post('/shop/quote', async (c) => {
  const s = await requireShop(c);
  const input = await body(c, shopQuoteBody);
  const customerId = await optionalCustomerId(c);
  const priced = await priceCart(c.env.DB, { branchId: input.branch, items: input.items, customerId, now: Date.now() });
  let rates = null;
  if (input.fulfillment === 'ship_auto' && input.regionId) {
    const b = await branchShop(c.env.DB, input.branch);
    if (b.origin_region_id) rates = await shippingProvider(c.env, s).quote(b.origin_region_id, input.regionId, priced.weightGram);
  }
  return c.json({ ...priced, rates });
});

/** Pelanggan login (opsional) untuk menghitung batas beli; tanpa login tetap bisa menghitung harga */
async function optionalCustomerId(c: Context<AppEnv>): Promise<string | null> {
  return (await readSession(c))?.id ?? null;
}

shopRoutes.use('/shop/regions', requireCustomer);
/** GET /api/shop/regions?q= → wilayah tujuan (hanya bila ongkir otomatis aktif; dari cache D1 bila ada) */
shopRoutes.get('/shop/regions', async (c) => {
  const s = await requireShop(c);
  const provider = shippingProvider(c.env, s);
  return c.json({ regions: await provider.searchRegions(c.req.query('q') ?? '') });
});

shopRoutes.use('/shop/orders', requireCustomer, requireCompleteProfile);
/** POST /api/shop/orders → pesanan baru (Turnstile + rate limit + reservasi stok atomik) */
shopRoutes.post('/shop/orders', async (c) => {
  assertSameOrigin(c);
  const s = await requireShop(c);
  const input = await body(c, shopOrderBody);
  await rateLimit(c, 'shop_order', 10, 60);
  await verifyTurnstile(c, input.turnstileToken);
  const me = c.get('customer')!;
  return c.json(await placeOrder(c, s, me.id, input.branch, input.fulfillment, input), 201);
});

shopRoutes.use('/bookings/:id/products', requireCustomer, requireCompleteProfile);
/** POST /api/bookings/:id/products { items } → produk diambil & dibayar di kasir saat booking */
shopRoutes.post('/bookings/:id/products', async (c) => {
  assertSameOrigin(c);
  const s = await requireShop(c);
  const input = await body(c, bookingProductsBody);
  await rateLimit(c, 'shop_order', 10, 60);
  const me = c.get('customer')!;
  const booking = await getBooking(c.env.DB, c.req.param('id')!).catch(() => null);
  if (!booking || booking.customer_id !== me.id) throw notFound('Booking tidak ditemukan.');
  return c.json(
    await placeOrder(c, s, me.id, booking.branch_id, 'with_booking', { items: input.items, note: input.note, bookingId: booking.id, paymentMethod: 'transfer' as const }),
    201,
  );
});

async function placeOrder(
  c: Context<AppEnv>,
  s: ShopSettings,
  customerId: string,
  branchId: number,
  requested: Fulfillment,
  input: { items: { variantId: number; qty: number }[]; paymentMethod: 'transfer' | 'qris'; note?: string | null; bookingId?: string | null; shipping?: Parameters<typeof createOrder>[2]['shipping']; rate?: { courier: string; service: string } | null },
) {
  const b = await branchShop(c.env.DB, branchId);
  const provider = shippingProvider(c.env, s);
  const options = fulfillmentOptions(b, provider.name !== 'manual');
  let fulfillment = requested;
  // Ongkir otomatis tidak tersedia (mati/kuota/error) → turun ke ongkir manual bila cabang mengirim
  if (fulfillment === 'ship_auto' && !options.includes('ship_auto') && (b.ship_manual_enabled || b.ship_auto_enabled)) fulfillment = 'ship_manual';
  if (!options.includes(fulfillment) && !(fulfillment === 'ship_manual' && (b.ship_manual_enabled || b.ship_auto_enabled))) {
    throw badRequest(`Cara terima "${FULFILLMENT_LABEL[requested]}" tidak tersedia di cabang ini.`);
  }
  let rate: { courier: string; service: string; cost: number } | null = null;
  if (fulfillment === 'ship_auto') {
    const priced = await priceCart(c.env.DB, { branchId, items: input.items, customerId, now: Date.now() });
    const rates = input.shipping?.regionId && b.origin_region_id ? await provider.quote(b.origin_region_id, input.shipping.regionId, priced.weightGram) : null;
    const chosen = rates?.find((r) => r.courier === input.rate?.courier && r.service === input.rate?.service);
    if (chosen) rate = { courier: chosen.courier, service: chosen.service, cost: chosen.cost };
    else fulfillment = 'ship_manual';
  }
  if (fulfillment === 'with_booking') {
    const booking = input.bookingId ? await getBooking(c.env.DB, input.bookingId).catch(() => null) : null;
    if (!booking || booking.customer_id !== customerId) throw badRequest('Booking tidak ditemukan.');
    if (!['pending', 'confirmed'].includes(booking.status) || Date.parse(booking.start_at) <= Date.now()) throw badRequest('Produk hanya bisa ditambahkan ke booking aktif yang akan datang.');
    if (booking.branch_id !== branchId) throw badRequest('Cabang pesanan harus sama dengan cabang booking.');
  }
  const created = await createOrder(c.env.DB, s, {
    customerId,
    branchId,
    fulfillment,
    items: input.items,
    paymentMethod: input.paymentMethod,
    bookingId: fulfillment === 'with_booking' ? input.bookingId : null,
    shipping: input.shipping ?? null,
    rate,
    note: input.note ?? null,
    actor: { type: 'customer', id: customerId },
  });
  await defer(c, notifyShop(c.env, branchId, created.status === 'awaiting_quote' ? 'awaiting_quote' : 'new', created.id));
  return { order: await presentOrder(c.env.DB, created.id, 'customer'), fallbackToManual: requested === 'ship_auto' && fulfillment === 'ship_manual' };
}

/* ---------- Pesanan saya ---------- */

/** Bentuk respons pesanan (pelanggan / admin) */
export async function presentOrder(db: D1Database, id: string, viewer: 'customer' | 'admin') {
  const o = await db
    .prepare(`SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email, ${NOT_PICKED_UP_SQL('o', '?2')} AS not_picked_up
       FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?1`)
    .bind(id, new Date().toISOString())
    .first<OrderRow & Record<string, unknown> & { not_picked_up: number }>();
  if (!o) throw notFound('Pesanan tidak ditemukan.');
  const b = await branchShop(db, o.branch_id);
  const items = (await orderItems(db, [o.id])).get(o.id) ?? [];
  const { transition_id: _t, not_picked_up: _n, ...rest } = o as Record<string, unknown>;
  return {
    ...(viewer === 'admin' ? rest : withoutAdminFields(rest)),
    statusLabel: ORDER_STATUS_LABEL[o.status],
    fulfillmentLabel: FULFILLMENT_LABEL[o.fulfillment],
    branch: { id: b.branch_id, slug: b.slug, name: b.name, whatsapp: b.whatsapp, timezone: b.timezone },
    items,
    payment: paymentInfo(o, b),
    pickupOverdue: Boolean(o.not_picked_up),
    actions: allowedActions(o, viewer),
  };
}

const withoutAdminFields = (o: Record<string, unknown>) => {
  const { admin_note: _a, customer_phone: _p, customer_email: _e, pickup_overdue_notified_at: _n, completed_by: _c, ...rest } = o;
  return rest;
};

shopRoutes.use('/me/orders', requireCustomer);
shopRoutes.use('/me/orders/*', requireCustomer);

/** GET /api/me/orders?limit=&cursor= → { orders, nextCursor } (terbaru dulu) */
shopRoutes.get('/me/orders', async (c) => {
  const me = c.get('customer')!;
  const page = pageParams(c);
  const { results } = await c.env.DB.prepare(
    `SELECT id, code, status, fulfillment, total, branch_id, created_at, payment_due_at, booking_id FROM orders WHERE customer_id = ?1
       ${page.cursor ? `AND ${keysetWhere('created_at', 'id', 'desc', 2)}` : ''}
     ORDER BY created_at DESC, id DESC LIMIT ?4`,
  )
    .bind(me.id, page.cursor?.[0] ?? null, page.cursor?.[1] ?? null, page.limit + 1)
    .all<{ id: string; created_at: string; status: OrderRow['status']; fulfillment: Fulfillment } & Record<string, unknown>>();
  const { items, nextCursor } = finishPage(results, page.limit, (r) => [r.created_at, r.id]);
  const lines = await orderItems(c.env.DB, items.map((o) => o.id));
  return c.json({
    orders: items.map((o) => ({ ...o, statusLabel: ORDER_STATUS_LABEL[o.status], fulfillmentLabel: FULFILLMENT_LABEL[o.fulfillment], items: lines.get(o.id) ?? [] })),
    nextCursor,
  });
});

shopRoutes.get('/me/orders/:id', async (c) => {
  const me = c.get('customer')!;
  const o = await c.env.DB.prepare('SELECT customer_id FROM orders WHERE id = ?').bind(c.req.param('id')).first<{ customer_id: string }>();
  if (!o || o.customer_id !== me.id) throw notFound('Pesanan tidak ditemukan.');
  return c.json({ order: await presentOrder(c.env.DB, c.req.param('id'), 'customer') });
});

/** POST /api/me/orders/:id/cancel · /received */
shopRoutes.post('/me/orders/:id/:action{cancel|received}', async (c) => {
  assertSameOrigin(c);
  const s = await requireShop(c);
  const me = c.get('customer')!;
  const action = c.req.param('action') === 'cancel' ? 'cancel' : 'complete';
  await transitionOrder(c.env, s, {
    orderId: c.req.param('id'),
    action,
    actor: 'customer',
    audit: { type: 'customer', id: me.id },
    customerId: me.id,
    data: action === 'cancel' ? { reason: 'Dibatalkan pelanggan' } : {},
  });
  return c.json({ order: await presentOrder(c.env.DB, c.req.param('id'), 'customer') });
});

/** Admin Cutless Shop: pengaturan, produk & varian, stok per cabang, pesanan & transisi, pesanan per booking. */
import type { Context } from 'hono';
import { orderActionBody, productBody, shopBranchBody, shopSettingsBody, stockBody } from '../../../shared/schemas';
import { createRouter, type AppEnv } from '../../app';
import { auditStmt } from '../../lib/bookings';
import { ApiError, badRequest, forbidden, notFound } from '../../lib/errors';
import { body, defer } from '../../lib/http';
import { finishPage, keysetWhere, pageParams } from '../../lib/pagination';
import { shippingProvider } from '../../lib/shipping';
import {
  FULFILLMENT_LABEL,
  getOrder,
  getShopSettings,
  hydrateProducts,
  listBranchShops,
  notifyShop,
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  orderItems,
  shopActive,
  shopEnv,
  transitionOrder,
  type OrderAction,
  type ShopSettings,
} from '../../lib/shop';
import { allowRoles, assertBranch, auditActor, branchScope } from '../../middleware/admin';
import { presentOrder } from '../shop';

export const adminShopRoutes = createRouter();
adminShopRoutes.use('/shop/*', allowRoles('owner', 'branch_admin'));

async function requireShop(c: Context<AppEnv>): Promise<ShopSettings> {
  const s = await shopActive(c.env);
  if (!s) throw new ApiError(404, 'FEATURE_DISABLED', 'Toko belum aktif.');
  return s;
}

/* ---------- Pengaturan ---------- */

/** GET /api/admin/shop/settings → { available (env), settings, branches } */
adminShopRoutes.get('/shop/settings', async (c) => {
  const settings = await getShopSettings(c.env.DB);
  const auto = settings ? shippingProvider(c.env, settings).name !== 'manual' : false;
  return c.json({ available: shopEnv(c.env), autoShipping: auto, settings, branches: await listBranchShops(c.env.DB) });
});

adminShopRoutes.put('/shop/settings', allowRoles('owner'), async (c) => {
  if (!shopEnv(c.env)) throw new ApiError(404, 'FEATURE_DISABLED', 'Fitur toko belum tersedia di server ini (SHOP_ENABLED).');
  const admin = c.get('admin')!;
  const s = await body(c, shopSettingsBody);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE shop_settings SET enabled = ?, payment_window_min = ?, pickup_window_days = ?, auto_complete_days = ?, stamp_min_subtotal = ?,
         low_stock_threshold = ?, return_policy = ?, shipping_provider = ?, shipping_daily_limit = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), updated_by = ? WHERE id = 1`,
    ).bind(s.enabled ? 1 : 0, s.payment_window_min, s.pickup_window_days, s.auto_complete_days, s.stamp_min_subtotal, s.low_stock_threshold, s.return_policy, s.shipping_provider, s.shipping_daily_limit, admin.email),
    auditStmt(c.env.DB, auditActor(admin), 'shop.settings', 'shop', 'settings', s),
  ]);
  return c.json({ settings: await getShopSettings(c.env.DB) });
});

adminShopRoutes.put('/shop/branches/:id', allowRoles('owner'), async (c) => {
  const admin = c.get('admin')!;
  const id = Number(c.req.param('id'));
  const s = await body(c, shopBranchBody);
  const b = (v: boolean) => (v ? 1 : 0);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO shop_branch_settings (branch_id, pickup_enabled, with_booking_enabled, ship_manual_enabled, ship_auto_enabled, bank_name, bank_account_no,
         bank_account_name, qris_image, payment_note, unique_code_enabled, origin_region_id, origin_label, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT (branch_id) DO UPDATE SET pickup_enabled = excluded.pickup_enabled, with_booking_enabled = excluded.with_booking_enabled,
         ship_manual_enabled = excluded.ship_manual_enabled, ship_auto_enabled = excluded.ship_auto_enabled, bank_name = excluded.bank_name,
         bank_account_no = excluded.bank_account_no, bank_account_name = excluded.bank_account_name, qris_image = excluded.qris_image,
         payment_note = excluded.payment_note, unique_code_enabled = excluded.unique_code_enabled, origin_region_id = excluded.origin_region_id,
         origin_label = excluded.origin_label, updated_at = excluded.updated_at`,
    ).bind(
      id,
      b(s.pickup_enabled),
      b(s.with_booking_enabled),
      b(s.ship_manual_enabled),
      b(s.ship_auto_enabled),
      s.bank_name,
      s.bank_account_no,
      s.bank_account_name,
      s.qris_image,
      s.payment_note,
      b(s.unique_code_enabled),
      s.origin_region_id,
      s.origin_label,
    ),
    auditStmt(c.env.DB, auditActor(admin), 'shop.branch_settings', 'branch', id, s),
  ]);
  return c.json({ branches: await listBranchShops(c.env.DB) });
});

/** GET /api/admin/shop/regions?q= → cari wilayah asal (ongkir otomatis) */
adminShopRoutes.get('/shop/regions', allowRoles('owner'), async (c) => {
  const s = await requireShop(c);
  return c.json({ regions: await shippingProvider(c.env, s).searchRegions(c.req.query('q') ?? '') });
});

/* ---------- Produk ---------- */

const PRODUCT_COLS = 'id, slug, name, category, description, notes, badge, is_active, sort_order, release_at, per_customer_limit';

/** GET /api/admin/shop/products?q=&limit=&cursor= (termasuk nonaktif) */
adminShopRoutes.get('/shop/products', async (c) => {
  const page = pageParams(c);
  const q = `%${(c.req.query('q') ?? '').trim().toLowerCase()}%`;
  const { results } = await c.env.DB.prepare(
    `SELECT ${PRODUCT_COLS} FROM products WHERE (lower(name) LIKE ?1 OR lower(category) LIKE ?1)
       ${page.cursor ? `AND ${keysetWhere('sort_order', 'id', 'asc', 2)}` : ''}
     ORDER BY sort_order, id LIMIT ?4`,
  )
    .bind(q, page.cursor?.[0] ?? null, page.cursor ? Number(page.cursor[1]) : null, page.limit + 1)
    .all<Parameters<typeof hydrateProducts>[1][number]>();
  const { items, nextCursor } = finishPage(results, page.limit, (r) => [r.sort_order, r.id]);
  return c.json({ products: await hydrateProducts(c.env.DB, items, { includeInactiveVariants: true }), nextCursor });
});

/** Simpan produk + foto (ganti semua) + varian (upsert; varian lama yang tidak dikirim dinonaktifkan, bukan dihapus) */
async function saveProduct(c: Context<AppEnv>, productId: number | null) {
  const admin = c.get('admin')!;
  const p = await body(c, productBody);
  const db = c.env.DB;
  const dup = await db.prepare('SELECT id FROM products WHERE slug = ? AND id <> ?').bind(p.slug, productId ?? 0).first();
  if (dup) throw badRequest('Slug sudah dipakai produk lain.');
  const id = productId ?? ((await db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM products').first<{ id: number }>())!.id);
  const keepIds = p.variants.filter((v) => v.id).map((v) => v.id!);
  if (productId && keepIds.length) {
    const own = await db.prepare(`SELECT COUNT(*) AS n FROM product_variants WHERE product_id = ?1 AND id IN (SELECT value FROM json_each(?2))`).bind(productId, JSON.stringify(keepIds)).first<{ n: number }>();
    if (own!.n !== keepIds.length) throw badRequest('Ada varian yang bukan milik produk ini.');
  }
  await db.batch([
    db
      .prepare(
        `INSERT INTO products (id, slug, name, category, description, notes, badge, is_active, sort_order, release_at, per_customer_limit, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT (id) DO UPDATE SET slug = excluded.slug, name = excluded.name, category = excluded.category, description = excluded.description,
           notes = excluded.notes, badge = excluded.badge, is_active = excluded.is_active, sort_order = excluded.sort_order,
           release_at = excluded.release_at, per_customer_limit = excluded.per_customer_limit, updated_at = excluded.updated_at`,
      )
      .bind(id, p.slug, p.name, p.category, p.description, p.notes, p.badge, p.is_active ? 1 : 0, p.sort_order, p.release_at ? new Date(p.release_at).toISOString() : null, p.per_customer_limit),
    db.prepare('DELETE FROM product_images WHERE product_id = ?').bind(id),
    ...p.images.map((img, i) => db.prepare('INSERT INTO product_images (product_id, path, alt, sort_order) VALUES (?, ?, ?, ?)').bind(id, img.path, img.alt ?? null, i)),
    db.prepare(`UPDATE product_variants SET is_active = 0 WHERE product_id = ?1 AND id NOT IN (SELECT value FROM json_each(?2))`).bind(id, JSON.stringify(keepIds)),
    ...p.variants.map((v, i) =>
      v.id
        ? db
            .prepare(`UPDATE product_variants SET sku = ?, name = ?, options = ?, price = ?, compare_at_price = ?, weight_gram = ?, is_active = ?, sort_order = ? WHERE id = ? AND product_id = ?`)
            .bind(v.sku, v.name, JSON.stringify(v.options), v.price, v.compare_at_price, v.weight_gram, v.is_active ? 1 : 0, i, v.id, id)
        : db
            .prepare(`INSERT INTO product_variants (product_id, sku, name, options, price, compare_at_price, weight_gram, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(id, v.sku, v.name, JSON.stringify(v.options), v.price, v.compare_at_price, v.weight_gram, v.is_active ? 1 : 0, i),
    ),
    auditStmt(db, auditActor(admin), productId ? 'product.update' : 'product.create', 'product', id, { slug: p.slug, variants: p.variants.length }),
  ]);
  const row = await db.prepare(`SELECT ${PRODUCT_COLS} FROM products WHERE id = ?`).bind(id).first<Parameters<typeof hydrateProducts>[1][number]>();
  return (await hydrateProducts(db, [row!], { includeInactiveVariants: true }))[0];
}

adminShopRoutes.post('/shop/products', allowRoles('owner'), async (c) => c.json({ product: await saveProduct(c, null) }, 201));
adminShopRoutes.put('/shop/products/:id', allowRoles('owner'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!(await c.env.DB.prepare('SELECT 1 AS x FROM products WHERE id = ?').bind(id).first())) throw notFound('Produk tidak ditemukan.');
  return c.json({ product: await saveProduct(c, id) });
});

/**
 * PUT /api/admin/shop/stock { branchId, variantId, onHand, reason } → set stok fisik (owner: semua cabang; admin cabang: cabangnya).
 * Tidak bisa lebih kecil dari jumlah yang sedang dipesan (reserved).
 */
adminShopRoutes.put('/shop/stock', async (c) => {
  const admin = c.get('admin')!;
  const s = await body(c, stockBody);
  assertBranch(admin, s.branchId);
  const before = await c.env.DB.prepare('SELECT on_hand, reserved FROM variant_stock WHERE branch_id = ? AND variant_id = ?').bind(s.branchId, s.variantId).first<{ on_hand: number; reserved: number }>();
  if (before && s.onHand < before.reserved) throw new ApiError(409, 'STOCK_UNAVAILABLE', `Stok tidak bisa di bawah ${before.reserved} (sedang dipesan).`);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO variant_stock (branch_id, variant_id, on_hand, reserved) VALUES (?1, ?2, ?3, 0)
       ON CONFLICT (branch_id, variant_id) DO UPDATE SET on_hand = excluded.on_hand, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    ).bind(s.branchId, s.variantId, s.onHand),
    auditStmt(c.env.DB, auditActor(admin), 'stock.set', 'variant', s.variantId, { branch: s.branchId, from: before?.on_hand ?? 0, to: s.onHand, reason: s.reason }),
  ]);
  const after = await c.env.DB.prepare('SELECT on_hand, reserved FROM variant_stock WHERE branch_id = ? AND variant_id = ?').bind(s.branchId, s.variantId).first();
  return c.json({ stock: after });
});

/* ---------- Pesanan ---------- */

/** GET /api/admin/shop/orders?status=&branch=&q=&limit=&cursor= (admin cabang: cabangnya) */
adminShopRoutes.get('/shop/orders', async (c) => {
  const admin = c.get('admin')!;
  const page = pageParams(c);
  const scope = branchScope(admin, c.req.query('branch') ? Number(c.req.query('branch')) : undefined);
  const status = c.req.query('status') ?? '';
  // "overdue" = siap diambil tetapi lewat batas ambil
  const overdue = status === 'overdue';
  if (status && !overdue && !(ORDER_STATUSES as readonly string[]).includes(status)) throw badRequest('Status tidak dikenal.');
  const q = (c.req.query('q') ?? '').trim().toUpperCase();
  const nowIso = new Date().toISOString();
  const { results } = await c.env.DB.prepare(
    `SELECT o.id, o.code, o.status, o.fulfillment, o.total, o.subtotal, o.shipping_fee, o.branch_id, o.created_at, o.payment_due_at, o.pickup_due_at,
            o.booking_id, br.name AS branch_name, cu.name AS customer_name
     FROM orders o JOIN branches br ON br.id = o.branch_id JOIN customers cu ON cu.id = o.customer_id
     WHERE (?1 IS NULL OR o.branch_id = ?1)
       AND (?2 = '' OR o.status = ?2)
       AND (?3 = 0 OR (o.status = 'ready' AND o.pickup_due_at <= ?4))
       AND (?5 = '' OR o.code LIKE '%' || ?5 || '%' OR upper(cu.name) LIKE '%' || ?5 || '%')
       ${page.cursor ? `AND ${keysetWhere('o.created_at', 'o.id', 'desc', 6)}` : ''}
     ORDER BY o.created_at DESC, o.id DESC LIMIT ?8`,
  )
    .bind(scope ?? null, overdue ? '' : status, overdue ? 1 : 0, nowIso, q, page.cursor?.[0] ?? null, page.cursor?.[1] ?? null, page.limit + 1)
    .all<{ id: string; created_at: string; status: (typeof ORDER_STATUSES)[number]; fulfillment: keyof typeof FULFILLMENT_LABEL; pickup_due_at: string | null } & Record<string, unknown>>();
  const { items, nextCursor } = finishPage(results, page.limit, (r) => [r.created_at, r.id]);
  const lines = await orderItems(c.env.DB, items.map((o) => o.id));
  return c.json({
    orders: items.map((o) => ({
      ...o,
      statusLabel: ORDER_STATUS_LABEL[o.status],
      fulfillmentLabel: FULFILLMENT_LABEL[o.fulfillment],
      pickupOverdue: o.status === 'ready' && Boolean(o.pickup_due_at) && o.pickup_due_at! <= nowIso,
      items: lines.get(o.id) ?? [],
    })),
    nextCursor,
  });
});

async function scopedOrder(c: Context<AppEnv>, id: string) {
  const admin = c.get('admin')!;
  const o = await getOrder(c.env.DB, id);
  assertBranch(admin, o.branch_id);
  return o;
}

adminShopRoutes.get('/shop/orders/:id', async (c) => {
  await scopedOrder(c, c.req.param('id')!);
  return c.json({ order: await presentOrder(c.env.DB, c.req.param('id')!, 'admin') });
});

const ACTIONS: Record<string, OrderAction> = { quote: 'quote', paid: 'paid', ready: 'ready', ship: 'ship', complete: 'complete', cancel: 'cancel', refund: 'refund' };

/** POST /api/admin/shop/orders/:id/(quote|paid|ready|ship|complete|cancel|refund) */
adminShopRoutes.post('/shop/orders/:id/:action', async (c) => {
  const s = await requireShop(c);
  const admin = c.get('admin')!;
  const action = ACTIONS[c.req.param('action')!];
  if (!action) throw notFound('Aksi tidak dikenal.');
  const o = await scopedOrder(c, c.req.param('id')!);
  const data = await body(c, orderActionBody);
  const updated = await transitionOrder(c.env, s, { orderId: o.id, action, actor: 'admin', audit: auditActor(admin), data });
  if (action === 'paid') await defer(c, notifyShop(c.env, o.branch_id, 'paid', o.id));
  if (action === 'cancel' || action === 'refund') await defer(c, notifyShop(c.env, o.branch_id, 'cancelled', o.id));
  return c.json({ order: await presentOrder(c.env.DB, updated.id, 'admin') });
});

/** GET /api/admin/bookings/:id/orders → produk yang diambil saat booking ini */
adminShopRoutes.get('/bookings/:id/orders', async (c) => {
  const admin = c.get('admin')!;
  if (admin.role === 'barber') throw forbidden();
  if (!(await shopActive(c.env))) return c.json({ enabled: false, orders: [] });
  const { results } = await c.env.DB.prepare('SELECT id, branch_id FROM orders WHERE booking_id = ? ORDER BY created_at').bind(c.req.param('id')).all<{ id: string; branch_id: number }>();
  const visible = results.filter((r) => admin.role === 'owner' || r.branch_id === admin.branch_id);
  return c.json({ enabled: true, orders: await Promise.all(visible.map((r) => presentOrder(c.env.DB, r.id, 'admin'))) });
});

/**
 * GET /api/admin/shop/summary?branch=&days=30 → omzet (pesanan lunas/selesai), produk terlaris, stok menipis,
 * pesanan perlu tindakan, belum diambil (admin cabang: cabangnya)
 */
adminShopRoutes.get('/shop/summary', async (c) => {
  const s = await requireShop(c);
  const admin = c.get('admin')!;
  const scope = branchScope(admin, c.req.query('branch') ? Number(c.req.query('branch')) : undefined) ?? null;
  const days = Math.min(365, Math.max(1, Number(c.req.query('days') ?? 30) || 30));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const nowIso = new Date().toISOString();
  const db = c.env.DB;
  const PAID = `o.status IN ('paid', 'ready', 'shipped', 'completed')`;
  const [revenue, top, low, todo, overdue] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(o.subtotal), 0) AS subtotal, COALESCE(SUM(o.total), 0) AS total FROM orders o WHERE ${PAID} AND COALESCE(o.paid_at, o.created_at) >= ?2 AND (?1 IS NULL OR o.branch_id = ?1)`).bind(scope, since),
    db
      .prepare(
        `SELECT oi.product_id, oi.product_name, SUM(oi.qty) AS qty, SUM(oi.line_total) AS revenue FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE ${PAID} AND COALESCE(o.paid_at, o.created_at) >= ?2 AND (?1 IS NULL OR o.branch_id = ?1)
         GROUP BY oi.product_id ORDER BY qty DESC, revenue DESC LIMIT 5`,
      )
      .bind(scope, since),
    db
      .prepare(
        `SELECT vs.branch_id, br.name AS branch_name, v.id AS variant_id, v.name AS variant_name, p.name AS product_name, vs.on_hand, vs.reserved, vs.on_hand - vs.reserved AS available
         FROM variant_stock vs JOIN product_variants v ON v.id = vs.variant_id JOIN products p ON p.id = v.product_id JOIN branches br ON br.id = vs.branch_id
         WHERE v.is_active = 1 AND p.is_active = 1 AND vs.on_hand - vs.reserved <= ?2 AND (?1 IS NULL OR vs.branch_id = ?1)
         ORDER BY available, p.sort_order LIMIT 20`,
      )
      .bind(scope, s.low_stock_threshold),
    db.prepare(`SELECT o.status, COUNT(*) AS n FROM orders o WHERE o.status IN ('awaiting_quote', 'awaiting_payment', 'paid', 'reserved_booking') AND (?1 IS NULL OR o.branch_id = ?1) GROUP BY o.status`).bind(scope),
    db.prepare(`SELECT COUNT(*) AS n FROM orders o WHERE o.status = 'ready' AND o.pickup_due_at <= ?2 AND (?1 IS NULL OR o.branch_id = ?1)`).bind(scope, nowIso),
  ]);
  return c.json({
    days,
    revenue: revenue.results[0],
    topProducts: top.results,
    lowStock: low.results,
    lowStockThreshold: s.low_stock_threshold,
    todo: Object.fromEntries((todo.results as { status: string; n: number }[]).map((r) => [r.status, r.n])),
    pickupOverdue: (overdue.results[0] as { n: number }).n,
  });
});

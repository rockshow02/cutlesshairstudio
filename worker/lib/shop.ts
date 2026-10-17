/**
 * Cutless Shop: katalog, harga & stok dihitung server, pesanan dengan reservasi atomik, transisi status per peran,
 * pembayaran manual (siap ditambah gateway), stempel Cutless Stamp dari belanja, cron.
 *
 * Anti-oversell: reservasi = upsert variant_stock.reserved + qty dalam SATU db.batch bersama pembuatan pesanan;
 * CHECK (reserved <= on_hand) menolak baris yang melebihi stok → seluruh batch batal (409, tidak ada pesanan
 * setengah jadi). Efek transisi (stok, pembayaran, stempel) memakai orders.transition_id (lihat shopStock.ts).
 * Program aktif bila env SHOP_ENABLED='true' DAN shop_settings.enabled = 1.
 */
import type { Env } from '../env';
import { localDate } from '../../shared/time';
import { auditStmt, type AuditActor } from './bookings';
import { ApiError, badRequest, notFound } from './errors';
import { evaluateStatements, loyaltyEnv } from './loyalty';
import { deductByToken, releaseByToken } from './shopStock';
import { getBranch } from './availability';

export const shopEnv = (env: Pick<Env, 'SHOP_ENABLED'>) => env.SHOP_ENABLED === 'true';

export const ORDER_STATUSES = ['awaiting_quote', 'awaiting_payment', 'reserved_booking', 'paid', 'ready', 'shipped', 'completed', 'cancelled', 'expired', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_quote: 'Menunggu ongkir',
  awaiting_payment: 'Menunggu pembayaran',
  reserved_booking: 'Diambil saat booking',
  paid: 'Dibayar',
  ready: 'Siap diambil',
  shipped: 'Dikirim',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  expired: 'Kedaluwarsa',
  refunded: 'Dikembalikan',
};
export type Fulfillment = 'pickup' | 'with_booking' | 'ship_manual' | 'ship_auto';
export const FULFILLMENT_LABEL: Record<Fulfillment, string> = {
  pickup: 'Ambil di cabang',
  with_booking: 'Ambil saat booking',
  ship_manual: 'Dikirim',
  ship_auto: 'Dikirim',
};

/* ---------- Pengaturan ---------- */

export interface ShopSettings {
  enabled: boolean;
  payment_window_min: number;
  pickup_window_days: number;
  auto_complete_days: number;
  stamp_min_subtotal: number;
  low_stock_threshold: number;
  return_policy: string;
  shipping_provider: 'manual' | 'rajaongkir';
  shipping_daily_limit: number;
  updated_at: string;
  updated_by: string | null;
}

export async function getShopSettings(db: D1Database): Promise<ShopSettings | null> {
  const r = await db.prepare('SELECT * FROM shop_settings WHERE id = 1').first<Omit<ShopSettings, 'enabled'> & { enabled: number }>();
  return r ? { ...r, enabled: Boolean(r.enabled) } : null;
}

export async function shopActive(env: Pick<Env, 'SHOP_ENABLED' | 'DB'>): Promise<ShopSettings | null> {
  if (!shopEnv(env)) return null;
  const s = await getShopSettings(env.DB);
  return s?.enabled ? s : null;
}

export interface BranchShop {
  branch_id: number;
  name: string;
  slug: string;
  city: string;
  whatsapp: string;
  timezone: string;
  status: string;
  telegram_chat_id: string | null;
  pickup_enabled: boolean;
  with_booking_enabled: boolean;
  ship_manual_enabled: boolean;
  ship_auto_enabled: boolean;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  qris_image: string | null;
  payment_note: string | null;
  unique_code_enabled: boolean;
  origin_region_id: string | null;
  origin_label: string | null;
}

/** Pengaturan toko cabang (baris belum ada → default: ambil di cabang & saat booking aktif) */
const BRANCH_SHOP_SQL = `SELECT b.id AS branch_id, b.name, b.slug, b.city, b.whatsapp, b.timezone, b.status, b.telegram_chat_id,
    COALESCE(s.pickup_enabled, 1) AS pickup_enabled, COALESCE(s.with_booking_enabled, 1) AS with_booking_enabled,
    COALESCE(s.ship_manual_enabled, 0) AS ship_manual_enabled, COALESCE(s.ship_auto_enabled, 0) AS ship_auto_enabled,
    s.bank_name, s.bank_account_no, s.bank_account_name, s.qris_image, s.payment_note,
    COALESCE(s.unique_code_enabled, 0) AS unique_code_enabled, s.origin_region_id, s.origin_label
  FROM branches b LEFT JOIN shop_branch_settings s ON s.branch_id = b.id`;

type BranchShopRow = Omit<BranchShop, 'pickup_enabled' | 'with_booking_enabled' | 'ship_manual_enabled' | 'ship_auto_enabled' | 'unique_code_enabled'> & Record<
  'pickup_enabled' | 'with_booking_enabled' | 'ship_manual_enabled' | 'ship_auto_enabled' | 'unique_code_enabled',
  number
>;
const toBranchShop = (r: BranchShopRow): BranchShop => ({
  ...r,
  pickup_enabled: Boolean(r.pickup_enabled),
  with_booking_enabled: Boolean(r.with_booking_enabled),
  ship_manual_enabled: Boolean(r.ship_manual_enabled),
  ship_auto_enabled: Boolean(r.ship_auto_enabled),
  unique_code_enabled: Boolean(r.unique_code_enabled),
});

export async function branchShop(db: D1Database, branchId: number): Promise<BranchShop> {
  const r = await db.prepare(`${BRANCH_SHOP_SQL} WHERE b.id = ?`).bind(branchId).first<BranchShopRow>();
  if (!r) throw notFound('Cabang tidak ditemukan.');
  return toBranchShop(r);
}

export async function listBranchShops(db: D1Database): Promise<BranchShop[]> {
  const { results } = await db.prepare(`${BRANCH_SHOP_SQL} WHERE b.status <> 'closed' ORDER BY b.sort_order, b.id`).all<BranchShopRow>();
  return results.map(toBranchShop);
}

/** Cara terima yang tersedia di cabang (ship_auto hanya bila penyedia ongkir otomatis aktif & asal diisi) */
export function fulfillmentOptions(b: BranchShop, autoAvailable: boolean): Fulfillment[] {
  const out: Fulfillment[] = [];
  if (b.pickup_enabled) out.push('pickup');
  if (b.with_booking_enabled) out.push('with_booking');
  if (b.ship_auto_enabled && autoAvailable && b.origin_region_id) out.push('ship_auto');
  else if (b.ship_manual_enabled || b.ship_auto_enabled) out.push('ship_manual');
  return out;
}

/* ---------- Katalog ---------- */

export interface ProductView {
  id: number;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  notes: string | null;
  badge: string | null;
  isActive: boolean;
  sortOrder: number;
  releaseAt: string | null;
  perCustomerLimit: number | null;
  images: { id: number; path: string; alt: string | null }[];
  variants: {
    id: number;
    sku: string | null;
    name: string;
    options: Record<string, string>;
    price: number;
    compareAtPrice: number | null;
    weightGram: number;
    isActive: boolean;
    /** Tersedia per cabang (on_hand - reserved) */
    stock: Record<number, number>;
  }[];
  priceFrom: number | null;
}

type ProductRow = { id: number; slug: string; name: string; category: string; description: string | null; notes: string | null; badge: string | null; is_active: number; sort_order: number; release_at: string | null; per_customer_limit: number | null };

/** Lengkapi produk dengan foto, varian, dan stok tersedia per cabang (3 kueri untuk semua produk) */
export async function hydrateProducts(db: D1Database, rows: ProductRow[], opts: { includeInactiveVariants?: boolean } = {}): Promise<ProductView[]> {
  if (!rows.length) return [];
  const ids = JSON.stringify(rows.map((r) => r.id));
  const [images, variants, stock] = await db.batch([
    db.prepare(`SELECT id, product_id, path, alt FROM product_images WHERE product_id IN (SELECT value FROM json_each(?)) ORDER BY sort_order, id`).bind(ids),
    db
      .prepare(
        `SELECT id, product_id, sku, name, options, price, compare_at_price, weight_gram, is_active FROM product_variants
         WHERE product_id IN (SELECT value FROM json_each(?1)) ${opts.includeInactiveVariants ? '' : 'AND is_active = 1'} ORDER BY sort_order, id`,
      )
      .bind(ids),
    db
      .prepare(
        `SELECT vs.branch_id, vs.variant_id, vs.on_hand - vs.reserved AS available FROM variant_stock vs
         JOIN product_variants v ON v.id = vs.variant_id WHERE v.product_id IN (SELECT value FROM json_each(?))`,
      )
      .bind(ids),
  ]);
  const stockBy = new Map<number, Record<number, number>>();
  for (const s of stock.results as { branch_id: number; variant_id: number; available: number }[]) {
    stockBy.set(s.variant_id, { ...(stockBy.get(s.variant_id) ?? {}), [s.branch_id]: s.available });
  }
  return rows.map((p) => {
    const vs = (variants.results as { id: number; product_id: number; sku: string | null; name: string; options: string; price: number; compare_at_price: number | null; weight_gram: number; is_active: number }[])
      .filter((v) => v.product_id === p.id)
      .map((v) => ({
        id: v.id,
        sku: v.sku,
        name: v.name,
        options: safeJson(v.options),
        price: v.price,
        compareAtPrice: v.compare_at_price,
        weightGram: v.weight_gram,
        isActive: Boolean(v.is_active),
        stock: stockBy.get(v.id) ?? {},
      }));
    const active = vs.filter((v) => v.isActive);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
      description: p.description,
      notes: p.notes,
      badge: p.badge,
      isActive: Boolean(p.is_active),
      sortOrder: p.sort_order,
      releaseAt: p.release_at,
      perCustomerLimit: p.per_customer_limit,
      images: (images.results as { id: number; product_id: number; path: string; alt: string | null }[]).filter((i) => i.product_id === p.id).map(({ id, path, alt }) => ({ id, path, alt })),
      variants: vs,
      priceFrom: active.length ? Math.min(...active.map((v) => v.price)) : null,
    };
  });
}

const safeJson = (s: string): Record<string, string> => {
  try {
    const v = JSON.parse(s) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
};

/* ---------- Keranjang (dihitung server) ---------- */

export interface CartItemInput {
  variantId: number;
  qty: number;
}

export interface PricedLine {
  variantId: number;
  productId: number;
  productName: string;
  variantName: string;
  sku: string | null;
  unitPrice: number;
  qty: number;
  lineTotal: number;
  weightGram: number;
  available: number;
  image: string | null;
  error?: string;
}

/**
 * Harga, stok, rilis drop, dan batas beli per pelanggan dari database (bukan dari klien).
 * Batas beli: total qty produk itu di SEMUA pesanan non-batal pelanggan + qty baru ≤ per_customer_limit.
 */
export async function priceCart(db: D1Database, input: { branchId: number; items: CartItemInput[]; customerId: string | null; now: number }) {
  const merged = new Map<number, number>();
  for (const it of input.items) merged.set(it.variantId, (merged.get(it.variantId) ?? 0) + it.qty);
  const ids = [...merged.keys()];
  if (!ids.length) throw badRequest('Keranjang kosong.');
  const { results } = await db
    .prepare(
      `SELECT v.id AS variant_id, v.product_id, v.name AS variant_name, v.sku, v.price, v.weight_gram, v.is_active AS v_active,
              p.name AS product_name, p.is_active AS p_active, p.release_at, p.per_customer_limit,
              COALESCE(vs.on_hand - vs.reserved, 0) AS available,
              (SELECT path FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order, i.id LIMIT 1) AS image
       FROM product_variants v JOIN products p ON p.id = v.product_id
       LEFT JOIN variant_stock vs ON vs.variant_id = v.id AND vs.branch_id = ?2
       WHERE v.id IN (SELECT value FROM json_each(?1))`,
    )
    .bind(JSON.stringify(ids), input.branchId)
    .all<{
      variant_id: number;
      product_id: number;
      variant_name: string;
      sku: string | null;
      price: number;
      weight_gram: number;
      v_active: number;
      product_name: string;
      p_active: number;
      release_at: string | null;
      per_customer_limit: number | null;
      available: number;
      image: string | null;
    }>();
  const bought = new Map<number, number>();
  if (input.customerId) {
    const limited = [...new Set(results.filter((r) => r.per_customer_limit).map((r) => r.product_id))];
    if (limited.length) {
      const { results: rows } = await db
        .prepare(
          `SELECT oi.product_id, SUM(oi.qty) AS qty FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE o.customer_id = ?1 AND o.status NOT IN ('cancelled', 'expired') AND oi.product_id IN (SELECT value FROM json_each(?2))
           GROUP BY oi.product_id`,
        )
        .bind(input.customerId, JSON.stringify(limited))
        .all<{ product_id: number; qty: number }>();
      for (const r of rows) bought.set(r.product_id, r.qty);
    }
  }
  const qtyPerProduct = new Map<number, number>();
  for (const r of results) qtyPerProduct.set(r.product_id, (qtyPerProduct.get(r.product_id) ?? 0) + (merged.get(r.variant_id) ?? 0));

  const lines: PricedLine[] = ids.map((variantId) => {
    const r = results.find((x) => x.variant_id === variantId);
    const qty = merged.get(variantId)!;
    if (!r) return { variantId, productId: 0, productName: 'Produk tidak ditemukan', variantName: '', sku: null, unitPrice: 0, qty, lineTotal: 0, weightGram: 0, available: 0, image: null, error: 'Produk tidak ditemukan.' };
    const base: PricedLine = {
      variantId,
      productId: r.product_id,
      productName: r.product_name,
      variantName: r.variant_name,
      sku: r.sku,
      unitPrice: r.price,
      qty,
      lineTotal: r.price * qty,
      weightGram: r.weight_gram * qty,
      available: Math.max(0, r.available),
      image: r.image,
    };
    let error: string | undefined;
    if (!r.p_active || !r.v_active) error = 'Produk tidak tersedia.';
    else if (r.release_at && Date.parse(r.release_at) > input.now) error = 'Produk belum dirilis.';
    else if (r.available < qty) error = r.available > 0 ? `Stok di cabang ini tinggal ${r.available}.` : 'Stok habis di cabang ini.';
    else if (r.per_customer_limit && (bought.get(r.product_id) ?? 0) + qtyPerProduct.get(r.product_id)! > r.per_customer_limit) {
      const left = Math.max(0, r.per_customer_limit - (bought.get(r.product_id) ?? 0));
      error = left ? `Maksimal ${r.per_customer_limit} per pelanggan (sisa jatah ${left}).` : `Batas ${r.per_customer_limit} per pelanggan sudah tercapai.`;
    }
    return error ? { ...base, error } : base;
  });
  const valid = lines.filter((l) => !l.error);
  return {
    lines,
    subtotal: valid.reduce((s, l) => s + l.lineTotal, 0),
    weightGram: valid.reduce((s, l) => s + l.weightGram, 0),
    ok: lines.every((l) => !l.error),
  };
}

/* ---------- Pesanan ---------- */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const orderCode = () => `SH-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')}`;
const uniqueCode = () => 1 + (crypto.getRandomValues(new Uint16Array(1))[0] % 999);
const iso = (ms: number) => new Date(ms).toISOString();

export interface CreateOrderInput {
  customerId: string;
  branchId: number;
  fulfillment: Fulfillment;
  items: CartItemInput[];
  paymentMethod: 'transfer' | 'qris' | 'cashier';
  bookingId?: string | null;
  shipping?: { recipientName: string; recipientPhone: string; address: string; regionId?: string | null; regionLabel?: string | null; postalCode?: string | null } | null;
  /** Ongkir otomatis terpilih (sudah divalidasi ulang ke penyedia oleh pemanggil) */
  rate?: { courier: string; service: string; cost: number } | null;
  note?: string | null;
  actor: AuditActor;
  now?: number;
}

export async function createOrder(db: D1Database, settings: ShopSettings, input: CreateOrderInput) {
  const now = input.now ?? Date.now();
  const branch = await branchShop(db, input.branchId);
  if (branch.status !== 'active') throw new ApiError(409, 'SLOT_UNAVAILABLE', 'Cabang ini belum menerima pesanan.');
  const priced = await priceCart(db, { branchId: branch.branch_id, items: input.items, customerId: input.customerId, now });
  if (!priced.ok) throw new ApiError(409, 'STOCK_UNAVAILABLE', 'Sebagian produk tidak bisa dipesan. Periksa keranjang.', { lines: priced.lines });

  const ship = input.fulfillment === 'ship_manual' || input.fulfillment === 'ship_auto';
  if (ship && (!input.shipping?.recipientName || !input.shipping.recipientPhone || !input.shipping.address)) throw badRequest('Lengkapi nama, nomor, dan alamat penerima.');
  if (input.fulfillment === 'ship_auto' && !input.rate) throw badRequest('Pilih layanan kurir.');
  if (input.fulfillment === 'with_booking' && !input.bookingId) throw badRequest('Pilih booking untuk mengambil produk.');
  const method = input.fulfillment === 'with_booking' ? 'cashier' : input.paymentMethod === 'cashier' ? 'transfer' : input.paymentMethod;
  if (method === 'qris' && !branch.qris_image) throw badRequest('Cabang ini belum menyediakan QRIS.');

  const status: OrderStatus = input.fulfillment === 'with_booking' ? 'reserved_booking' : input.fulfillment === 'ship_manual' ? 'awaiting_quote' : 'awaiting_payment';
  const shippingFee = input.fulfillment === 'ship_auto' ? input.rate!.cost : input.fulfillment === 'pickup' || input.fulfillment === 'with_booking' ? 0 : null;
  const code = status === 'awaiting_payment' && branch.unique_code_enabled ? uniqueCode() : 0;
  const total = priced.subtotal + (shippingFee ?? 0) + code;
  const due = status === 'awaiting_payment' ? iso(now + settings.payment_window_min * 60_000) : null;
  const id = crypto.randomUUID();

  for (let attempt = 0; attempt < 3; attempt++) {
    const orderNo = orderCode();
    const s = input.shipping;
    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO orders (id, code, customer_id, branch_id, fulfillment, booking_id, status, subtotal, shipping_fee, unique_code, total, payment_method,
             payment_due_at, recipient_name, recipient_phone, address, region_id, region_label, postal_code, weight_gram, courier, courier_service, customer_note, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?24)`,
        )
        .bind(
          id,
          orderNo,
          input.customerId,
          branch.branch_id,
          input.fulfillment,
          input.bookingId ?? null,
          status,
          priced.subtotal,
          shippingFee,
          code,
          total,
          method,
          due,
          ship ? s!.recipientName : null,
          ship ? s!.recipientPhone : null,
          ship ? s!.address : null,
          ship ? (s!.regionId ?? null) : null,
          ship ? (s!.regionLabel ?? null) : null,
          ship ? (s!.postalCode ?? null) : null,
          priced.weightGram,
          input.rate?.courier ?? null,
          input.rate?.service ?? null,
          input.note ?? null,
          iso(now),
        ),
      ...priced.lines.map((l) =>
        db
          .prepare(
            `INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_name, sku, unit_price, qty, line_total, weight_gram)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(id, l.productId, l.variantId, l.productName, l.variantName, l.sku, l.unitPrice, l.qty, l.lineTotal, l.weightGram),
      ),
      // Reservasi: baris stok belum ada → dibuat dengan on_hand 0; reserved + qty melebihi on_hand → CHECK gagal → batch batal
      // (dua pernyataan: SQLite memeriksa CHECK baris kandidat INSERT sebelum upsert)
      ...priced.lines.flatMap((l) => [
        db.prepare(`INSERT OR IGNORE INTO variant_stock (branch_id, variant_id, on_hand, reserved, updated_at) VALUES (?1, ?2, 0, 0, ?3)`).bind(branch.branch_id, l.variantId, iso(now)),
        db.prepare(`UPDATE variant_stock SET reserved = reserved + ?3, updated_at = ?4 WHERE branch_id = ?1 AND variant_id = ?2`).bind(branch.branch_id, l.variantId, l.qty, iso(now)),
      ]),
      auditStmt(db, input.actor, 'order.create', 'order', id, { code: orderNo, total, fulfillment: input.fulfillment }),
    ];
    try {
      await db.batch(statements);
      return { id, code: orderNo, status };
    } catch (e) {
      const msg = String((e as Error).message);
      if (/orders\.code/.test(msg)) continue;
      if (/CHECK constraint failed/i.test(msg) && /reserved/i.test(msg)) {
        throw new ApiError(409, 'STOCK_UNAVAILABLE', 'Stok baru saja habis dipesan orang lain. Periksa keranjang.');
      }
      throw e;
    }
  }
  throw new ApiError(500, 'INTERNAL', 'Gagal membuat kode pesanan. Coba lagi.');
}

/* ---------- Transisi ---------- */

export type OrderAction = 'quote' | 'paid' | 'ready' | 'ship' | 'complete' | 'cancel' | 'expire' | 'refund';
type ActorKind = 'customer' | 'admin' | 'system';

interface Rule {
  from: OrderStatus[];
  to: OrderStatus;
  actors: ActorKind[];
}
const RULES: Record<OrderAction, Rule> = {
  quote: { from: ['awaiting_quote'], to: 'awaiting_payment', actors: ['admin'] },
  paid: { from: ['awaiting_payment'], to: 'paid', actors: ['admin'] },
  ready: { from: ['paid'], to: 'ready', actors: ['admin'] },
  ship: { from: ['paid'], to: 'shipped', actors: ['admin'] },
  complete: { from: ['ready', 'shipped', 'reserved_booking'], to: 'completed', actors: ['admin', 'customer', 'system'] },
  cancel: { from: ['awaiting_quote', 'awaiting_payment', 'reserved_booking'], to: 'cancelled', actors: ['admin', 'customer', 'system'] },
  expire: { from: ['awaiting_payment'], to: 'expired', actors: ['system'] },
  refund: { from: ['paid', 'ready', 'shipped'], to: 'refunded', actors: ['admin'] },
};

export interface OrderRow {
  id: string;
  code: string;
  customer_id: string;
  branch_id: number;
  fulfillment: Fulfillment;
  booking_id: string | null;
  status: OrderStatus;
  subtotal: number;
  shipping_fee: number | null;
  unique_code: number;
  total: number;
  payment_method: 'transfer' | 'qris' | 'cashier' | 'gateway';
  payment_due_at: string | null;
  paid_at: string | null;
  ready_at: string | null;
  pickup_due_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  tracking_no: string | null;
  courier: string | null;
  courier_service: string | null;
  created_at: string;
}

export async function getOrder(db: D1Database, id: string): Promise<OrderRow> {
  const o = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRow>();
  if (!o) throw notFound('Pesanan tidak ditemukan.');
  return o;
}

/** Aksi yang boleh dilakukan aktor pada pesanan ini (untuk tombol UI & validasi) */
export function allowedActions(o: Pick<OrderRow, 'status' | 'fulfillment'>, actor: ActorKind): OrderAction[] {
  return (Object.keys(RULES) as OrderAction[]).filter((a) => {
    const r = RULES[a];
    if (!r.actors.includes(actor) || !r.from.includes(o.status)) return false;
    if (a === 'ready' && o.fulfillment !== 'pickup') return false;
    if (a === 'ship' && !o.fulfillment.startsWith('ship')) return false;
    // Pelanggan & sistem hanya menyelesaikan pesanan kirim (pesanan diterima / otomatis)
    if (a === 'complete' && actor !== 'admin' && o.status !== 'shipped') return false;
    return true;
  });
}

export interface TransitionData {
  shippingFee?: number;
  courier?: string | null;
  service?: string | null;
  trackingNo?: string;
  amount?: number;
  method?: 'transfer' | 'qris' | 'cashier';
  confirmMismatch?: boolean;
  reason?: string | null;
  note?: string | null;
}

/**
 * Ubah status pesanan + efeknya dalam satu batch. Stok: batal/kedaluwarsa/refund-sebelum-keluar → lepas reservasi;
 * dikirim, diambil (ready→selesai) & kasir (booking→selesai) → stok fisik berkurang. Selesai → stempel Cutless Stamp
 * bila program aktif & subtotal ≥ minimum (maks. 1/hari gabungan booking, tanggal lokal cabang).
 */
export async function transitionOrder(
  env: Pick<Env, 'DB' | 'LOYALTY_ENABLED'>,
  settings: ShopSettings,
  input: { orderId: string; action: OrderAction; actor: ActorKind; audit: AuditActor; data?: TransitionData; now?: number; customerId?: string },
) {
  const db = env.DB;
  const now = input.now ?? Date.now();
  const nowIso = iso(now);
  const o = await getOrder(db, input.orderId);
  if (input.customerId && o.customer_id !== input.customerId) throw notFound('Pesanan tidak ditemukan.');
  if (!allowedActions(o, input.actor).includes(input.action)) {
    throw new ApiError(409, 'INVALID_TRANSITION', `Pesanan berstatus "${ORDER_STATUS_LABEL[o.status]}" tidak bisa diproses dengan aksi ini.`);
  }
  const rule = RULES[input.action];
  const d = input.data ?? {};
  const token = crypto.randomUUID();
  const sets: string[] = [`status = '${rule.to}'`, 'transition_id = ?3', 'updated_at = ?4'];
  const binds: unknown[] = [o.id, o.status, token, nowIso];
  const add = (sql: string, v: unknown) => {
    binds.push(v);
    sets.push(sql.replace('?', `?${binds.length}`));
  };
  const branch = await branchShop(db, o.branch_id);

  switch (input.action) {
    case 'quote': {
      if (!Number.isInteger(d.shippingFee) || d.shippingFee! < 0) throw badRequest('Isi ongkir (rupiah, bilangan bulat).');
      const code = branch.unique_code_enabled ? uniqueCode() : 0;
      add('shipping_fee = ?', d.shippingFee);
      add('courier = ?', d.courier ?? null);
      add('courier_service = ?', d.service ?? null);
      add('unique_code = ?', code);
      add('total = ?', o.subtotal + d.shippingFee! + code);
      add('payment_due_at = ?', iso(now + settings.payment_window_min * 60_000));
      break;
    }
    case 'paid': {
      const amount = d.amount ?? o.total;
      if (!Number.isInteger(amount) || amount < 0) throw badRequest('Nominal tidak valid.');
      if (amount !== o.total && !d.confirmMismatch) {
        throw new ApiError(409, 'AMOUNT_MISMATCH', `Nominal ${amount.toLocaleString('id-ID')} berbeda dari total ${o.total.toLocaleString('id-ID')}. Konfirmasi untuk tetap menandai Lunas.`, {
          total: o.total,
          amount,
        });
      }
      add('paid_at = ?', nowIso);
      break;
    }
    case 'ready':
      add('ready_at = ?', nowIso);
      add('pickup_due_at = ?', iso(now + settings.pickup_window_days * 86_400_000));
      break;
    case 'ship':
      if (!d.trackingNo?.trim()) throw badRequest('Isi nomor resi.');
      add('tracking_no = ?', d.trackingNo.trim());
      if (d.courier) add('courier = ?', d.courier);
      add('shipped_at = ?', nowIso);
      break;
    case 'complete':
      add('completed_at = ?', nowIso);
      add('completed_by = ?', input.actor);
      if (o.status === 'reserved_booking') add('paid_at = ?', nowIso);
      break;
    case 'cancel':
    case 'expire':
      if (input.actor === 'admin' && !d.reason?.trim()) throw badRequest('Alasan pembatalan wajib diisi.');
      add('cancelled_at = ?', nowIso);
      add('cancelled_by = ?', input.actor);
      add('cancel_reason = ?', d.reason ?? (input.action === 'expire' ? 'Tidak dibayar sampai batas waktu' : null));
      break;
    case 'refund':
      if (!d.reason?.trim()) throw badRequest('Alasan refund wajib diisi.');
      add('cancelled_at = ?', nowIso);
      add('cancelled_by = ?', 'admin');
      add('cancel_reason = ?', d.reason);
      break;
  }

  const statements: D1PreparedStatement[] = [db.prepare(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?1 AND status = ?2`).bind(...binds)];
  // Stok
  if (input.action === 'cancel' || input.action === 'expire' || (input.action === 'refund' && o.status !== 'shipped')) statements.push(releaseByToken(db, token, nowIso));
  if (input.action === 'ship' || (input.action === 'complete' && (o.status === 'ready' || o.status === 'reserved_booking'))) statements.push(deductByToken(db, token, nowIso));
  // Pembayaran
  const paymentStmt = (method: string, amount: number, note: string | null) =>
    db
      .prepare(
        `INSERT INTO payments (id, order_id, method, provider, amount, status, note, confirmed_by, confirmed_at)
         SELECT ?1, id, ?2, 'manual', ?3, 'confirmed', ?4, ?5, ?6 FROM orders WHERE id = ?7 AND transition_id = ?8`,
      )
      .bind(crypto.randomUUID(), method, amount, note, input.audit.id, nowIso, o.id, token);
  if (input.action === 'paid') statements.push(paymentStmt(d.method ?? (o.payment_method === 'qris' ? 'qris' : 'transfer'), d.amount ?? o.total, d.note ?? null));
  if (input.action === 'complete' && o.status === 'reserved_booking') statements.push(paymentStmt('cashier', o.total, d.note ?? null));
  if (input.action === 'refund') {
    statements.push(db.prepare(`UPDATE payments SET status = 'refunded' WHERE order_id = ?1 AND status = 'confirmed' AND EXISTS (SELECT 1 FROM orders WHERE id = ?1 AND transition_id = ?2)`).bind(o.id, token));
  }
  // Stempel dari belanja
  if (rule.to === 'completed' && loyaltyEnv(env) && o.subtotal >= settings.stamp_min_subtotal) {
    statements.push(...orderStampStatements(db, o, branch.timezone, token, input.audit, now));
  }
  statements.push(
    db
      .prepare(
        `INSERT INTO audit_log (actor_type, actor_id, action, entity, entity_id, payload)
         SELECT ?1, ?2, ?3, 'order', id, ?4 FROM orders WHERE id = ?5 AND transition_id = ?6`,
      )
      .bind(input.audit.type, input.audit.id, `order.${input.action}`, JSON.stringify({ from: o.status, to: rule.to, ...d }), o.id, token),
  );

  const res = await db.batch(statements);
  if (!res[0].meta.changes) throw new ApiError(409, 'INVALID_TRANSITION', 'Pesanan baru saja diubah orang lain. Muat ulang halaman.');
  return getOrder(db, o.id);
}

/** Stempel Cutless Stamp dari pesanan selesai (bersyarat token transisi & program loyalty aktif) */
function orderStampStatements(db: D1Database, o: OrderRow, timezone: string, token: string, actor: AuditActor, now: number): D1PreparedStatement[] {
  const nowIso = iso(now);
  const stampId = crypto.randomUUID();
  return [
    db.prepare(`INSERT OR IGNORE INTO loyalty_cards (customer_id) SELECT ?1 WHERE EXISTS (SELECT 1 FROM loyalty_settings WHERE id = 1 AND enabled = 1)`).bind(o.customer_id),
    db
      .prepare(
        `INSERT OR IGNORE INTO loyalty_stamps (id, customer_id, order_id, branch_id, stamp_date, cycle, kind, status, created_by, created_at, expires_at)
         SELECT ?1, ?2, ?3, ?4, ?5, card.cycle, 'order', 'active', ?6, ?7, strftime('%Y-%m-%dT%H:%M:%fZ', ?7, '+' || s.stamp_valid_months || ' months')
         FROM loyalty_settings s JOIN loyalty_cards card ON card.customer_id = ?2
         WHERE s.id = 1 AND s.enabled = 1 AND EXISTS (SELECT 1 FROM orders WHERE id = ?3 AND transition_id = ?8 AND status = 'completed')`,
      )
      .bind(stampId, o.customer_id, o.id, o.branch_id, localDate(now, timezone), actor.id, nowIso, token),
    db
      .prepare(
        `INSERT INTO audit_log (actor_type, actor_id, action, entity, entity_id, payload)
         SELECT ?2, ?3, 'loyalty.stamp', 'order', order_id, json_object('customer', customer_id, 'stamp', id, 'date', stamp_date)
         FROM loyalty_stamps WHERE id = ?1`,
      )
      .bind(stampId, actor.type, actor.id),
    ...evaluateStatements(db, o.customer_id, nowIso),
  ];
}

/* ---------- Tampilan pesanan ---------- */

export async function orderItems(db: D1Database, orderIds: string[]) {
  if (!orderIds.length) return new Map<string, Record<string, unknown>[]>();
  const { results } = await db
    .prepare(
      `SELECT oi.*, (SELECT path FROM product_images i WHERE i.product_id = oi.product_id ORDER BY i.sort_order, i.id LIMIT 1) AS image
       FROM order_items oi WHERE oi.order_id IN (SELECT value FROM json_each(?)) ORDER BY oi.id`,
    )
    .bind(JSON.stringify(orderIds))
    .all<Record<string, unknown> & { order_id: string }>();
  const map = new Map<string, Record<string, unknown>[]>();
  for (const r of results) map.set(r.order_id, [...(map.get(r.order_id) ?? []), r]);
  return map;
}

/** Instruksi bayar (hanya untuk status menunggu pembayaran) */
export function paymentInfo(o: Pick<OrderRow, 'status' | 'payment_method' | 'total' | 'payment_due_at' | 'unique_code'>, b: BranchShop) {
  if (o.status !== 'awaiting_payment') return null;
  return {
    method: o.payment_method,
    amount: o.total,
    uniqueCode: o.unique_code,
    dueAt: o.payment_due_at,
    bank: b.bank_name && b.bank_account_no ? { name: b.bank_name, accountNo: b.bank_account_no, accountName: b.bank_account_name } : null,
    qrisImage: b.qris_image,
    note: b.payment_note,
    whatsapp: b.whatsapp,
  };
}

/* ---------- Cron ---------- */

export async function runShopCron(env: Env, now = Date.now()): Promise<{ expired: number; completed: number; overdue: number }> {
  const out = { expired: 0, completed: 0, overdue: 0 };
  const settings = await shopActive(env);
  if (!settings) return out;
  const db = env.DB;
  const SYSTEM: AuditActor = { type: 'system', id: 'cron' };
  const nowIso = iso(now);
  // 1) Belum dibayar sampai batas waktu → kedaluwarsa, reservasi dilepas
  const due = (await db.prepare(`SELECT id FROM orders WHERE status = 'awaiting_payment' AND payment_due_at <= ? LIMIT 100`).bind(nowIso).all<{ id: string }>()).results;
  for (const r of due) {
    try {
      await transitionOrder(env, settings, { orderId: r.id, action: 'expire', actor: 'system', audit: SYSTEM, now });
      out.expired++;
    } catch (e) {
      console.error('shop expire', r.id, e);
    }
  }
  // 2) Dikirim lebih dari N hari → selesai otomatis
  const shippedBefore = iso(now - settings.auto_complete_days * 86_400_000);
  const shipped = (await db.prepare(`SELECT id FROM orders WHERE status = 'shipped' AND shipped_at <= ? LIMIT 100`).bind(shippedBefore).all<{ id: string }>()).results;
  for (const r of shipped) {
    try {
      await transitionOrder(env, settings, { orderId: r.id, action: 'complete', actor: 'system', audit: SYSTEM, now });
      out.completed++;
    } catch (e) {
      console.error('shop auto-complete', r.id, e);
    }
  }
  // 3) Lewat batas ambil → tandai & beri tahu cabang sekali (tanpa batal otomatis: sudah dibayar)
  const overdue = (
    await db
      .prepare(`UPDATE orders SET pickup_overdue_notified_at = ?1 WHERE status = 'ready' AND pickup_due_at <= ?1 AND pickup_overdue_notified_at IS NULL RETURNING id, branch_id`)
      .bind(nowIso)
      .all<{ id: string; branch_id: number }>()
  ).results;
  for (const r of overdue) {
    out.overdue++;
    await notifyShop(env, r.branch_id, 'pickup_overdue', r.id);
  }
  return out;
}

/* ---------- Notifikasi Telegram ---------- */

export type ShopEvent = 'new' | 'awaiting_quote' | 'paid' | 'pickup_overdue' | 'cancelled';
const SHOP_TITLE: Record<ShopEvent, string> = {
  new: '🛍️ Pesanan produk baru',
  awaiting_quote: '📦 Pesanan kirim, PERLU DIISI ONGKIR',
  paid: '✅ Pesanan produk lunas',
  pickup_overdue: '⏰ Pesanan belum diambil (lewat batas ambil)',
  cancelled: '❌ Pesanan produk dibatalkan',
};

export async function notifyShop(env: Pick<Env, 'DB' | 'TELEGRAM_BOT_TOKEN'>, branchId: number, event: ShopEvent, orderId: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  try {
    const branch = await getBranch(env.DB, branchId);
    if (!branch.telegram_chat_id) return;
    const o = await env.DB.prepare(`SELECT o.code, o.total, o.status, o.fulfillment, c.name AS customer FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`)
      .bind(orderId)
      .first<{ code: string; total: number; status: OrderStatus; fulfillment: Fulfillment; customer: string }>();
    if (!o) return;
    const items = (await env.DB.prepare(`SELECT product_name, variant_name, qty FROM order_items WHERE order_id = ?`).bind(orderId).all<{ product_name: string; variant_name: string; qty: number }>()).results;
    const text = [
      `${SHOP_TITLE[event]} · ${branch.name}`,
      `Kode: ${o.code}`,
      `Pelanggan: ${o.customer}`,
      `Cara terima: ${FULFILLMENT_LABEL[o.fulfillment]}`,
      ...items.map((i) => `• ${i.qty}× ${i.product_name} (${i.variant_name})`),
      `Total: Rp ${o.total.toLocaleString('id-ID')}`,
      `Status: ${ORDER_STATUS_LABEL[o.status]}`,
    ].join('\n');
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: branch.telegram_chat_id, text, disable_web_page_preview: true }),
    });
  } catch (e) {
    console.error('telegram shop', e);
  }
}

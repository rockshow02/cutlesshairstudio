/**
 * Skema request API (Zod) dipakai bersama: frontend memvalidasi form sebelum kirim, Worker memvalidasi ulang.
 */
import { z } from 'zod';
import { normalizePhone } from './booking';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD');
const isoString = z.string().refine((v) => Number.isFinite(Date.parse(v)), 'Waktu tidak valid');
const id = z.coerce.number().int().positive();

/** "any" / kosong = Siapa saja */
export const barberParam = z
  .union([z.literal('any'), z.literal(''), id])
  .optional()
  .transform((v) => (v === 'any' || v === '' || v === undefined ? undefined : v));

export const availabilityQuery = z.object({
  branch: z.string().min(1, 'cabang wajib'),
  service: z.string().min(1, 'layanan wajib'),
  barber: barberParam,
  date: dateString,
});

export const phoneField = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: 'custom', message: 'Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890' });
      return z.NEVER;
    }
    return p;
  });

export const nameField = z.string().trim().min(2, 'Nama minimal 2 huruf').max(60, 'Nama maksimal 60 karakter');

export const completeProfileBody = z.object({
  name: nameField,
  phone: phoneField,
  privacyConsent: z.literal(true, { error: 'Centang persetujuan kebijakan privasi untuk melanjutkan' }),
});

export const updateProfileBody = z.object({ name: nameField, phone: phoneField });

export const createBookingBody = z.object({
  branch: z.union([z.string().min(1), id]),
  service: z.union([z.string().min(1), id]),
  barber: barberParam,
  startAt: isoString,
  note: z.string().trim().max(300, 'Catatan maksimal 300 karakter').optional().nullable(),
  turnstileToken: z.string().optional().default(''),
});

export const rescheduleBody = z.object({ startAt: isoString, barber: barberParam });

export const cancelBody = z.object({ reason: z.string().trim().max(300).optional().nullable() });

export const phoneLoginBody = z.object({
  phone: phoneField,
  password: z.string().min(8, 'Password minimal 8 karakter').max(128),
  turnstileToken: z.string().optional().default(''),
});

/* ---------- Admin ---------- */

export const adminBookingsQuery = z.object({
  branch: id.optional(),
  barber: id.optional(),
  status: z.enum(['pending', 'confirmed', 'completed', 'no_show', 'cancelled']).optional(),
  from: dateString,
  to: dateString,
});

export const adminStatusBody = z.object({
  status: z.enum(['confirmed', 'completed', 'no_show', 'cancelled']),
  reason: z.string().trim().max(300).optional().nullable(),
});

export const adminNoteBody = z.object({ note: z.string().trim().max(1000) });

export const walkInBody = z.object({
  branch: id,
  service: id,
  barber: barberParam,
  startAt: isoString,
  source: z.enum(['walk_in', 'admin']).default('walk_in'),
  /** Pelanggan terdaftar … */
  customerId: z.string().optional(),
  /** … atau tamu tanpa akun */
  guestName: nameField.optional(),
  guestPhone: phoneField.optional(),
  note: z.string().trim().max(1000).optional().nullable(),
  /** Cutless Stamp: tukar voucher pelanggan terdaftar di booking ini (opsional) */
  voucherId: z.string().max(64).optional(),
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format jam HH:MM');

export const branchSettingsBody = z.object({
  booking_lead_min: z.number().int().min(0).max(10080),
  booking_max_days: z.number().int().min(1).max(90),
  cancel_deadline_min: z.number().int().min(0).max(10080),
  require_manual_confirmation: z.boolean(),
  telegram_chat_id: z.string().trim().max(40).nullable().optional(),
  hours: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), open: hhmm, close: hhmm }))
    .refine((h) => h.every((x) => x.open < x.close), 'Jam tutup harus setelah jam buka')
    .optional(),
});

export const branchBody = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug huruf kecil & strip'),
  name: z.string().trim().min(2).max(60),
  city: z.string().trim().min(2).max(60),
  province: z.string().trim().max(60),
  address: z.string().trim().max(300).nullable().optional(),
  maps_url: z.string().trim().url().nullable().optional().or(z.literal('')),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  whatsapp: phoneField,
  timezone: z.enum(['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura']),
  status: z.enum(['active', 'coming_soon', 'closed']),
  photo: z.string().trim().max(300).nullable().optional(),
  sort_order: z.number().int().default(0),
});

export const barberBody = z.object({
  branch_id: id,
  name: z.string().trim().min(2).max(40),
  role: z.string().trim().max(40).nullable().optional(),
  photo: z.string().trim().max(300).nullable().optional(),
  specialty: z.string().trim().max(200).nullable().optional(),
  instagram: z.string().trim().max(200).nullable().optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  services: z.array(id).default([]),
  working: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), start: hhmm, end: hhmm }))
    .refine((w) => w.every((x) => x.start < x.end), 'Jam selesai harus setelah jam mulai')
    .optional(),
});

export const serviceBody = z.object({
  name: z.string().trim().min(2).max(60),
  category: z.string().trim().min(2).max(40),
  description: z.string().trim().max(300).nullable().optional(),
  duration_min: z.number().int().min(5).max(600),
  buffer_min: z.number().int().min(0).max(120),
  base_price: z.number().int().min(0),
  price_from: z.boolean().default(false),
  badge: z.string().trim().max(30).nullable().optional(),
  is_bookable: z.boolean().default(true),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const branchPriceBody = z.object({ price: z.number().int().min(0).nullable(), is_active: z.boolean() });

export const timeOffBody = z.object({
  barber_id: id.nullable().optional(),
  branch_id: id.nullable().optional(),
  start_at: isoString,
  end_at: isoString,
  reason: z.enum(['cuti', 'sakit', 'libur_cabang', 'hari_raya', 'lainnya']),
  note: z.string().trim().max(300).nullable().optional(),
});

export const adminUserBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(60).nullable().optional(),
  role: z.enum(['owner', 'branch_admin', 'barber']),
  branch_id: id.nullable().optional(),
  barber_id: id.nullable().optional(),
  is_active: z.boolean().default(true),
});

export const resetPasswordBody = z.object({ password: z.string().min(8).max(128) });

/* ---------- Cutless Stamp ---------- */

const serviceIdList = z.array(z.number().int().positive()).max(20);

export const loyaltySettingsBody = z
  .object({
    enabled: z.boolean(),
    tier1_stamps: z.number().int().min(1).max(50),
    tier1_service_ids: serviceIdList,
    tier2_stamps: z.number().int().min(2).max(100),
    tier2_service_ids: serviceIdList.min(1, 'Pilih minimal satu layanan hadiah utama.'),
    stamp_valid_months: z.number().int().min(1).max(36),
    voucher_valid_days: z.number().int().min(1).max(365),
  })
  .refine((v) => v.tier1_stamps < v.tier2_stamps, { message: 'Target hadiah pertama harus lebih kecil dari hadiah utama.', path: ['tier1_stamps'] });

export const loyaltyAdjustBody = z.object({
  delta: z.union([z.literal(1), z.literal(-1)]),
  reason: z.string().trim().min(3, 'Alasan wajib diisi.').max(300),
});

export const voucherRedeemBody = z.object({ voucherId: z.string().min(1).max(64) });
export const loyaltyMergeBody = z.object({ guestId: z.string().min(1).max(64) });

/* ---------- Cutless Shop ---------- */

const money = z.number().int().min(0).max(100_000_000);
const cartItems = z
  .array(z.object({ variantId: id, qty: z.number().int().min(1).max(20) }))
  .min(1, 'Keranjang kosong.')
  .max(30);
const fulfillment = z.enum(['pickup', 'with_booking', 'ship_manual', 'ship_auto']);

export const shopQuoteBody = z.object({
  branch: id,
  items: cartItems,
  fulfillment: fulfillment.optional(),
  regionId: z.string().max(40).optional().nullable(),
});

export const shopOrderBody = z.object({
  branch: id,
  items: cartItems,
  fulfillment,
  paymentMethod: z.enum(['transfer', 'qris']).default('transfer'),
  bookingId: z.string().max(64).optional().nullable(),
  shipping: z
    .object({
      recipientName: nameField,
      recipientPhone: phoneField,
      address: z.string().trim().min(10, 'Alamat terlalu pendek').max(400),
      regionId: z.string().max(40).optional().nullable(),
      regionLabel: z.string().max(200).optional().nullable(),
      postalCode: z.string().trim().max(10).optional().nullable(),
    })
    .optional()
    .nullable(),
  rate: z.object({ courier: z.string().max(30), service: z.string().max(60) }).optional().nullable(),
  note: z.string().trim().max(300).optional().nullable(),
  turnstileToken: z.string().optional().default(''),
});

export const bookingProductsBody = z.object({ items: cartItems, note: z.string().trim().max(300).optional().nullable() });

export const shopSettingsBody = z.object({
  enabled: z.boolean(),
  payment_window_min: z.number().int().min(30).max(20160),
  pickup_window_days: z.number().int().min(1).max(60),
  auto_complete_days: z.number().int().min(1).max(60),
  stamp_min_subtotal: money,
  low_stock_threshold: z.number().int().min(0).max(1000),
  return_policy: z.string().trim().max(2000),
  shipping_provider: z.enum(['manual', 'rajaongkir']),
  shipping_daily_limit: z.number().int().min(0).max(100000),
});

export const shopBranchBody = z.object({
  pickup_enabled: z.boolean(),
  with_booking_enabled: z.boolean(),
  ship_manual_enabled: z.boolean(),
  ship_auto_enabled: z.boolean(),
  bank_name: z.string().trim().max(60).nullable(),
  bank_account_no: z.string().trim().max(40).nullable(),
  bank_account_name: z.string().trim().max(80).nullable(),
  qris_image: z.string().trim().max(300).nullable(),
  payment_note: z.string().trim().max(500).nullable(),
  unique_code_enabled: z.boolean(),
  origin_region_id: z.string().trim().max(40).nullable(),
  origin_label: z.string().trim().max(200).nullable(),
});

const slug = z.string().trim().regex(/^[a-z0-9][a-z0-9-]*$/, 'Slug hanya huruf kecil, angka, dan tanda hubung').max(80);
export const productBody = z.object({
  slug,
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().max(1000).nullable(),
  notes: z.string().trim().max(3000).nullable(),
  badge: z.string().trim().max(30).nullable(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(100000),
  release_at: isoString.nullable(),
  per_customer_limit: z.number().int().min(1).max(100).nullable(),
  images: z.array(z.object({ path: z.string().trim().min(1).max(300), alt: z.string().trim().max(200).nullable().optional() })).max(10),
  variants: z
    .array(
      z.object({
        id: id.optional(),
        sku: z.string().trim().max(60).nullable(),
        name: z.string().trim().min(1).max(80),
        options: z.record(z.string().max(30), z.string().max(60)).default({}),
        price: money,
        compare_at_price: money.nullable(),
        weight_gram: z.number().int().min(1).max(50000),
        is_active: z.boolean(),
      }),
    )
    .min(1, 'Minimal satu varian.')
    .max(30),
});

export const stockBody = z.object({ branchId: id, variantId: id, onHand: z.number().int().min(0).max(100000), reason: z.string().trim().min(3, 'Alasan wajib diisi.').max(200) });

export const orderActionBody = z.object({
  shippingFee: money.optional(),
  courier: z.string().trim().max(40).optional().nullable(),
  service: z.string().trim().max(60).optional().nullable(),
  trackingNo: z.string().trim().max(60).optional(),
  amount: money.optional(),
  method: z.enum(['transfer', 'qris', 'cashier']).optional(),
  confirmMismatch: z.boolean().optional(),
  reason: z.string().trim().max(300).optional().nullable(),
  note: z.string().trim().max(300).optional().nullable(),
});

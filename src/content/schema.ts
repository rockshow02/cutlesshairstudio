/**
 * Skema konten yang dikelola lewat Pages CMS (file JSON di folder ini).
 *
 * - Dipakai saat BUILD oleh plugin Vite (scripts/vite-content-plugin.ts): bila ada JSON yang tidak
 *   sesuai skema, build gagal dengan pesan jelas → kesalahan input admin tidak pernah tayang.
 * - Frontend hanya memakai tipe hasil inferensinya (`import type`), jadi Zod tidak ikut ke bundle browser.
 * - Field & enum sama dengan skema CMS tahap 1 (Strapi) dan `.pages.yml`.
 *
 * File ini sengaja tidak memakai alias `@/` agar bisa diimpor dari vite.config.ts.
 */
import { z } from 'zod';
import { parseWIB } from '../lib/dates';

/* ---------- Helper ---------- */

/** String opsional: Pages CMS bisa menyimpan field kosong sebagai "", null, atau tidak menulisnya. */
const optionalText = (max: number) => z.string().trim().max(max, `maksimal ${max} karakter`).nullish();

/** Path gambar yang ditulis Pages CMS, mis. "/uploads/barbers/raka.webp" */
const imagePath = z
  .string()
  .regex(/^\/uploads\/[\w./-]+\.(webp|jpe?g|png|gif|avif)$/i, 'harus path gambar di /uploads/... (jpg, png, atau webp)');
const optionalImage = z.union([imagePath, z.literal('')]).nullish();

const WA_REGEX = /^62\d{8,13}$/;
const waNumber = z.string().regex(WA_REGEX, 'format nomor WhatsApp harus 62xxxxxxxxxx (tanpa +, spasi, atau strip)');
const optionalWa = z.union([waNumber, z.literal('')]).nullish();

const optionalUrl = z.union([z.url({ message: 'harus berupa link lengkap (https://...)' }), z.literal('')]).nullish();

/** "2026-10-20" atau "2026-10-20T10:00" (dibaca sebagai WIB) atau ISO lengkap dengan zona waktu */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const dateValue = z.string().regex(DATE_REGEX, 'format tanggal tidak dikenali (contoh: 2026-10-20T10:00)');
const optionalDate = z.union([dateValue, z.literal('')]).nullish();

const order = z.number().int('urutan harus bilangan bulat').min(0).default(0);
const isActive = z.boolean().default(true);

/** endDate harus setelah startDate (bila keduanya diisi) */
function dateRange<T extends { startDate?: string | null; endDate?: string | null }>(entry: T, ctx: z.RefinementCtx) {
  if (!entry.startDate || !entry.endDate) return;
  if (parseWIB(entry.endDate, true) <= parseWIB(entry.startDate)) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'tanggal selesai harus setelah tanggal mulai' });
  }
}

/* ---------- Enum (sama dengan CMS tahap 1) ---------- */

export const PRICE_CATEGORIES = ['Haircut', 'Shaving', 'Coloring', 'Treatment', 'Kids', 'Paket'] as const;
export const PRICE_BADGES = ['Best Seller', 'Baru', 'Promo'] as const;
export const GALLERY_STYLES = ['Fade', 'Pompadour', 'Crop', 'Coloring', 'Perming', 'Lainnya'] as const;
export const ANNOUNCEMENT_TYPES = ['Info', 'Tutup', 'Jam Khusus'] as const;
export const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const;

/* ---------- Skema per file ---------- */

export const pricingItemSchema = z.object({
  name: z.string().trim().min(1, 'nama layanan wajib diisi').max(80),
  category: z.enum(PRICE_CATEGORIES, { error: `kategori harus salah satu: ${PRICE_CATEGORIES.join(', ')}` }),
  price: z.number({ message: 'harga harus angka' }).int('harga harus bilangan bulat (tanpa titik/koma)').min(0),
  /** true = tampil "mulai Rp ..." */
  priceFrom: z.boolean().nullish(),
  description: optionalText(300),
  badge: z.union([z.enum(PRICE_BADGES), z.literal('')], { error: `badge harus kosong atau salah satu: ${PRICE_BADGES.join(', ')}` }).nullish(),
  order,
  isActive,
});

export const barberSchema = z.object({
  name: z.string().trim().min(1, 'nama barber wajib diisi').max(60),
  role: optionalText(60),
  photo: imagePath,
  specialty: optionalText(120),
  whatsappNumber: optionalWa,
  instagram: optionalUrl,
  order,
  isActive,
});

export const galleryItemSchema = z.object({
  image: imagePath,
  altText: z.string().trim().min(1, 'deskripsi foto wajib diisi').max(150),
  styleCategory: z.enum(GALLERY_STYLES, { error: `gaya rambut harus salah satu: ${GALLERY_STYLES.join(', ')}` }).default('Lainnya'),
  caption: optionalText(120),
  order,
  isActive,
});

export const promoSchema = z
  .object({
    title: z.string().trim().min(1, 'judul promo wajib diisi').max(80),
    description: optionalText(400),
    image: optionalImage,
    ctaLabel: optionalText(40),
    waMessage: optionalText(500),
    startDate: dateValue,
    endDate: dateValue,
    isActive,
  })
  .superRefine(dateRange);

export const announcementSchema = z
  .object({
    message: z.string().trim().min(1, 'pesan wajib diisi').max(160, 'pesan maksimal 160 karakter'),
    type: z.enum(ANNOUNCEMENT_TYPES, { error: `jenis harus salah satu: ${ANNOUNCEMENT_TYPES.join(', ')}` }).default('Info'),
    startDate: optionalDate,
    endDate: optionalDate,
    isActive,
  })
  .superRefine(dateRange);

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const openingHourSchema = z
  .object({
    day: z.enum(DAYS, { error: `hari harus salah satu: ${DAYS.join(', ')}` }),
    openTime: z.union([z.string().regex(TIME, 'format jam HH:MM, mis. 10:00'), z.literal('')]).nullish(),
    closeTime: z.union([z.string().regex(TIME, 'format jam HH:MM, mis. 21:00'), z.literal('')]).nullish(),
    isClosed: z.boolean().nullish(),
  })
  .superRefine((h, ctx) => {
    if (h.isClosed) return;
    if (!h.openTime || !h.closeTime) {
      ctx.addIssue({ code: 'custom', path: ['openTime'], message: `${h.day}: isi jam buka & tutup, atau centang "Tutup seharian"` });
    } else if (h.closeTime <= h.openTime) {
      ctx.addIssue({ code: 'custom', path: ['closeTime'], message: `${h.day}: jam tutup harus setelah jam buka` });
    }
  });

export const settingsSchema = z.object({
  logo: optionalImage,
  siteName: z.string().trim().min(1, 'nama usaha wajib diisi').max(80),
  mainWhatsappNumber: waNumber,
  defaultWaMessage: optionalText(500),
  instagramUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  googleMapsUrl: optionalUrl,
  address: optionalText(300),
  footerText: optionalText(300),
  openingHours: z.array(openingHourSchema).max(7, 'jam buka maksimal 7 baris (satu per hari)').default([]),
});

/** Daftar file konten & skemanya (dipakai plugin build untuk validasi) */
export const CONTENT_FILES = {
  'pricing.json': z.array(pricingItemSchema),
  'barbers.json': z.array(barberSchema),
  'gallery.json': z.array(galleryItemSchema),
  'promos.json': z.array(promoSchema),
  'announcements.json': z.array(announcementSchema),
  'settings.json': settingsSchema,
} as const;

/* ---------- Tipe hasil (dipakai src/lib/content.ts) ---------- */

export type PricingEntry = z.output<typeof pricingItemSchema>;
export type BarberEntry = z.output<typeof barberSchema>;
export type GalleryEntry = z.output<typeof galleryItemSchema>;
export type PromoEntry = z.output<typeof promoSchema>;
export type AnnouncementEntry = z.output<typeof announcementSchema>;
export type SettingsEntry = z.output<typeof settingsSchema>;
export type OpeningHourEntry = z.output<typeof openingHourSchema>;

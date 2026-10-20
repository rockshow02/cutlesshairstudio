/**
 * Skema konten yang dikelola lewat Pages CMS (file JSON di folder ini).
 *
 * - Dipakai saat BUILD oleh plugin Vite (scripts/vite-content-plugin.ts): JSON yang tidak sesuai skema,
 *   relasi cabang yang salah, atau konten yang belum siap tayang membuat build GAGAL dengan pesan jelas.
 * - Frontend hanya memakai tipe hasil inferensinya (`import type`), jadi Zod tidak ikut ke bundle browser.
 * - Field & enum sama dengan `.pages.yml`. Struktur branches/barbers/pricing dirancang 1:1 dengan
 *   tabel database tahap booking (lihat README → "Skema database").
 *
 * File ini sengaja tidak memakai alias `@/` agar bisa diimpor dari vite.config.ts.
 */
import { z } from 'zod';
import { parseWIB } from '../lib/dates';
import { PRICE_CATEGORIES } from './priceCategories';

/* ---------- Helper ---------- */

/** String opsional: Pages CMS bisa menyimpan field kosong sebagai "", null, atau tidak menulisnya. */
const optionalText = (max: number) => z.string().trim().max(max, `maksimal ${max} karakter`).nullish();

/** Penanda isian yang belum lengkap, mis. "TODO: alamat cabang". Lolos skema, tapi ditolak pemeriksaan launch. */
const TODO_MARK = /^\s*TODO\b/i;
const todoMarker = z.string().regex(TODO_MARK);

/** Path gambar yang ditulis Pages CMS, mis. "/uploads/barbers/raka.webp" */
const imagePath = z
  .string()
  .regex(/^\/uploads\/[\w./-]+\.(webp|jpe?g|png|gif|avif)$/i, 'harus path gambar di /uploads/... (jpg, png, atau webp)');
const optionalImage = z.union([imagePath, z.literal('')]).nullish();
/** Gambar section (hero, tentang, studio): upload Pages CMS (/uploads/...) atau aset bawaan situs (/images/...) */
const sectionImage = z
  .string()
  .regex(/^\/(uploads|images)\/[\w./-]+\.(webp|jpe?g|png|gif|avif)$/i, 'harus path gambar di /uploads/... (jpg, png, atau webp)');
const requiredText = (max: number, label: string) => z.string().trim().min(1, `${label} wajib diisi`).max(max, `maksimal ${max} karakter`);

export const WA_REGEX = /^62\d{8,13}$/;
const WA_MESSAGE = 'format nomor WhatsApp harus 62xxxxxxxxxx (tanpa +, spasi, atau strip)';
const waNumber = z.string().regex(WA_REGEX, WA_MESSAGE);
const optionalWa = z.union([waNumber, z.literal('')]).nullish();
/** Nomor WA wajib; boleh berisi penanda TODO sementara (ditolak pemeriksaan launch) */
const waOrTodo = z.union([waNumber, todoMarker], { error: `${WA_MESSAGE}, atau "TODO" bila belum ada` });

const optionalUrl = z.union([z.url({ message: 'harus berupa link lengkap (https://...)' }), z.literal('')]).nullish();

/** "2026-10-20" atau "2026-10-20T10:00" (dibaca sebagai WIB) atau ISO lengkap dengan zona waktu */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const dateValue = z.string().regex(DATE_REGEX, 'format tanggal tidak dikenali (mis. 2026-10-20T10:00)');
const optionalDate = z.union([dateValue, z.literal('')]).nullish();

/** Koordinat: angka, atau teks angka (Pages CMS menyimpan field teks) */
const coordinate = (min: number, max: number, label: string) =>
  z
    .union([z.number(), z.string().trim().regex(/^-?\d{1,3}([.,]\d+)?$/, `${label} harus angka desimal, mis. -6.5761`), z.literal('')])
    .nullish()
    .transform((v) => (v === '' || v === null || v === undefined ? null : Number(String(v).replace(',', '.'))))
    .refine((v) => v === null || (v >= min && v <= max), `${label} di luar rentang ${min} s.d. ${max}`);

const order = z.number().int('urutan harus bilangan bulat').min(0).default(0);
const isActive = z.boolean().default(true);

/** Slug cabang: huruf kecil, angka, tanda minus. Dipakai di URL /cabang/<slug>/ */
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const branchSlugRef = z.string().trim().min(1, 'cabang wajib dipilih');
const branchSlugList = z.array(z.string().trim().min(1)).nullish();

/** endDate harus setelah startDate (bila keduanya diisi) */
function dateRange<T extends { startDate?: string | null; endDate?: string | null }>(entry: T, ctx: z.RefinementCtx) {
  if (!entry.startDate || !entry.endDate) return;
  if (parseWIB(entry.endDate, true) <= parseWIB(entry.startDate)) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'tanggal selesai harus setelah tanggal mulai' });
  }
}

/* ---------- Enum ---------- */

export { PRICE_CATEGORIES } from './priceCategories';
export const PRICE_BADGES = ['Best Seller', 'Baru', 'Promo'] as const;
export const GALLERY_STYLES = ['Fade', 'Pompadour', 'Crop', 'Coloring', 'Perming', 'Lainnya'] as const;
export const GALLERY_FOCAL_POINTS = ['atas', 'tengah', 'bawah'] as const;
export const ANNOUNCEMENT_TYPES = ['Info', 'Tutup', 'Jam Khusus'] as const;
export const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const;
export const BRANCH_STATUSES = ['Aktif', 'Segera Dibuka', 'Tutup Sementara'] as const;
export const TIMEZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'] as const;
export const TESTIMONIAL_SOURCES = ['Google', 'Instagram', 'TikTok', 'Langsung'] as const;
export const PRODUCT_CATEGORIES = [
  'Pomade',
  'Hair Clay',
  'Hair Powder',
  'Hair Tonic',
  'Hair Spray',
  'Shampoo & Conditioner',
  'Beard Care',
  'Aksesoris',
  'Lainnya',
] as const;

/* ---------- Jam buka (dipakai cabang) ---------- */

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

/* ---------- Skema per file ---------- */

export const branchSchema = z.object({
  slug: z.string().trim().regex(SLUG_REGEX, 'slug hanya huruf kecil, angka, dan tanda minus (mis. bogor-bantarjati)').max(60),
  /** Nama cabang tanpa merek, mis. "Bogor Bantarjati" (dipakai di pesan WA: "... cabang Bogor Bantarjati") */
  name: z.string().trim().min(1, 'nama cabang wajib diisi').max(60),
  city: z.string().trim().min(1, 'kota wajib diisi').max(60),
  province: z.string().trim().min(1, 'provinsi wajib diisi').max(60),
  address: optionalText(300),
  googleMapsUrl: optionalUrl,
  latitude: coordinate(-90, 90, 'latitude'),
  longitude: coordinate(-180, 180, 'longitude'),
  whatsappNumber: waOrTodo,
  timezone: z.enum(TIMEZONES, { error: `zona waktu harus salah satu: ${TIMEZONES.join(', ')}` }).default('Asia/Jakarta'),
  openingHours: z
    .array(openingHourSchema)
    .max(7, 'jam buka maksimal 7 baris (satu per hari)')
    .default([])
    .refine((rows) => new Set(rows.map((r) => r.day)).size === rows.length, 'ada hari yang tercantum lebih dari sekali'),
  status: z.enum(BRANCH_STATUSES, { error: `status harus salah satu: ${BRANCH_STATUSES.join(', ')}` }).default('Aktif'),
  photo: optionalImage,
  order,
});

export const branchPriceSchema = z.object({
  branchSlug: branchSlugRef,
  price: z.number({ message: 'harga cabang harus angka' }).int('harga harus bilangan bulat').min(0),
});

export const pricingItemSchema = z.object({
  name: z.string().trim().min(1, 'nama layanan wajib diisi').max(80),
  category: z.enum(PRICE_CATEGORIES, { error: `kategori harus salah satu: ${PRICE_CATEGORIES.join(', ')}` }),
  /** Harga dasar, berlaku di semua cabang kecuali yang punya harga khusus di branchPrices */
  price: z.number({ message: 'harga harus angka' }).int('harga harus bilangan bulat (tanpa titik/koma)').min(0),
  /** true = tampil "mulai Rp ..." */
  priceFrom: z.boolean().nullish(),
  description: optionalText(300),
  badge: z.union([z.enum(PRICE_BADGES), z.literal('')], { error: `badge harus kosong atau salah satu: ${PRICE_BADGES.join(', ')}` }).nullish(),
  /** Harga khusus per cabang (opsional) */
  branchPrices: z
    .array(branchPriceSchema)
    .nullish()
    .refine((rows) => !rows || new Set(rows.map((r) => r.branchSlug)).size === rows.length, 'satu cabang hanya boleh punya satu harga khusus'),
  order,
  isActive,
});

export const barberSchema = z.object({
  name: z.string().trim().min(1, 'nama barber wajib diisi').max(60),
  role: optionalText(60),
  photo: imagePath,
  /** Cabang tempat barber bekerja (wajib) */
  branchSlug: branchSlugRef,
  specialty: optionalText(120),
  /** Opsional; kosong = pakai nomor WA cabangnya */
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
  /** Bagian foto yang dipertahankan saat dipotong (object-position vertikal) */
  focalPoint: z.enum(GALLERY_FOCAL_POINTS, { error: 'titik fokus harus atas, tengah, atau bawah' }).default('atas'),
  /** Ikut berjalan di kolom foto section Lokasi */
  showInMarquee: z.boolean().default(true),
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
    /** Kosong = berlaku di semua cabang */
    branchSlugs: branchSlugList,
    isActive,
  })
  .superRefine(dateRange);

export const announcementSchema = z
  .object({
    message: z.string().trim().min(1, 'pesan wajib diisi').max(160, 'pesan maksimal 160 karakter'),
    type: z.enum(ANNOUNCEMENT_TYPES, { error: `jenis harus salah satu: ${ANNOUNCEMENT_TYPES.join(', ')}` }).default('Info'),
    startDate: optionalDate,
    endDate: optionalDate,
    /** Kosong = berlaku di semua cabang */
    branchSlugs: branchSlugList,
    isActive,
  })
  .superRefine(dateRange);

export const testimonialSchema = z.object({
  author: z.string().trim().min(1, 'nama pemberi ulasan wajib diisi').max(60),
  rating: z.number({ message: 'rating harus angka 1–5' }).int().min(1).max(5),
  text: z.string().trim().min(1, 'isi ulasan wajib diisi').max(500),
  date: optionalDate,
  source: z.enum(TESTIMONIAL_SOURCES, { error: `sumber harus salah satu: ${TESTIMONIAL_SOURCES.join(', ')}` }).default('Google'),
  order,
  isActive,
});

export const settingsSchema = z.object({
  logo: optionalImage,
  siteName: z.string().trim().min(1, 'nama usaha wajib diisi').max(80),
  /** Domain resmi, satu-satunya sumber canonical/og:url/sitemap. Tanpa garis miring di akhir. */
  siteUrl: z
    .url({ message: 'siteUrl harus link lengkap, mis. https://cutlesshairstudio.id' })
    .regex(/^https:\/\//, 'siteUrl harus diawali https://')
    .transform((v) => v.replace(/\/+$/, '')),
  /** Nomor pusat untuk pertanyaan umum (bukan booking cabang) */
  mainWhatsappNumber: waNumber,
  defaultWaMessage: optionalText(500),
  instagramUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  /** Opsional: kosong = baris email di footer tidak ditampilkan */
  email: z.union([z.email({ message: 'format email tidak valid, mis. halo@cutlesshairstudio.id' }).max(100), z.literal('')]).nullish(),
  /** Kalimat di bawah logo footer; {cities} diisi otomatis dari kota cabang aktif */
  footerTagline: optionalText(160),
  stats: z
    .object({
      customers: z.number().int().min(0).nullish(),
      showCustomers: z.boolean().default(false),
      foundedYear: z.number().int().min(1900).max(2100).nullish(),
      showFoundedYear: z.boolean().default(false),
      /** Field teks di Pages CMS (desimal "4.9" / "4,9") → angka */
      rating: z
        .union([z.number(), z.string().trim().regex(/^\d([.,]\d)?$/, 'rating mis. 4.9'), z.literal('')])
        .nullish()
        .transform((v) => (v === '' || v === null || v === undefined ? null : Number(String(v).replace(',', '.'))))
        .refine((v) => v === null || (v >= 1 && v <= 5), 'rating harus 1–5'),
      showRating: z.boolean().default(false),
      reviewCount: z.number().int().min(0).nullish(),
      showReviewCount: z.boolean().default(false),
      /** Link ke halaman ulasan (Google Maps), dipakai tombol "Lihat semua ulasan" */
      reviewsUrl: optionalUrl,
    })
    .default({ showCustomers: false, showFoundedYear: false, rating: null, showRating: false, showReviewCount: false }),
  showTestimonials: z.boolean().default(false),
  showProducts: z.boolean().default(false),
  showBeforeAfter: z.boolean().default(false),
  /** Animasi pembuka (sekali per sesi; otomatis dilewati bila pengunjung memilih "kurangi gerakan") */
  enablePreloader: z.boolean().default(true),
  /** Opsional: video pendek pengganti animasi logo (mp4/webm, maks. 500 KB, ≤ 1,5 detik) */
  preloaderVideo: z
    .union([
      z.string().trim().regex(/^\/uploads\/videos\/[\w.-]+\.(mp4|webm)$/i, 'video preloader harus file .mp4/.webm dari folder Video'),
      z.literal(''),
    ])
    .nullish(),
});

export const productSchema = z
  .object({
    name: z.string().trim().min(1, 'nama produk wajib diisi').max(80),
    category: z.enum(PRODUCT_CATEGORIES, { error: `kategori harus salah satu: ${PRODUCT_CATEGORIES.join(', ')}` }),
    price: z.number({ message: 'harga harus angka' }).int('harga harus bilangan bulat (tanpa titik/koma)').min(0),
    /** Harga sebelum diskon (tampil dicoret). Opsional, harus lebih besar dari harga. */
    compareAtPrice: z.number({ message: 'harga coret harus angka' }).int().min(0).nullish(),
    /** Isi/ukuran, mis. "100 ml" atau "80 gr" */
    size: optionalText(30),
    description: optionalText(400),
    image: optionalImage,
    badge: z.union([z.enum(PRICE_BADGES), z.literal('')], { error: `badge harus kosong atau salah satu: ${PRICE_BADGES.join(', ')}` }).nullish(),
    inStock: z.boolean().default(true),
    shopeeUrl: optionalUrl,
    tokopediaUrl: optionalUrl,
    order,
    isActive,
  })
  .superRefine((p, ctx) => {
    if (p.compareAtPrice && p.compareAtPrice <= p.price) {
      ctx.addIssue({ code: 'custom', path: ['compareAtPrice'], message: 'harga coret harus lebih besar dari harga jual (atau kosongkan)' });
    }
  });

/** Daftar file konten & skemanya (dipakai plugin build untuk validasi) */
/* ---------- Hero, Tentang Kami, Studio (single file) ---------- */

export const heroSchema = z.object({
  /** {cities} diganti otomatis dengan kota cabang, mis. "Bogor & Cibubur" */
  kicker: requiredText(80, 'kicker'),
  titleLines: z.array(requiredText(40, 'baris judul')).min(1, 'minimal 1 baris judul').max(3, 'maksimal 3 baris judul'),
  subtitle: requiredText(240, 'subjudul'),
  primaryCtaLabel: requiredText(30, 'label tombol utama'),
  secondaryCtaLabel: requiredText(30, 'label tombol kedua'),
  image: sectionImage,
  mobileImage: z.union([sectionImage, z.literal('')]).nullish(),
  imageAlt: requiredText(150, 'deskripsi foto'),
  marquee: z.array(requiredText(40, 'teks berjalan')).min(1, 'minimal 1 teks berjalan').max(8),
});

export const ABOUT_FOCAL_POINTS = ['atas', 'tengah', 'bawah'] as const;
export const ABOUT_TRANSITIONS = ['crossfade', 'ken-burns'] as const;

export const aboutSchema = z.object({
  kicker: requiredText(40, 'kicker'),
  title: requiredText(80, 'judul'),
  /** Paragraf pertama tampil lebih besar (lead) */
  paragraphs: z.array(requiredText(600, 'paragraf')).min(1, 'minimal 1 paragraf').max(4),
  values: z
    .array(z.object({ title: requiredText(40, 'judul poin'), description: requiredText(120, 'keterangan poin') }))
    .max(6, 'maksimal 6 poin'),
  caption: optionalText(80),
  images: z
    .array(
      z.object({
        src: sectionImage,
        alt: requiredText(150, 'deskripsi foto'),
        focalPoint: z.enum(ABOUT_FOCAL_POINTS, { error: 'titik fokus harus atas, tengah, atau bawah' }).nullish(),
      }),
    )
    .min(1, 'minimal 1 foto')
    .max(8, 'maksimal 8 foto'),
  slideInterval: z.number({ message: 'jeda harus angka (detik)' }).min(3, 'jeda minimal 3 detik').max(15, 'jeda maksimal 15 detik').default(5),
  transition: z.enum(ABOUT_TRANSITIONS, { error: 'transisi harus crossfade atau ken-burns' }).default('crossfade'),
});

export const studioSchema = z
  .object({
    /** Kosong = foto cabang pertama (seperti sebelumnya) */
    image: z.union([sectionImage, z.literal('')]).nullish(),
    imageAlt: optionalText(150),
    taglines: z.array(requiredText(60, 'tagline')).min(1, 'minimal 1 tagline').max(5, 'maksimal 5 tagline'),
  })
  .superRefine((s, ctx) => {
    if (s.image && !s.imageAlt) ctx.addIssue({ code: 'custom', path: ['imageAlt'], message: 'deskripsi foto wajib diisi bila foto dipilih' });
  });

export const CONTENT_FILES = {
  'branches.json': z.array(branchSchema).min(1, 'minimal satu cabang'),
  'pricing.json': z.array(pricingItemSchema),
  'barbers.json': z.array(barberSchema),
  'gallery.json': z.array(galleryItemSchema),
  'promos.json': z.array(promoSchema),
  'announcements.json': z.array(announcementSchema),
  'testimonials.json': z.array(testimonialSchema),
  'settings.json': settingsSchema,
  'products.json': z.array(productSchema),
  'hero.json': heroSchema,
  'about.json': aboutSchema,
  'studio.json': studioSchema,
} as const;

/* ---------- Tipe hasil (dipakai src/lib/content.ts) ---------- */

export type BranchEntry = z.output<typeof branchSchema>;
export type PricingEntry = z.output<typeof pricingItemSchema>;
export type BarberEntry = z.output<typeof barberSchema>;
export type GalleryEntry = z.output<typeof galleryItemSchema>;
export type PromoEntry = z.output<typeof promoSchema>;
export type AnnouncementEntry = z.output<typeof announcementSchema>;
export type TestimonialEntry = z.output<typeof testimonialSchema>;
export type SettingsEntry = z.output<typeof settingsSchema>;
export type OpeningHourEntry = z.output<typeof openingHourSchema>;
export type ProductEntry = z.output<typeof productSchema>;
export type HeroEntry = z.output<typeof heroSchema>;
export type AboutEntry = z.output<typeof aboutSchema>;
export type StudioEntry = z.output<typeof studioSchema>;

/* ---------- Pemeriksaan lintas file ---------- */

export interface ContentBundle {
  branches: BranchEntry[];
  pricing: PricingEntry[];
  barbers: BarberEntry[];
  gallery: GalleryEntry[];
  promos: PromoEntry[];
  announcements: AnnouncementEntry[];
  testimonials: TestimonialEntry[];
  settings: SettingsEntry;
  products: ProductEntry[];
  hero: HeroEntry;
  about: AboutEntry;
  studio: StudioEntry;
}

export interface ContentIssue {
  file: string;
  where: string;
  message: string;
}

/** Nomor placeholder yang tidak boleh tayang */
export const PLACEHOLDER_WA = '6281234567890';

const labelOf = (entry: Record<string, unknown>, index: number) => {
  const label = entry.name ?? entry.title ?? entry.message ?? entry.author ?? entry.altText ?? entry.slug;
  return `entri #${index + 1}${label ? ` ("${String(label).slice(0, 40)}")` : ''}`;
};

/** Semua nilai teks di dalam sebuah entri (untuk mencari "contoh", TODO, nomor placeholder) */
function textValues(value: unknown, path: string[] = []): { path: string; text: string }[] {
  if (typeof value === 'string') return [{ path: path.join('.'), text: value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => textValues(v, [...path, String(i + 1)]));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => textValues(v, [...path, k]));
  return [];
}

/**
 * - `errors`: masalah struktural (relasi cabang tidak dikenal, slug ganda). Selalu menggagalkan build.
 * - `launch`: konten tayang yang belum siap (placeholder, "contoh", TODO, cabang aktif tanpa WA/jam buka,
 *   section aktif tanpa isi). Menggagalkan build kecuali CONTENT_CHECK=warn (khusus uji lokal).
 */
export function crossCheck(c: ContentBundle): { errors: ContentIssue[]; launch: ContentIssue[] } {
  const errors: ContentIssue[] = [];
  const launch: ContentIssue[] = [];
  const slugs = c.branches.map((b) => b.slug);
  const known = new Set(slugs);
  const choices = slugs.join(', ');
  const unknown = (slug: string) => `cabang "${slug}" tidak ada di branches.json (pilihan: ${choices})`;

  // Slug unik
  slugs.forEach((slug, i) => {
    if (slugs.indexOf(slug) !== i) errors.push({ file: 'branches.json', where: labelOf(c.branches[i], i), message: `slug "${slug}" dipakai lebih dari satu cabang` });
  });

  // Relasi ke cabang
  c.barbers.forEach((b, i) => {
    if (!known.has(b.branchSlug)) errors.push({ file: 'barbers.json', where: labelOf(b, i), message: unknown(b.branchSlug) });
  });
  c.pricing.forEach((p, i) =>
    (p.branchPrices ?? []).forEach((bp) => {
      if (!known.has(bp.branchSlug)) errors.push({ file: 'pricing.json', where: `${labelOf(p, i)} → harga cabang`, message: unknown(bp.branchSlug) });
    }),
  );
  (['promos', 'announcements'] as const).forEach((key) =>
    c[key].forEach((entry, i) =>
      (entry.branchSlugs ?? []).forEach((slug) => {
        if (!known.has(slug)) errors.push({ file: `${key}.json`, where: labelOf(entry, i), message: unknown(slug) });
      }),
    ),
  );

  // ---- Kesiapan launch: hanya konten yang TAYANG ----
  const shown = <T extends { isActive?: boolean | null }>(items: T[]) => items.filter((x) => x.isActive !== false);
  const displayed: { file: string; entries: Record<string, unknown>[] }[] = [
    { file: 'branches.json', entries: c.branches },
    { file: 'pricing.json', entries: shown(c.pricing) },
    { file: 'barbers.json', entries: shown(c.barbers) },
    { file: 'gallery.json', entries: shown(c.gallery) },
    { file: 'promos.json', entries: shown(c.promos) },
    { file: 'announcements.json', entries: shown(c.announcements) },
    { file: 'settings.json', entries: [c.settings as unknown as Record<string, unknown>] },
    ...(c.settings.showTestimonials ? [{ file: 'testimonials.json', entries: shown(c.testimonials) }] : []),
    ...(c.settings.showProducts ? [{ file: 'products.json', entries: shown(c.products) }] : []),
  ];

  for (const { file, entries } of displayed) {
    entries.forEach((entry, i) => {
      const where = file === 'settings.json' ? 'pengaturan situs' : labelOf(entry, i);
      for (const { path, text } of textValues(entry)) {
        if (text.includes(PLACEHOLDER_WA)) launch.push({ file, where: `${where} → ${path}`, message: `masih nomor contoh ${PLACEHOLDER_WA}, ganti dengan nomor asli` });
        if (/\bTODO\b/i.test(text)) launch.push({ file, where: `${where} → ${path}`, message: `masih berisi penanda TODO: "${text.slice(0, 60)}"` });
        if (/\bcontoh\b/i.test(text)) launch.push({ file, where: `${where} → ${path}`, message: `masih berisi kata "contoh": "${text.slice(0, 60)}"` });
      }
    });
  }

  c.branches.forEach((b, i) => {
    if (b.status !== 'Aktif') return;
    if (!WA_REGEX.test(b.whatsappNumber)) launch.push({ file: 'branches.json', where: labelOf(b, i), message: 'cabang Aktif wajib punya nomor WhatsApp asli' });
    const openDays = b.openingHours.filter((h) => !h.isClosed && h.openTime && h.closeTime);
    if (openDays.length === 0) launch.push({ file: 'branches.json', where: labelOf(b, i), message: 'cabang Aktif wajib punya jam buka' });
    if (!b.address) launch.push({ file: 'branches.json', where: labelOf(b, i), message: 'cabang Aktif wajib punya alamat' });
  });

  if (!c.branches.some((b) => b.status === 'Aktif')) {
    launch.push({ file: 'branches.json', where: 'semua cabang', message: 'minimal satu cabang berstatus Aktif agar pengunjung bisa booking' });
  }
  if (c.settings.showTestimonials && shown(c.testimonials).length === 0) {
    launch.push({ file: 'settings.json', where: 'Tampilkan testimoni', message: 'aktif tetapi belum ada ulasan; isi Testimoni dulu atau matikan' });
  }
  if (c.settings.showProducts && shown(c.products).length === 0) {
    launch.push({ file: 'settings.json', where: 'Tampilkan produk', message: 'aktif tetapi belum ada produk; isi Produk dulu atau matikan' });
  }
  const stats = c.settings.stats;
  const missingStat = (show: boolean, value: unknown, label: string) => {
    if (show && (value === null || value === undefined)) launch.push({ file: 'settings.json', where: `statistik ${label}`, message: 'ditampilkan tetapi angkanya kosong' });
  };
  missingStat(stats.showCustomers, stats.customers, 'pelanggan');
  missingStat(stats.showFoundedYear, stats.foundedYear, 'tahun berdiri');
  missingStat(stats.showRating, stats.rating, 'rating');
  missingStat(stats.showReviewCount, stats.reviewCount, 'jumlah ulasan');

  return { errors, launch };
}

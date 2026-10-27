/**
 * Data uji lengkap untuk tes unit: semua file konten (lolos skema Zod), TIDAK dibaca dari src/content/*.json.
 * Isi file konten asli diubah admin lewat Pages CMS kapan saja; tes yang memakai data uji ini tidak ikut merah selama
 * isi asli valid. File asli hanya diperiksa oleh tes validasi skema/form CMS (cms-save, cms-schema, dll.).
 *
 * Pakai `contentFixture({ ...override })` → ContentBundle hasil parse skema; `rawFixture` = isi mentah per file.
 */
import { CONTENT_FILES, type ContentBundle } from '../../src/content/schema';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
export const FIXTURE_HOURS = DAYS.map((day) => ({ day, openTime: '09:00', closeTime: '21:00', isClosed: false }));

/** Isi mentah per file (seperti yang ditulis Pages CMS) */
export const rawFixture = {
  branches: [
    { slug: 'bogor-bantarjati', name: 'Bogor Bantarjati', city: 'Bogor', province: 'Jawa Barat', address: 'Jl. Uji Bogor No. 1', whatsappNumber: '6281100000101', openingHours: FIXTURE_HOURS, status: 'Aktif', order: 10 },
    { slug: 'cibubur', name: 'Cibubur', city: 'Cibubur', province: 'Jawa Barat', address: 'Jl. Uji Cibubur No. 2', whatsappNumber: '6281100000202', openingHours: FIXTURE_HOURS, status: 'Aktif', order: 20 },
  ],
  pricing: [
    { name: 'Haircut Uji', category: 'Haircut', price: 100000, order: 10 },
    { name: 'Coloring Uji', category: 'Special Treatment', price: 400000, priceFrom: true, order: 20 },
  ],
  barbers: [],
  gallery: [],
  promos: [],
  announcements: [],
  testimonials: [],
  settings: {
    siteName: 'Cutless Uji',
    siteUrl: 'https://cutlesshairstudio.com',
    mainWhatsappNumber: '6281100000909',
    email: 'halo@uji.test',
    footerTagline: 'Hair studio di {cities}. Goodstyle, goodmood.',
    defaultWaMessage: 'Halo {brand}, saya mau booking di cabang {branch}.',
  },
  products: [],
  hero: {
    kicker: 'Hair studio · {cities}',
    titleLines: ['Cut Less.', 'Style More.'],
    subtitle: 'Subjudul uji.',
    primaryCtaLabel: 'Booking Uji',
    secondaryCtaLabel: 'Lihat Layanan Uji',
    image: '/images/hero/hero-uji.jpg',
    imageAlt: 'Foto hero uji',
    marquee: ['Haircut'],
  },
  about: {
    kicker: 'Tentang Kami',
    title: 'Judul tentang uji',
    paragraphs: ['Paragraf uji.'],
    values: [{ title: 'Rapi', description: 'Keterangan uji.' }],
    images: [{ src: '/uploads/about/foto-uji.webp', alt: 'Foto uji' }],
  },
  studio: { taglines: ['On point, always.'] },
  cta: { kicker: 'Booking', title: 'Kursimu sudah siap.', description: 'Deskripsi uji.', ctaLabel: 'Booking Uji' },
  partners: { enabled: false, logos: [] },
  shoeCare: {
    enabled: false,
    branchSlug: 'bogor-bantarjati',
    name: 'Cuci Sepatu Uji',
    advantages: [
      { title: 'A', description: 'a' },
      { title: 'B', description: 'b' },
    ],
    aboutParagraphs: ['Paragraf uji.'],
    services: [{ name: 'Fast Clean' }],
  },
  services: [{ name: 'Haircut', description: 'Potong rambut uji.', pricingCategory: 'Haircut' }],
  faq: { enabled: false, title: 'FAQ uji', items: [] },
  videos: { enabled: false, title: 'Video uji', items: [] },
} satisfies Record<keyof ContentBundle, unknown>;

/** Bundle konten uji (hasil parse skema, seperti saat build), dengan bagian yang ditimpa */
export function contentFixture(override: Partial<ContentBundle> = {}): ContentBundle {
  const parsed = Object.fromEntries(
    Object.entries(CONTENT_FILES).map(([file, schema]) => {
      const key = file.replace('.json', '') as keyof ContentBundle;
      return [key, (schema as { parse: (v: unknown) => unknown }).parse(structuredClone(rawFixture[key]))];
    }),
  ) as unknown as ContentBundle;
  return { ...parsed, ...override };
}

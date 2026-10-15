/**
 * Lapisan data. SATU-SATUNYA pintu komponen untuk mengambil konten.
 *
 * Sumber konten (tanpa server, tanpa API, biaya Rp0):
 *   - src/content/*.json : dikelola admin lewat Pages CMS (harga, barber, galeri, promo,
 *                          pengumuman, pengaturan situs). Divalidasi Zod saat build.
 *   - src/content/*.ts   : teks statis (hero, about, layanan, testimoni, label UI, dll.).
 *
 * Signature & tipe kembalian sama dengan versi sebelumnya → komponen tidak berubah.
 * Penyaringan isActive & urutan `order` dilakukan di sini; filter tanggal promo/pengumuman
 * dievaluasi di browser saat halaman dibuka (WIB), jadi promo muncul/hilang tepat waktu tanpa build ulang.
 */
import * as local from '@/content';
import pricingJson from '@/content/pricing.json';
import barbersJson from '@/content/barbers.json';
import galleryJson from '@/content/gallery.json';
import promosJson from '@/content/promos.json';
import announcementsJson from '@/content/announcements.json';
import settingsJson from '@/content/settings.json';
import type {
  AnnouncementEntry,
  BarberEntry,
  GalleryEntry,
  PricingEntry,
  PromoEntry,
  SettingsEntry,
} from '@/content/schema';
import type {
  AboutContent,
  Announcement,
  BarbersContent,
  CtaBannerContent,
  GalleryContent,
  HeroContent,
  LocationsContent,
  PricingContent,
  PromoContent,
  ServicesContent,
  SiteContent,
  SocialLink,
  TestimonialsContent,
} from '@/types';
import {
  buildAnnouncements,
  buildBarbers,
  buildGallery,
  buildLocations,
  buildPricing,
  buildPromos,
  buildSite,
  buildSocials,
} from './contentTransforms';

/**
 * Pesan fatal bila konfigurasi situs gagal dimuat. Satu-satunya teks yang tidak berasal
 * dari konten, karena label UI sendiri ada di dalam data situs.
 */
export const FATAL_ERROR_MESSAGE = 'Website sedang tidak bisa dimuat. Silakan coba lagi beberapa saat lagi.';

/** JSON sudah divalidasi skema Zod saat build (scripts/vite-content-plugin.ts). */
const data = {
  pricing: pricingJson as unknown as PricingEntry[],
  barbers: barbersJson as unknown as BarberEntry[],
  gallery: galleryJson as unknown as GalleryEntry[],
  promos: promosJson as unknown as PromoEntry[],
  announcements: announcementsJson as unknown as AnnouncementEntry[],
  settings: settingsJson as unknown as SettingsEntry,
};

/** Simulasi latensi untuk menguji state loading: VITE_CONTENT_DELAY=1200 npm run dev */
const SIMULATED_DELAY = Number(import.meta.env.VITE_CONTENT_DELAY ?? 0);

/** Kembalikan salinan (komponen tidak bisa mengubah sumber), tetap async agar signature tidak berubah. */
async function resolve<T>(build: () => T): Promise<T> {
  if (SIMULATED_DELAY > 0) await new Promise((r) => setTimeout(r, SIMULATED_DELAY));
  return structuredClone(build());
}

const closedLabel = local.locations.labels.closed;

/* ---------- Dikelola admin (Pages CMS) ---------- */

export const getSite = (): Promise<SiteContent> => resolve(() => buildSite(data.settings, local.site, closedLabel));
export const getSocials = (): Promise<SocialLink[]> => resolve(() => buildSocials(data.settings, local.socials));
export const getLocations = (): Promise<LocationsContent> => resolve(() => buildLocations(data.settings, local.locations));
export const getPricing = (): Promise<PricingContent> => resolve(() => buildPricing(data.pricing, local.pricingCopy));
export const getBarbers = (): Promise<BarbersContent> => resolve(() => buildBarbers(data.barbers, local.barbersCopy));
export const getGallery = (): Promise<GalleryContent> => resolve(() => buildGallery(data.gallery, local.galleryCopy));
/** Dievaluasi saat dipanggil (di browser) → promo muncul/hilang sesuai jam WIB tanpa build ulang */
export const getPromos = (): Promise<PromoContent> => resolve(() => buildPromos(data.promos, local.promoCopy));
export const getAnnouncements = (): Promise<Announcement[]> => resolve(() => buildAnnouncements(data.announcements));

/* ---------- Statis ---------- */

export const getHero = (): Promise<HeroContent> => resolve(() => local.hero);
export const getAbout = (): Promise<AboutContent> => resolve(() => local.about);
export const getServices = (): Promise<ServicesContent> => resolve(() => local.services);
export const getTestimonials = (): Promise<TestimonialsContent> => resolve(() => local.testimonials);
export const getCtaBanner = (): Promise<CtaBannerContent> => resolve(() => local.ctaBanner);

/**
 * Lapisan data. SATU-SATUNYA pintu komponen untuk mengambil konten.
 *
 * Sumber konten (tanpa server, tanpa API, biaya Rp0):
 *   - src/content/*.json : dikelola admin lewat Pages CMS (cabang, harga, barber, galeri, promo,
 *                          pengumuman, testimoni, produk, pengaturan situs). Divalidasi Zod saat build.
 *   - src/content/*.ts   : teks statis (hero, about, layanan, label UI, dll.).
 *
 * Fungsi menerima `branchSlug` opsional untuk data per cabang. Tahap booking: cukup ganti isi fungsi
 * ini dengan pemanggilan API/database (struktur branches/barbers/pricing sudah 1:1 dengan tabel).
 * Filter tanggal promo/pengumuman dievaluasi di browser saat dipanggil (WIB), tanpa build ulang.
 */
import * as local from '@/content';
import branchesJson from '@/content/branches.json';
import pricingJson from '@/content/pricing.json';
import barbersJson from '@/content/barbers.json';
import galleryJson from '@/content/gallery.json';
import promosJson from '@/content/promos.json';
import announcementsJson from '@/content/announcements.json';
import testimonialsJson from '@/content/testimonials.json';
import settingsJson from '@/content/settings.json';
import productsJson from '@/content/products.json';
import type {
  AnnouncementEntry,
  BarberEntry,
  BranchEntry,
  GalleryEntry,
  PricingEntry,
  ProductEntry,
  PromoEntry,
  SettingsEntry,
  TestimonialEntry,
} from '@/content/schema';
import type {
  AboutContent,
  Announcement,
  BarbersContent,
  Branch,
  BranchCopy,
  CtaBannerContent,
  GalleryContent,
  HeroContent,
  LocationsContent,
  PricingContent,
  ProductsContent,
  PromoContent,
  ServicesContent,
  SiteContent,
  SocialLink,
  TestimonialsContent,
} from '@/types';
import {
  buildAbout,
  buildAnnouncements,
  buildBarbers,
  buildBranches,
  buildGallery,
  buildLocations,
  buildPricing,
  buildProducts,
  buildPromos,
  buildServices,
  buildSite,
  buildSocials,
  buildTestimonials,
  joinIndonesian,
  operatingCities,
} from './contentTransforms';

/**
 * Pesan fatal bila konfigurasi situs gagal dimuat. Satu-satunya teks yang tidak berasal
 * dari konten, karena label UI sendiri ada di dalam data situs.
 */
export const FATAL_ERROR_MESSAGE = 'Website sedang tidak bisa dimuat. Silakan coba lagi beberapa saat lagi.';

/** JSON sudah divalidasi skema Zod saat build (scripts/vite-content-plugin.ts). */
const data = {
  branches: branchesJson as unknown as BranchEntry[],
  pricing: pricingJson as unknown as PricingEntry[],
  barbers: barbersJson as unknown as BarberEntry[],
  gallery: galleryJson as unknown as GalleryEntry[],
  promos: promosJson as unknown as PromoEntry[],
  announcements: announcementsJson as unknown as AnnouncementEntry[],
  testimonials: testimonialsJson as unknown as TestimonialEntry[],
  settings: normalizeSettings(settingsJson as unknown as SettingsEntry),
  products: productsJson as unknown as ProductEntry[],
};

/** Nilai default yang diisi Zod saat validasi build (Pages CMS bisa tidak menulis field kosong) */
function normalizeSettings(s: SettingsEntry): SettingsEntry {
  return {
    ...s,
    siteUrl: (s.siteUrl ?? '').replace(/\/+$/, ''),
    stats: {
      ...s.stats,
      rating: s.stats?.rating === undefined || s.stats?.rating === null || (s.stats.rating as unknown) === ''
        ? null
        : Number(String(s.stats.rating).replace(',', '.')),
      showCustomers: Boolean(s.stats?.showCustomers),
      showFoundedYear: Boolean(s.stats?.showFoundedYear),
      showRating: Boolean(s.stats?.showRating),
      showReviewCount: Boolean(s.stats?.showReviewCount),
    },
    showTestimonials: Boolean(s.showTestimonials),
    showProducts: Boolean(s.showProducts),
    showBeforeAfter: Boolean(s.showBeforeAfter),
  };
}

/** Simulasi latensi untuk menguji state loading: VITE_CONTENT_DELAY=1200 npm run dev */
const SIMULATED_DELAY = Number(import.meta.env.VITE_CONTENT_DELAY ?? 0);

/** Kembalikan salinan (komponen tidak bisa mengubah sumber), tetap async agar mudah diganti API. */
async function resolve<T>(build: () => T): Promise<T> {
  if (SIMULATED_DELAY > 0) await new Promise((r) => setTimeout(r, SIMULATED_DELAY));
  return structuredClone(build());
}

const branchList = (): Branch[] => buildBranches(data.branches, data.settings.siteName);

/* ---------- Cabang ---------- */

export const getBranches = (): Promise<Branch[]> => resolve(branchList);
export const getBranchBySlug = (slug: string): Promise<Branch | undefined> =>
  resolve(() => branchList().find((b) => b.slug === slug));
export const getBranchCopy = (): Promise<BranchCopy> => resolve(() => local.branchesCopy);
export const getLocations = (): Promise<LocationsContent> => resolve(() => buildLocations(branchList(), local.branchesCopy));
/** Ringkasan kota cabang, mis. "Bogor & Cibubur" */
export const getCitiesLabel = (): Promise<string> => resolve(() => joinIndonesian(operatingCities(branchList())));

/* ---------- Data merek ---------- */

export const getSite = (): Promise<SiteContent> => resolve(() => buildSite(data.settings, local.site, branchList()));
export const getSocials = (): Promise<SocialLink[]> => resolve(() => buildSocials(data.settings, local.socials));

/* ---------- Per cabang (branchSlug opsional) ---------- */

export const getPricing = (branchSlug?: string): Promise<PricingContent> =>
  resolve(() => buildPricing(data.pricing, local.pricingCopy, branchList(), branchSlug));
export const getServices = (branchSlug?: string): Promise<ServicesContent> =>
  resolve(() => buildServices(local.services, data.pricing, branchSlug));
export const getBarbers = (branchSlug?: string): Promise<BarbersContent> =>
  resolve(() => buildBarbers(data.barbers, local.barbersCopy, branchList(), branchSlug));
/** Promo aktif (tanggal dievaluasi saat dipanggil). branchSlug → hanya promo yang berlaku di cabang itu. */
export const getPromos = (branchSlug?: string): Promise<PromoContent> =>
  resolve(() => buildPromos(data.promos, local.promoCopy, branchList(), branchSlug));
export const getAnnouncements = (branchSlug?: string): Promise<Announcement[]> =>
  resolve(() => buildAnnouncements(data.announcements, branchList(), branchSlug));

/* ---------- Lainnya ---------- */

export const getAbout = (): Promise<AboutContent> =>
  resolve(() => buildAbout(local.aboutCopy, data.settings, branchList(), data.barbers));
export const getGallery = (): Promise<GalleryContent> =>
  resolve(() => buildGallery(data.gallery, local.galleryCopy, data.settings.showBeforeAfter));
export const getTestimonials = (): Promise<TestimonialsContent> =>
  resolve(() => buildTestimonials(data.testimonials, local.testimonialsCopy, data.settings));
export const getProducts = (): Promise<ProductsContent> => resolve(() => buildProducts(data.products, local.productsCopy));
export const getHero = (): Promise<HeroContent> => resolve(() => local.hero);
export const getCtaBanner = (): Promise<CtaBannerContent> => resolve(() => local.ctaBanner);

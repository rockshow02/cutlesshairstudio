/**
 * Lapisan data. SATU-SATUNYA pintu komponen untuk mengambil konten.
 *
 * Tahap 1 CMS (Strapi):
 *   - Dari CMS  : harga, barber, galeri, promo, pengumuman, pengaturan situs
 *                 (pengaturan situs juga mengisi socials & cabang utama di lokasi).
 *   - Statis    : hero, about, layanan, testimoni, CTA, sisa data lokasi, label UI.
 *
 * Aturan:
 *   - Signature & tipe kembalian tidak berubah → komponen tidak perlu disentuh.
 *   - VITE_CMS_URL kosong → selalu data statis.
 *   - CMS gagal / timeout (5 dtk) → fallback ke data statis di src/content (website tidak pernah kosong).
 *     Error hanya di-log di mode development.
 *   - Cache klien: TanStack Query, staleTime 5 menit; request yang sama didedupe.
 */
import { QueryClient } from '@tanstack/react-query';
import * as local from '@/content';
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
import { CmsError, cmsGet, isCmsEnabled } from './cms/client';
import type { StrapiQuery } from './cms/query';
import type {
  CmsAnnouncement,
  CmsBarber,
  CmsGalleryItem,
  CmsPricingItem,
  CmsPromo,
  CmsSiteSettings,
  StrapiList,
  StrapiSingle,
} from './cms/types';
import {
  mapAnnouncements,
  mapBarbers,
  mapGallery,
  mapLocations,
  mapPricing,
  mapPromos,
  mapSite,
  mapSocials,
} from './cms/mappers';

/**
 * Pesan fatal bila konfigurasi situs (getSite) gagal dimuat. Satu-satunya teks yang tidak
 * berasal dari konten, karena label UI sendiri ada di dalam data situs.
 */
export const FATAL_ERROR_MESSAGE = 'Website sedang tidak bisa dimuat. Silakan coba lagi beberapa saat lagi.';

const FIVE_MINUTES = 5 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: FIVE_MINUTES, gcTime: 30 * 60 * 1000, retry: false, refetchOnWindowFocus: false },
  },
});

/** Simulasi latensi untuk menguji state loading: VITE_CONTENT_DELAY=1200 npm run dev */
const SIMULATED_DELAY = Number(import.meta.env.VITE_CONTENT_DELAY ?? 0);
const delay = () => (SIMULATED_DELAY > 0 ? new Promise((r) => setTimeout(r, SIMULATED_DELAY)) : Promise.resolve());

/** Salinan data statis agar komponen tidak bisa memodifikasi sumber. */
const fromLocal = <T>(data: T): T => structuredClone(data);

/**
 * Circuit breaker: bila CMS timeout / tidak bisa dihubungi, request berikutnya langsung memakai
 * data statis selama 1 menit (tidak menunggu 5 detik lagi per section).
 */
const CIRCUIT_OPEN_MS = 60 * 1000;
let cmsDownUntil = 0;
const cmsAvailable = () => isCmsEnabled() && Date.now() >= cmsDownUntil;

/** Ambil dari CMS; bila gagal, pakai fallback statis. Hasil (termasuk fallback) di-cache 5 menit. */
function load<T>(key: string, fromCms: () => Promise<T>, fallback: () => T): Promise<T> {
  return queryClient.fetchQuery({
    queryKey: ['content', key],
    queryFn: async () => {
      await delay();
      if (!cmsAvailable()) return fallback();
      try {
        return await fromCms();
      } catch (error) {
        if (error instanceof CmsError && error.unreachable) cmsDownUntil = Date.now() + CIRCUIT_OPEN_MS;
        if (import.meta.env.DEV) {
          console.error(`[CMS] Gagal memuat "${key}", memakai data statis.`, error);
        }
        return fallback();
      }
    },
  });
}

/* ---------- Query Strapi (hanya field & relasi yang dibutuhkan, tanpa populate=*) ---------- */

const MEDIA_FIELDS = ['url', 'alternativeText', 'width', 'height', 'formats'];
const activeSorted = (fields: string[]): StrapiQuery => ({
  filters: { isActive: { $eq: true } },
  sort: ['order:asc', 'createdAt:asc'],
  fields,
  pagination: { pageSize: 100 },
});

/** Site Settings dipakai getSite, getSocials, dan getLocations → satu request, di-cache bersama. */
function fetchSiteSettings(): Promise<CmsSiteSettings | null> {
  return queryClient.fetchQuery({
    queryKey: ['cms', 'site-setting'],
    queryFn: async () => {
      const res = await cmsGet<StrapiSingle<CmsSiteSettings>>('site-setting', {
        fields: ['siteName', 'mainWhatsappNumber', 'defaultWaMessage', 'instagramUrl', 'tiktokUrl', 'googleMapsUrl', 'address', 'footerText'],
        populate: { logo: { fields: MEDIA_FIELDS }, openingHours: true },
      });
      return res.data;
    },
  });
}

/* ---------- Getter (signature tidak berubah) ---------- */

export const getSite = (): Promise<SiteContent> =>
  load(
    'site',
    async () => mapSite(await fetchSiteSettings(), fromLocal(local.site), local.locations.labels.closed),
    () => fromLocal(local.site),
  );

export const getSocials = (): Promise<SocialLink[]> =>
  load('socials', async () => mapSocials(await fetchSiteSettings(), fromLocal(local.socials)), () => fromLocal(local.socials));

export const getLocations = (): Promise<LocationsContent> =>
  load('locations', async () => mapLocations(await fetchSiteSettings(), fromLocal(local.locations)), () => fromLocal(local.locations));

export const getPricing = (): Promise<PricingContent> =>
  load(
    'pricing',
    async () => {
      const res = await cmsGet<StrapiList<CmsPricingItem>>('pricing-items', {
        ...activeSorted(['name', 'category', 'price', 'priceFrom', 'description', 'badge', 'order', 'isActive']),
        sort: ['order:asc', 'price:asc'],
      });
      return mapPricing(res.data, fromLocal(local.pricing));
    },
    () => fromLocal(local.pricing),
  );

export const getBarbers = (): Promise<BarbersContent> =>
  load(
    'barbers',
    async () => {
      const res = await cmsGet<StrapiList<CmsBarber>>('barbers', {
        ...activeSorted(['name', 'role', 'specialty', 'whatsappNumber', 'instagram', 'order', 'isActive']),
        populate: { photo: { fields: MEDIA_FIELDS } },
      });
      return mapBarbers(res.data, fromLocal(local.barbers));
    },
    () => fromLocal(local.barbers),
  );

export const getGallery = (): Promise<GalleryContent> =>
  load(
    'gallery',
    async () => {
      const res = await cmsGet<StrapiList<CmsGalleryItem>>('gallery-items', {
        ...activeSorted(['altText', 'styleCategory', 'caption', 'order', 'isActive']),
        populate: { image: { fields: MEDIA_FIELDS } },
      });
      return mapGallery(res.data, fromLocal(local.gallery));
    },
    () => fromLocal(local.gallery),
  );

/** Promo aktif, sudah dipublikasikan, dan dalam rentang tanggal (dibandingkan sebagai waktu absolut). */
export const getPromos = (): Promise<PromoContent> =>
  load(
    'promos',
    async () => {
      const now = new Date().toISOString();
      const res = await cmsGet<StrapiList<CmsPromo>>('promos', {
        filters: { isActive: { $eq: true }, startDate: { $lte: now }, endDate: { $gte: now } },
        fields: ['title', 'description', 'ctaLabel', 'waMessage', 'startDate', 'endDate', 'isActive'],
        populate: { image: { fields: MEDIA_FIELDS } },
        sort: ['endDate:asc'],
        pagination: { pageSize: 10 },
      });
      return mapPromos(res.data, fromLocal(local.promo));
    },
    () => fromLocal(local.promo),
  );

/** Pengumuman aktif & dipublikasikan; tanggal mulai/selesai opsional. */
export const getAnnouncements = (): Promise<Announcement[]> =>
  load(
    'announcements',
    async () => {
      const now = new Date().toISOString();
      const res = await cmsGet<StrapiList<CmsAnnouncement>>('announcements', {
        filters: {
          isActive: { $eq: true },
          $and: [
            { $or: [{ startDate: { $null: true } }, { startDate: { $lte: now } }] },
            { $or: [{ endDate: { $null: true } }, { endDate: { $gte: now } }] },
          ],
        },
        fields: ['message', 'type', 'startDate', 'endDate', 'isActive', 'updatedAt'],
        sort: ['updatedAt:desc'],
        pagination: { pageSize: 5 },
      });
      return mapAnnouncements(res.data);
    },
    () => fromLocal(local.announcements),
  );

/* ---------- Masih statis di tahap 1 ---------- */

const staticOnly = <T>(key: string, data: T) => load(key, async () => fromLocal(data), () => fromLocal(data));

export const getHero = (): Promise<HeroContent> => staticOnly('hero', local.hero);
export const getAbout = (): Promise<AboutContent> => staticOnly('about', local.about);
export const getServices = (): Promise<ServicesContent> => staticOnly('services', local.services);
export const getTestimonials = (): Promise<TestimonialsContent> => staticOnly('testimonials', local.testimonials);
export const getCtaBanner = (): Promise<CtaBannerContent> => staticOnly('cta', local.ctaBanner);

/**
 * Mulai semua request konten secara paralel saat aplikasi boot (dipanggil di main.tsx).
 * Komponen yang memanggil getter yang sama akan memakai request/cache ini, sehingga waktu tunggu
 * terburuk saat CMS lambat ≈ 5 detik total, bukan 5 detik per section.
 */
export function prefetchContent(): void {
  const all = [
    getSite, getSocials, getLocations, getHero, getAbout, getServices, getPricing,
    getBarbers, getGallery, getTestimonials, getCtaBanner, getPromos, getAnnouncements,
  ];
  all.forEach((get) => void get().catch(() => undefined));
}

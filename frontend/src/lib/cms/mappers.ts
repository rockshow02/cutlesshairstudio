/**
 * Mapper: respons Strapi → tipe frontend (src/types).
 * Konten yang belum dikelola CMS (heading section, label UI, before/after, dll.)
 * diambil dari data statis `base` lalu digabung.
 */
import type {
  Announcement,
  Barber,
  BarbersContent,
  GalleryContent,
  GalleryItem,
  GalleryLayout,
  ImageAsset,
  LocationsContent,
  OpeningHour,
  PriceCategory,
  PriceCategoryKey,
  PricePackage,
  PricingContent,
  PromoContent,
  SiteContent,
  SocialLink,
} from '@/types';
import { formatTime } from '@/lib/format';
import { CMS_URL } from './client';
import type {
  CmsAnnouncement,
  CmsBarber,
  CmsDay,
  CmsGalleryItem,
  CmsOpeningHour,
  CmsPricingItem,
  CmsPromo,
  CmsSiteSettings,
  StrapiMedia,
} from './types';

/* ---------- Helper umum ---------- */

/** URL media Strapi: provider lokal mengembalikan path relatif (/uploads/...), Cloudinary URL absolut. */
export function mediaUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${CMS_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Media Strapi → ImageAsset, lengkap dengan srcset dari format responsif Strapi. */
export function mapImage(media: StrapiMedia, fallbackAlt: string, sizes?: string): ImageAsset {
  const formats = media.formats ?? {};
  const variants = [formats.small, formats.medium, formats.large].filter((f): f is NonNullable<typeof f> => Boolean(f));
  const candidates = variants.map((f) => `${mediaUrl(f.url)} ${f.width}w`);
  if (media.width) candidates.push(`${mediaUrl(media.url)} ${media.width}w`);
  const preferred = formats.medium ?? formats.large ?? null;

  return {
    src: mediaUrl(preferred?.url ?? media.url),
    srcSet: candidates.length > 1 ? candidates.join(', ') : undefined,
    sizes: candidates.length > 1 ? sizes : undefined,
    alt: media.alternativeText?.trim() || fallbackAlt,
    width: media.width ?? preferred?.width ?? 800,
    height: media.height ?? preferred?.height ?? 600,
  };
}

/** Teks multi-baris/berkoma → array bersih. */
function splitList(value: string | null | undefined, separator: RegExp): string[] {
  return (value ?? '')
    .split(separator)
    .map((s) => s.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

/** Aktif sekarang? Perbandingan instan waktu absolut (UTC), jadi benar untuk WIB maupun zona lain. */
export function isWithinRange(start?: string | null, end?: string | null, now = Date.now()): boolean {
  if (start && Date.parse(start) > now) return false;
  if (end && Date.parse(end) < now) return false;
  return true;
}

/** "6281234567890" → "0812-3456-7890" */
export function formatPhoneDisplay(number: string): string {
  const digits = number.replace(/\D/g, '');
  const local = digits.startsWith('62') ? `0${digits.slice(2)}` : digits;
  return [local.slice(0, 4), local.slice(4, 8), local.slice(8)].filter(Boolean).join('-');
}

/* ---------- Daftar Harga ---------- */

const CATEGORY_ORDER: Exclude<PriceCategoryKey, 'Paket'>[] = ['Haircut', 'Kids', 'Shaving', 'Coloring', 'Treatment'];

export function mapPricing(items: CmsPricingItem[], base: PricingContent): PricingContent {
  const labels = new Map(base.categories.map((c) => [c.id, c.name]));

  const categories: PriceCategory[] = CATEGORY_ORDER.map((key) => ({
    id: key,
    name: labels.get(key) ?? key,
    items: items
      .filter((i) => i.category === key)
      .map((i) => ({
        id: i.documentId,
        name: i.name,
        description: i.description ?? undefined,
        price: i.price,
        priceFrom: i.priceFrom ?? false,
        badge: i.badge ?? undefined,
      })),
  })).filter((c) => c.items.length > 0);

  const ctaLabel = base.packages[0]?.ctaLabel ?? 'Ambil Paket';
  const packages: PricePackage[] = items
    .filter((i) => i.category === 'Paket')
    .map((i) => ({
      id: i.documentId,
      name: i.name,
      tag: i.badge ?? 'Paket',
      price: i.price,
      // Di CMS, isi paket ditulis satu per baris pada field "description"
      features: splitList(i.description, /\r?\n/),
      featured: i.badge === 'Best Seller',
      badge: i.badge ?? undefined,
      ctaLabel,
    }));

  return { ...base, categories, packages };
}

/* ---------- Barber ---------- */

const BARBER_SIZES = '(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 80vw';

export function mapBarbers(items: CmsBarber[], base: BarbersContent): BarbersContent {
  const barbers: Barber[] = items
    .filter((b): b is CmsBarber & { photo: StrapiMedia } => Boolean(b.photo))
    .map((b) => ({
      id: b.documentId,
      name: b.name,
      role: b.role ?? undefined,
      specialties: splitList(b.specialty, /[,\n]/),
      photo: mapImage(b.photo, b.role ? `Foto ${b.name}, ${b.role}` : `Foto ${b.name}`, BARBER_SIZES),
      instagram: b.instagram ?? undefined,
      whatsappNumber: b.whatsappNumber ?? undefined,
    }));
  return { ...base, items: barbers };
}

/* ---------- Galeri ---------- */

const GALLERY_SIZES = '(min-width: 1024px) 50vw, 100vw';

/** Layout grid ditentukan otomatis dari rasio foto, pemilik tidak perlu mengatur. */
function layoutFromRatio(width?: number | null, height?: number | null): GalleryLayout {
  if (!width || !height) return 'square';
  const ratio = width / height;
  if (ratio >= 1.35) return 'wide';
  if (ratio <= 0.8) return 'tall';
  return 'square';
}

export function mapGallery(items: CmsGalleryItem[], base: GalleryContent): GalleryContent {
  const gallery: GalleryItem[] = items
    .filter((g): g is CmsGalleryItem & { image: StrapiMedia } => Boolean(g.image))
    .map((g) => ({
      id: g.documentId,
      image: mapImage({ ...g.image, alternativeText: g.altText }, g.altText, GALLERY_SIZES),
      fullSrc: mediaUrl(g.image.formats?.large?.url ?? g.image.url),
      caption: g.caption ?? undefined,
      layout: layoutFromRatio(g.image.width, g.image.height),
      styleCategory: g.styleCategory ?? undefined,
    }));
  return { ...base, items: gallery };
}

/* ---------- Pengaturan Situs ---------- */

const DAY_INDEX: Record<CmsDay, OpeningHour['day']> = {
  Minggu: 0, Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5, Sabtu: 6,
};

/** "10:00:00.000" → "10:00" */
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : undefined);

export function mapOpeningHours(hours: CmsOpeningHour[] | null | undefined): OpeningHour[] {
  return (hours ?? []).map((h) => ({
    day: DAY_INDEX[h.day],
    label: h.day,
    open: hhmm(h.openTime),
    close: hhmm(h.closeTime),
    closed: Boolean(h.isClosed) || !h.openTime || !h.closeTime,
  }));
}

/** Ringkas jam buka untuk footer: hari berurutan dengan jam sama digabung ("Senin – Kamis"). */
export function summarizeHours(hours: OpeningHour[], closedLabel: string): SiteContent['footer']['hoursSummary'] {
  const value = (h: OpeningHour) => (h.closed || !h.open || !h.close ? closedLabel : `${formatTime(h.open)} – ${formatTime(h.close)}`);
  const groups: { first: string; last: string; value: string }[] = [];
  hours.forEach((h) => {
    const v = value(h);
    const prev = groups[groups.length - 1];
    if (prev && prev.value === v) prev.last = h.label;
    else groups.push({ first: h.label, last: h.label, value: v });
  });
  return groups.map((g) => ({ label: g.first === g.last ? g.first : `${g.first} – ${g.last}`, value: g.value }));
}

export function mapSite(s: CmsSiteSettings | null, base: SiteContent, closedLabel: string): SiteContent {
  if (!s) return base;
  const number = s.mainWhatsappNumber || base.whatsapp.number;
  const hours = mapOpeningHours(s.openingHours);

  return {
    ...base,
    brandName: s.siteName || base.brandName,
    // Logo CMS dipakai untuk logo footer (versi tumpuk). Varian navbar & preloader tetap dari aset statis.
    logo: s.logo ? { ...base.logo, stacked: mapImage(s.logo, s.siteName || base.brandName) } : base.logo,
    whatsapp: {
      ...base.whatsapp,
      number,
      displayNumber: formatPhoneDisplay(number),
      templates: { ...base.whatsapp.templates, general: s.defaultWaMessage?.trim() || base.whatsapp.templates.general },
    },
    address: s.address?.trim() || base.address,
    footer: {
      ...base.footer,
      description: s.footerText?.trim() || base.footer.description,
      hoursSummary: hours.length > 0 ? summarizeHours(hours, closedLabel) : base.footer.hoursSummary,
    },
  };
}

/** Instagram "https://instagram.com/cutless/" → "@cutless" */
function handleFromUrl(url: string): string | undefined {
  const segment = url.replace(/[?#].*$/, '').split('/').filter(Boolean).pop();
  if (!segment || segment.includes('.')) return undefined;
  return segment.startsWith('@') ? segment : `@${segment}`;
}

/** URL sosial media dari CMS. Field yang dikosongkan pemilik → tautannya disembunyikan. */
export function mapSocials(s: CmsSiteSettings | null, base: SocialLink[]): SocialLink[] {
  if (!s) return base;
  const urls: Partial<Record<SocialLink['platform'], string | null>> = {
    instagram: s.instagramUrl,
    tiktok: s.tiktokUrl,
    google: s.googleMapsUrl,
  };
  return base.flatMap((link) => {
    if (!(link.platform in urls)) return [link];
    const url = urls[link.platform]?.trim();
    if (!url) return [];
    const handle = link.platform === 'google' ? link.handle : (handleFromUrl(url) ?? link.handle);
    return [{ ...link, url, handle }];
  });
}

/** Cabang utama mengambil alamat, nomor, jam buka, dan link Maps dari Site Settings. */
export function mapLocations(s: CmsSiteSettings | null, base: LocationsContent): LocationsContent {
  if (!s || base.items.length === 0) return base;
  const [primary, ...others] = base.items;
  const hours = mapOpeningHours(s.openingHours);
  return {
    ...base,
    items: [
      {
        ...primary,
        address: s.address?.trim() ? { ...primary.address, formatted: s.address.trim() } : primary.address,
        phoneDisplay: s.mainWhatsappNumber ? formatPhoneDisplay(s.mainWhatsappNumber) : primary.phoneDisplay,
        whatsappNumber: s.mainWhatsappNumber || primary.whatsappNumber,
        hours: hours.length > 0 ? hours : primary.hours,
        map: s.googleMapsUrl?.trim() ? { ...primary.map, directionsUrl: s.googleMapsUrl.trim() } : primary.map,
      },
      ...others,
    ],
  };
}

/* ---------- Promo & Pengumuman ---------- */

const PROMO_SIZES = '(min-width: 1024px) 40vw, 100vw';

export function mapPromos(items: CmsPromo[], base: PromoContent, now = Date.now()): PromoContent {
  return {
    ...base,
    items: items
      .filter((p) => p.isActive && isWithinRange(p.startDate, p.endDate, now))
      .map((p) => ({
        id: p.documentId,
        title: p.title,
        description: p.description ?? undefined,
        image: p.image ? mapImage(p.image, p.title, PROMO_SIZES) : undefined,
        ctaLabel: p.ctaLabel?.trim() || base.labels.badge,
        waMessage: p.waMessage?.trim() || undefined,
        startDate: p.startDate,
        endDate: p.endDate,
      })),
  };
}

export function mapAnnouncements(items: CmsAnnouncement[], now = Date.now()): Announcement[] {
  return items
    .filter((a) => a.isActive && isWithinRange(a.startDate, a.endDate, now))
    .map((a) => ({
      id: a.documentId,
      message: a.message,
      type: a.type,
      startDate: a.startDate ?? undefined,
      endDate: a.endDate ?? undefined,
      updatedAt: a.updatedAt,
    }));
}

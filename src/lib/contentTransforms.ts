/**
 * Transformasi data JSON Pages CMS → tipe frontend (src/types).
 * Data sudah divalidasi Zod saat build, jadi di sini cukup menyaring (isActive), mengurutkan (order),
 * dan menggabungkan dengan teks statis.
 */
import imageMeta from 'virtual:image-meta';
import type {
  Announcement,
  Barber,
  BarbersContent,
  BarbersCopy,
  GalleryContent,
  GalleryCopy,
  GalleryLayout,
  ImageAsset,
  LocationsContent,
  OpeningHour,
  PriceBadge,
  PriceCategory,
  PriceCategoryKey,
  PricePackage,
  PricingContent,
  PricingCopy,
  PromoContent,
  PromoCopy,
  SiteContent,
  SocialLink,
} from '@/types';
import type {
  AnnouncementEntry,
  BarberEntry,
  GalleryEntry,
  OpeningHourEntry,
  PricingEntry,
  PromoEntry,
  SettingsEntry,
} from '@/content/schema';
import { formatTime } from './format';
import { isActiveNow, toIsoWIB } from './dates';

/* ---------- Helper umum ---------- */

/** Kosong ("" / null / undefined) → undefined */
const text = (value: string | null | undefined): string | undefined => {
  const v = value?.trim();
  return v ? v : undefined;
};

/** Entri tampil bila isActive tidak false, urut berdasarkan `order` (lalu urutan di file). */
function activeSorted<T extends { isActive?: boolean | null; order?: number | null }>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.isActive !== false)
    .sort((a, b) => (a.item.order ?? 0) - (b.item.order ?? 0) || a.index - b.index)
    .map(({ item }) => item);
}

/** Path gambar → ImageAsset dengan ukuran asli (dari virtual:image-meta) */
export function toImage(src: string, alt: string, fallback = { width: 800, height: 800 }): ImageAsset {
  const size = imageMeta[src] ?? fallback;
  return { src, alt, width: size.width, height: size.height };
}

/** Stabil & unik untuk key React: slug + index */
const makeId = (value: string, index: number) =>
  `${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'}-${index}`;

/** "6281234567890" → "0812-3456-7890" */
export function formatPhoneDisplay(number: string): string {
  const digits = number.replace(/\D/g, '');
  const local = digits.startsWith('62') ? `0${digits.slice(2)}` : digits;
  return [local.slice(0, 4), local.slice(4, 8), local.slice(8)].filter(Boolean).join('-');
}

/** Teks multi-baris/berkoma → array bersih */
function splitList(value: string | null | undefined, separator: RegExp): string[] {
  return (value ?? '')
    .split(separator)
    .map((s) => s.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

/* ---------- Daftar Harga ---------- */

const CATEGORY_ORDER: Exclude<PriceCategoryKey, 'Paket'>[] = ['Haircut', 'Kids', 'Shaving', 'Coloring', 'Treatment'];
const badgeOf = (b: PricingEntry['badge']): PriceBadge | undefined => (b ? b : undefined);

export function buildPricing(entries: PricingEntry[], copy: PricingCopy): PricingContent {
  const items = activeSorted(entries);

  const categories: PriceCategory[] = CATEGORY_ORDER.map((key) => ({
    id: key,
    name: copy.categoryLabels[key],
    items: items
      .filter((i) => i.category === key)
      .map((i, index) => ({
        id: makeId(i.name, index),
        name: i.name,
        description: text(i.description),
        price: i.price,
        priceFrom: Boolean(i.priceFrom),
        badge: badgeOf(i.badge),
      })),
  })).filter((c) => c.items.length > 0);

  const packages: PricePackage[] = items
    .filter((i) => i.category === 'Paket')
    .map((i, index) => ({
      id: makeId(i.name, index),
      name: i.name,
      tag: badgeOf(i.badge) ?? copy.packageDefaultTag,
      price: i.price,
      // Isi paket ditulis satu baris per poin di "Keterangan"
      features: splitList(i.description, /\r?\n/),
      featured: i.badge === 'Best Seller',
      badge: badgeOf(i.badge),
      ctaLabel: copy.packageCtaLabel,
    }));

  return { heading: copy.heading, categories, packagesTitle: copy.packagesTitle, packages };
}

/* ---------- Barber ---------- */

export function buildBarbers(entries: BarberEntry[], copy: BarbersCopy): BarbersContent {
  const items: Barber[] = activeSorted(entries).map((b, index) => {
    const role = text(b.role);
    return {
      id: makeId(b.name, index),
      name: b.name,
      role,
      specialties: splitList(b.specialty, /[,\n]/),
      photo: toImage(b.photo, role ? `Foto ${b.name}, ${role}` : `Foto ${b.name}`, { width: 600, height: 800 }),
      instagram: text(b.instagram),
      whatsappNumber: text(b.whatsappNumber),
    };
  });
  return { ...copy, items };
}

/* ---------- Galeri ---------- */

/** Layout grid otomatis dari rasio foto: tegak → tinggi, lebar → lebar */
function layoutFromRatio(width: number, height: number): GalleryLayout {
  const ratio = width / height;
  if (ratio >= 1.35) return 'wide';
  if (ratio <= 0.8) return 'tall';
  return 'square';
}

export function buildGallery(entries: GalleryEntry[], copy: GalleryCopy): GalleryContent {
  const items = activeSorted(entries).map((g, index) => {
    const image = toImage(g.image, g.altText);
    return {
      id: makeId(g.altText, index),
      image,
      caption: text(g.caption),
      layout: layoutFromRatio(image.width, image.height),
      styleCategory: g.styleCategory,
    };
  });
  return { ...copy, items };
}

/* ---------- Pengaturan Situs ---------- */

const DAY_INDEX: Record<OpeningHourEntry['day'], OpeningHour['day']> = {
  Minggu: 0, Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5, Sabtu: 6,
};

export function toOpeningHours(hours: OpeningHourEntry[]): OpeningHour[] {
  return hours.map((h) => ({
    day: DAY_INDEX[h.day],
    label: h.day,
    open: text(h.openTime),
    close: text(h.closeTime),
    closed: Boolean(h.isClosed) || !h.openTime || !h.closeTime,
  }));
}

/** Ringkas jam buka untuk footer: hari berurutan dengan jam sama digabung ("Senin – Kamis") */
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

export function buildSite(s: SettingsEntry, base: SiteContent, closedLabel: string): SiteContent {
  const hours = toOpeningHours(s.openingHours ?? []);
  const logo = text(s.logo);
  return {
    ...base,
    brandName: s.siteName,
    // Logo dari CMS dipakai di footer (versi tumpuk). Logo navbar & preloader tetap aset statis.
    logo: logo ? { ...base.logo, stacked: toImage(logo, s.siteName, base.logo.stacked) } : base.logo,
    whatsapp: {
      ...base.whatsapp,
      number: s.mainWhatsappNumber,
      displayNumber: formatPhoneDisplay(s.mainWhatsappNumber),
      templates: { ...base.whatsapp.templates, general: text(s.defaultWaMessage) ?? base.whatsapp.templates.general },
    },
    address: text(s.address) ?? base.address,
    footer: {
      ...base.footer,
      description: text(s.footerText) ?? base.footer.description,
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

/** URL sosial media dari settings. Field yang dikosongkan admin → ikonnya disembunyikan. */
export function buildSocials(s: SettingsEntry, base: SocialLink[]): SocialLink[] {
  const urls: Partial<Record<SocialLink['platform'], string | null | undefined>> = {
    instagram: s.instagramUrl,
    tiktok: s.tiktokUrl,
    google: s.googleMapsUrl,
  };
  return base.flatMap((link) => {
    if (!(link.platform in urls)) return [link];
    const url = text(urls[link.platform]);
    if (!url) return [];
    const handle = link.platform === 'google' ? link.handle : (handleFromUrl(url) ?? link.handle);
    return [{ ...link, url, handle }];
  });
}

/** Cabang utama mengambil alamat, nomor, jam buka, dan link Maps dari settings. */
export function buildLocations(s: SettingsEntry, base: LocationsContent): LocationsContent {
  if (base.items.length === 0) return base;
  const [primary, ...others] = base.items;
  const hours = toOpeningHours(s.openingHours ?? []);
  const address = text(s.address);
  const maps = text(s.googleMapsUrl);
  return {
    ...base,
    items: [
      {
        ...primary,
        address: address ? { ...primary.address, formatted: address } : primary.address,
        phoneDisplay: formatPhoneDisplay(s.mainWhatsappNumber),
        whatsappNumber: s.mainWhatsappNumber,
        hours: hours.length > 0 ? hours : primary.hours,
        map: maps ? { ...primary.map, directionsUrl: maps } : primary.map,
      },
      ...others,
    ],
  };
}

/* ---------- Promo & Pengumuman (filter tanggal di browser, saat halaman dibuka) ---------- */

export function buildPromos(entries: PromoEntry[], copy: PromoCopy, now = Date.now()): PromoContent {
  const items = entries
    .filter((p) => p.isActive !== false && isActiveNow(p.startDate, p.endDate, now))
    .sort((a, b) => Date.parse(toIsoWIB(a.endDate, true)) - Date.parse(toIsoWIB(b.endDate, true)))
    .map((p, index) => {
      const image = text(p.image);
      return {
        id: makeId(p.title, index),
        title: p.title,
        description: text(p.description),
        image: image ? toImage(image, p.title, { width: 1600, height: 1000 }) : undefined,
        ctaLabel: text(p.ctaLabel) ?? copy.labels.badge,
        waMessage: text(p.waMessage),
        startDate: toIsoWIB(p.startDate),
        endDate: toIsoWIB(p.endDate, true),
      };
    });
  return { ...copy, items };
}

export function buildAnnouncements(entries: AnnouncementEntry[], now = Date.now()): Announcement[] {
  return entries
    .filter((a) => a.isActive !== false && isActiveNow(a.startDate, a.endDate, now))
    .map((a, index) => ({
      id: makeId(a.message.slice(0, 40), index),
      message: a.message,
      type: a.type,
      startDate: a.startDate ? toIsoWIB(a.startDate) : undefined,
      endDate: a.endDate ? toIsoWIB(a.endDate, true) : undefined,
      // Kunci "sudah ditutup": isi pesan + tanggal → bila admin mengubah pengumuman, ia tampil lagi
      updatedAt: `${a.type}|${a.message}|${a.startDate ?? ''}|${a.endDate ?? ''}`,
    }));
}

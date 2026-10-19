/**
 * Transformasi data JSON Pages CMS → tipe frontend (src/types).
 * Data sudah divalidasi Zod saat build, jadi di sini cukup menyaring (isActive), mengurutkan (order),
 * menghitung nilai turunan (harga per cabang, statistik), dan menggabungkan dengan teks statis.
 */
import imageMeta from 'virtual:image-meta';
import type {
  AboutContent,
  AboutCopy,
  AboutSlide,
  AboutStat,
  Announcement,
  Barber,
  BarbersContent,
  BarbersCopy,
  Branch,
  BranchCopy,
  GalleryContent,
  GalleryCopy,
  GalleryLayout,
  HeroContent,
  HeroExtras,
  ImageAsset,
  LocationsContent,
  OpeningHour,
  PriceBadge,
  PriceCategory,
  PriceCategoryKey,
  PricePackage,
  PricingContent,
  PricingCopy,
  Product,
  ProductCategory,
  ProductsContent,
  ProductsCopy,
  PromoContent,
  PromoCopy,
  Rating,
  ServicesContent,
  ShowcaseContent,
  ShowcaseCopy,
  SiteContent,
  SocialLink,
  Testimonial,
  TestimonialsContent,
  TestimonialsCopy,
} from '@/types';
import type {
  AboutEntry,
  AnnouncementEntry,
  BarberEntry,
  BranchEntry,
  GalleryEntry,
  HeroEntry,
  OpeningHourEntry,
  PricingEntry,
  ProductEntry,
  PromoEntry,
  SettingsEntry,
  StudioEntry,
  TestimonialEntry,
} from '@/content/schema';
import { srcSetOf } from './responsiveImage';
import { formatNumber } from './format';
import { isActiveNow, parseWIB, toIsoWIB } from './dates';
import { fillTemplate } from './whatsapp';

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
  // File asli (jpg/png) yang sudah dikonversi workflow → pakai versi .webp-nya
  const webp = src.replace(/\.(jpe?g|png|gif|tiff?|avif)$/i, '.webp');
  const resolved = imageMeta[src] ? src : imageMeta[webp] ? webp : src;
  const size = imageMeta[resolved] ?? fallback;
  return { src: resolved, alt, width: size.width, height: size.height };
}

/** Seperti toImage + srcset otomatis dari versi kecil (mis. foto-600.webp) bila ada */
export function responsiveImage(src: string, alt: string, sizes: string, fallback?: { width: number; height: number }): ImageAsset {
  const image = toImage(src, alt, fallback);
  const srcSet = srcSetOf(image.src, imageMeta);
  return srcSet ? { ...image, srcSet, sizes } : image;
}

/* ---------- Hero (Pages CMS → Hero) ---------- */

export function buildHero(h: HeroEntry, extras: HeroExtras): HeroContent {
  const image = responsiveImage(h.image, h.imageAlt, '100vw', { width: 1920, height: 1000 });
  const mobile = text(h.mobileImage);
  return {
    kicker: h.kicker,
    titleLines: h.titleLines,
    subtitle: h.subtitle,
    image: mobile ? { ...image, mobileSrc: toImage(mobile, h.imageAlt).src } : image,
    video: extras.video,
    // Tombol utama selalu WhatsApp cabang terpilih (label dari CMS, mis. "Booking via WhatsApp")
    primaryCta: { label: h.primaryCtaLabel, action: { type: 'whatsapp' } },
    secondaryCta: { label: h.secondaryCtaLabel, action: { type: 'link', href: extras.secondaryHref } },
    marquee: h.marquee,
    scrollHint: extras.scrollHint,
  };
}

/* ---------- Kartu studio (Pages CMS → Kartu Studio) ---------- */

/** Foto dari CMS; kosong → foto cabang pertama; belum ada → fallbackImage */
export function buildShowcase(s: StudioEntry, copy: ShowcaseCopy, branchPhoto: ImageAsset | undefined): ShowcaseContent {
  const image = text(s.image);
  return {
    heading: copy.heading,
    taglines: s.taglines,
    image: image ? toImage(image, text(s.imageAlt) ?? copy.heading, { width: 1200, height: 800 }) : (branchPhoto ?? copy.fallbackImage),
  };
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

/** ["Bogor", "Cibubur", "Bandung"] → "Bogor, Cibubur & Bandung" */
export function joinIndonesian(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`;
}

const isBranchEntryBookable = (b: Pick<BranchEntry, 'status' | 'whatsappNumber'>) =>
  b.status === 'Aktif' && /^62\d{8,13}$/.test(b.whatsappNumber);

/* ---------- Cabang ---------- */

const DAY_INDEX: Record<OpeningHourEntry['day'], OpeningHour['day']> = {
  Minggu: 0, Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5, Sabtu: 6,
};
const DAY_ORDER: OpeningHour['day'][] = [1, 2, 3, 4, 5, 6, 0];

export function toOpeningHours(hours: OpeningHourEntry[]): OpeningHour[] {
  return hours
    .map((h) => ({
      day: DAY_INDEX[h.day],
      label: h.day,
      open: text(h.openTime),
      close: text(h.closeTime),
      closed: Boolean(h.isClosed) || !h.openTime || !h.closeTime,
    }))
    .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
}

export function buildBranches(entries: BranchEntry[], brand: string): Branch[] {
  return entries
    .map((b, index) => ({ b, index }))
    .sort((x, y) => (x.b.order ?? 0) - (y.b.order ?? 0) || x.index - y.index)
    .map(({ b }) => {
      const address = text(b.address);
      const hasGeo = b.latitude !== null && b.longitude !== null && b.latitude !== undefined && b.longitude !== undefined;
      const place = hasGeo ? `${b.latitude},${b.longitude}` : `${brand} ${b.name}, ${address ?? `${b.city}, ${b.province}`}`;
      const photo = text(b.photo);
      return {
        slug: b.slug,
        name: b.name,
        city: b.city,
        province: b.province,
        address,
        googleMapsUrl: text(b.googleMapsUrl),
        latitude: hasGeo ? (b.latitude as number) : undefined,
        longitude: hasGeo ? (b.longitude as number) : undefined,
        whatsappNumber: b.whatsappNumber,
        phoneDisplay: /^62\d+$/.test(b.whatsappNumber) ? formatPhoneDisplay(b.whatsappNumber) : '',
        timezone: b.timezone,
        hours: toOpeningHours(b.openingHours ?? []),
        status: b.status,
        photo: photo ? toImage(photo, `Studio ${brand} cabang ${b.name}`, { width: 1600, height: 1000 }) : undefined,
        order: b.order ?? 0,
        bookable: isBranchEntryBookable(b),
        pageUrl: `/cabang/${b.slug}/`,
        mapEmbedUrl: `https://www.google.com/maps?q=${encodeURIComponent(place)}&z=16&output=embed`,
        directionsUrl:
          text(b.googleMapsUrl) ?? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}`,
      };
    });
}

/** Kota unik dari cabang yang sudah beroperasi (bukan "Segera Dibuka"), mis. "Bogor & Cibubur" */
export function operatingCities(branches: Branch[]): string[] {
  const operating = branches.filter((b) => b.status !== 'Segera Dibuka');
  return [...new Set((operating.length ? operating : branches).map((b) => b.city))];
}

export function buildLocations(branches: Branch[], copy: BranchCopy): LocationsContent {
  return { heading: copy.heading, labels: copy.labels, items: branches };
}

/* ---------- Pengaturan situs ---------- */

export function buildSite(s: SettingsEntry, base: SiteContent, branches: Branch[]): SiteContent {
  const logo = text(s.logo);
  const vars = { brand: s.siteName, cities: joinIndonesian(operatingCities(branches)) };
  const features = { testimonials: s.showTestimonials, products: s.showProducts, beforeAfter: s.showBeforeAfter };
  return {
    ...base,
    brandName: s.siteName,
    siteUrl: s.siteUrl,
    features,
    intro: { enabled: s.enablePreloader !== false, video: text(s.preloaderVideo) },
    // Link menu ikut hilang bila section-nya dimatikan
    nav: base.nav.filter((item) => !(item.href?.startsWith('/produk') && !features.products)),
    logo: logo ? { ...base.logo, stacked: toImage(logo, s.siteName, base.logo.stacked) } : base.logo,
    whatsapp: {
      ...base.whatsapp,
      number: s.mainWhatsappNumber,
      displayNumber: formatPhoneDisplay(s.mainWhatsappNumber),
      templates: { ...base.whatsapp.templates, general: text(s.defaultWaMessage) ?? base.whatsapp.templates.general },
    },
    seo: {
      ...base.seo,
      title: fillTemplate(base.seo.title, vars),
      description: fillTemplate(base.seo.description, vars),
      url: `${s.siteUrl}/`,
    },
    footer: { ...base.footer, description: text(s.footerText) ?? base.footer.description },
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
  };
  return base.flatMap((link) => {
    if (!(link.platform in urls)) return [link];
    const url = text(urls[link.platform]);
    if (!url) return [];
    return [{ ...link, url, handle: handleFromUrl(url) ?? link.handle }];
  });
}

/* ---------- Harga (dengan harga khusus cabang) ---------- */

const CATEGORY_ORDER: Exclude<PriceCategoryKey, 'Paket'>[] = ['Haircut', 'Kids', 'Shaving', 'Coloring', 'Treatment'];
const badgeOf = (b: PricingEntry['badge']): PriceBadge | undefined => (b ? b : undefined);

/**
 * Harga efektif sebuah item:
 * - cabang dipilih → harga khusus cabang itu, atau harga dasar;
 * - belum memilih  → harga terendah dari harga dasar & semua harga cabang (varies = ada perbedaan).
 */
export function effectivePrice(item: PricingEntry, branchSlug?: string): { price: number; varies: boolean } {
  const branchPrices = item.branchPrices ?? [];
  if (branchSlug) return { price: branchPrices.find((p) => p.branchSlug === branchSlug)?.price ?? item.price, varies: false };
  const all = [item.price, ...branchPrices.map((p) => p.price)];
  return { price: Math.min(...all), varies: new Set(all).size > 1 };
}

export function buildPricing(entries: PricingEntry[], copy: PricingCopy, branches: Branch[], branchSlug?: string): PricingContent {
  const items = activeSorted(entries);
  const branch = branches.find((b) => b.slug === branchSlug);

  const categories: PriceCategory[] = CATEGORY_ORDER.map((key) => ({
    id: key,
    name: copy.categoryLabels[key],
    items: items
      .filter((i) => i.category === key)
      .map((i, index) => {
        const { price, varies } = effectivePrice(i, branch?.slug);
        return {
          id: makeId(i.name, index),
          name: i.name,
          description: text(i.description),
          price,
          priceFrom: Boolean(i.priceFrom) || varies,
          varies,
          badge: badgeOf(i.badge),
        };
      }),
  })).filter((c) => c.items.length > 0);

  const packages: PricePackage[] = items
    .filter((i) => i.category === 'Paket')
    .map((i, index) => ({
      id: makeId(i.name, index),
      name: i.name,
      tag: badgeOf(i.badge) ?? copy.packageDefaultTag,
      price: effectivePrice(i, branch?.slug).price,
      features: splitList(i.description, /\r?\n/),
      featured: i.badge === 'Best Seller',
      badge: badgeOf(i.badge),
      ctaLabel: copy.packageCtaLabel,
    }));

  return {
    heading: copy.heading,
    branchSlug: branch?.slug,
    branchName: branch?.name,
    hasBranchPrices: items.some((i) => (i.branchPrices ?? []).length > 0),
    categories,
    packagesTitle: copy.packagesTitle,
    packages,
  };
}

/** Harga "mulai" per kategori: harga efektif terendah item aktif (untuk cabang, atau semua cabang) */
export function startingPrices(entries: PricingEntry[], branchSlug?: string): Partial<Record<PriceCategoryKey, number>> {
  const result: Partial<Record<PriceCategoryKey, number>> = {};
  for (const item of activeSorted(entries)) {
    const { price } = effectivePrice(item, branchSlug);
    const current = result[item.category];
    result[item.category] = current === undefined ? price : Math.min(current, price);
  }
  return result;
}

export function buildServices(base: ServicesContent, pricing: PricingEntry[], branchSlug?: string): ServicesContent {
  const prices = startingPrices(pricing, branchSlug);
  return {
    ...base,
    items: base.items.map((s) => ({ ...s, startingPrice: s.pricingCategory ? prices[s.pricingCategory] : undefined })),
  };
}

/* ---------- Barber ---------- */

export function buildBarbers(entries: BarberEntry[], copy: BarbersCopy, branches: Branch[], branchSlug?: string): BarbersContent {
  const branchName = new Map(branches.map((b) => [b.slug, b.name]));
  const items: Barber[] = activeSorted(entries)
    .filter((b) => !branchSlug || b.branchSlug === branchSlug)
    .map((b, index) => {
      const role = text(b.role);
      return {
        id: makeId(b.name, index),
        name: b.name,
        role,
        specialties: splitList(b.specialty, /[,\n]/),
        photo: toImage(b.photo, role ? `Foto ${b.name}, ${role}` : `Foto ${b.name}`, { width: 600, height: 800 }),
        instagram: text(b.instagram),
        whatsappNumber: text(b.whatsappNumber),
        branchSlug: b.branchSlug,
        branchName: branchName.get(b.branchSlug) ?? b.branchSlug,
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

export function buildGallery(entries: GalleryEntry[], copy: GalleryCopy, showBeforeAfter: boolean): GalleryContent {
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
  return { ...copy, beforeAfter: showBeforeAfter ? copy.beforeAfter : [], items };
}

/* ---------- Promo & Pengumuman (filter tanggal di browser, saat halaman dibuka) ---------- */

const appliesTo = (slugs: string[] | null | undefined, branchSlug?: string) =>
  !branchSlug || !slugs || slugs.length === 0 || slugs.includes(branchSlug);

export function buildPromos(entries: PromoEntry[], copy: PromoCopy, branches: Branch[], branchSlug?: string, now = Date.now()): PromoContent {
  const names = new Map(branches.map((b) => [b.slug, b.name]));
  const items = entries
    .filter((p) => p.isActive !== false && isActiveNow(p.startDate, p.endDate, now) && appliesTo(p.branchSlugs, branchSlug))
    .sort((a, b) => parseWIB(a.endDate, true) - parseWIB(b.endDate, true))
    .map((p, index) => {
      const image = text(p.image);
      const slugs = p.branchSlugs ?? [];
      return {
        id: makeId(p.title, index),
        title: p.title,
        description: text(p.description),
        image: image ? toImage(image, p.title, { width: 1600, height: 1000 }) : undefined,
        ctaLabel: text(p.ctaLabel) ?? copy.labels.badge,
        waMessage: text(p.waMessage),
        startDate: toIsoWIB(p.startDate),
        endDate: toIsoWIB(p.endDate, true),
        branchSlugs: slugs,
        branchNames: slugs.map((s) => names.get(s) ?? s),
      };
    });
  return { ...copy, items };
}

export function buildAnnouncements(entries: AnnouncementEntry[], branches: Branch[], branchSlug?: string, now = Date.now()): Announcement[] {
  const names = new Map(branches.map((b) => [b.slug, b.name]));
  return entries
    .filter((a) => a.isActive !== false && isActiveNow(a.startDate, a.endDate, now) && appliesTo(a.branchSlugs, branchSlug))
    .map((a, index) => {
      const slugs = a.branchSlugs ?? [];
      return {
        id: makeId(a.message.slice(0, 40), index),
        message: a.message,
        type: a.type,
        startDate: a.startDate ? toIsoWIB(a.startDate) : undefined,
        endDate: a.endDate ? toIsoWIB(a.endDate, true) : undefined,
        // Kunci "sudah ditutup": isi pesan + tanggal → bila admin mengubah pengumuman, ia tampil lagi
        updatedAt: `${a.type}|${a.message}|${a.startDate ?? ''}|${a.endDate ?? ''}|${slugs.join(',')}`,
        branchSlugs: slugs,
        branchNames: slugs.map((s) => names.get(s) ?? s),
      };
    });
}

/* ---------- Testimoni ---------- */

const AVATAR_COLORS = ['#7a6756', '#5b554f', '#8a7a6b', '#44403a', '#63626a'];

function relativeTime(date: string | null | undefined, now = Date.now()): string | undefined {
  if (!date) return undefined;
  const days = Math.max(0, Math.floor((now - parseWIB(date)) / 86_400_000));
  if (days < 1) return 'hari ini';
  if (days < 7) return `${days} hari lalu`;
  if (days < 30) return `${Math.floor(days / 7)} minggu lalu`;
  if (days < 365) return `${Math.floor(days / 30)} bulan lalu`;
  return `${Math.floor(days / 365)} tahun lalu`;
}

export function buildTestimonials(entries: TestimonialEntry[], copy: TestimonialsCopy, s: SettingsEntry): TestimonialsContent {
  const stats = s.stats;
  const items: Testimonial[] = activeSorted(entries).map((t, index) => ({
    id: makeId(t.author, index),
    author: t.author,
    avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
    relativeTime: relativeTime(t.date),
    rating: t.rating as Rating,
    text: t.text,
    source: t.source,
  }));
  return {
    heading: copy.heading,
    summary: {
      rating: stats.showRating && stats.rating ? stats.rating : undefined,
      ratingDisplay: stats.showRating && stats.rating ? stats.rating.toLocaleString('id-ID', { maximumFractionDigits: 1 }) : undefined,
      reviewCountLabel:
        stats.showReviewCount && stats.reviewCount ? fillTemplate(copy.reviewCountLabel, { count: formatNumber(stats.reviewCount) }) : undefined,
      url: text(stats.reviewsUrl),
      ctaLabel: copy.ctaLabel,
    },
    items,
  };
}

/* ---------- Tentang: angka statistik ---------- */

const FOCUS: Record<string, AboutSlide['focus']> = { atas: 'top', tengah: 'center', bawah: 'bottom' };
/** Bingkai foto Tentang: lebar penuh di HP, ±7/12 kolom di tablet/desktop */
const ABOUT_SIZES = '(min-width: 1280px) 700px, (min-width: 768px) 58vw, 100vw';

export function buildAbout(a: AboutEntry, copy: AboutCopy, s: SettingsEntry, branches: Branch[], barbers: BarberEntry[]): AboutContent {
  const stats = s.stats;
  const activeBranches = branches.filter((b) => b.status === 'Aktif');
  const activeSlugs = new Set(activeBranches.map((b) => b.slug));
  const activeBarbers = barbers.filter((b) => b.isActive !== false && activeSlugs.has(b.branchSlug));
  const L = copy.statLabels;

  const list: AboutStat[] = [];
  if (activeBranches.length > 0) list.push({ value: activeBranches.length, animate: true, label: L.branches });
  if (activeBarbers.length > 0) list.push({ value: activeBarbers.length, animate: true, label: L.barbers });
  if (stats.showCustomers && stats.customers) list.push({ value: stats.customers, suffix: '+', animate: true, label: L.customers });
  if (stats.showFoundedYear && stats.foundedYear) list.push({ value: stats.foundedYear, display: String(stats.foundedYear), label: L.foundedYear });
  if (stats.showRating && stats.rating)
    list.push({ value: stats.rating, display: stats.rating.toLocaleString('id-ID', { maximumFractionDigits: 1 }), animate: true, label: L.rating });
  if (stats.showReviewCount && stats.reviewCount) list.push({ value: stats.reviewCount, suffix: '+', animate: true, label: L.reviewCount });

  const [lead, ...body] = a.paragraphs;
  return {
    heading: { kicker: a.kicker, title: a.title },
    lead,
    body,
    slides: a.images.map((img) => ({
      image: responsiveImage(img.src, img.alt, ABOUT_SIZES, { width: 960, height: 1200 }),
      focus: FOCUS[img.focalPoint ?? 'tengah'] ?? 'center',
    })),
    slideInterval: a.slideInterval,
    transition: a.transition,
    imageCaption: text(a.caption) ?? '',
    values: a.values,
    stats: list,
  };
}

/* ---------- Produk ---------- */

const PRODUCT_CATEGORY_ORDER: ProductCategory[] = [
  'Pomade', 'Hair Clay', 'Hair Powder', 'Hair Tonic', 'Hair Spray', 'Shampoo & Conditioner', 'Beard Care', 'Aksesoris', 'Lainnya',
];

export function buildProducts(entries: ProductEntry[], copy: ProductsCopy): ProductsContent {
  const items: Product[] = activeSorted(entries).map((p, index) => {
    const image = text(p.image);
    return {
      id: makeId(p.name, index),
      name: p.name,
      category: p.category,
      price: p.price,
      compareAtPrice: p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice : undefined,
      size: text(p.size),
      description: text(p.description),
      image: image ? toImage(image, p.size ? `${p.name} ${p.size}` : p.name, { width: 1000, height: 1000 }) : undefined,
      badge: badgeOf(p.badge),
      inStock: p.inStock !== false,
      shopeeUrl: text(p.shopeeUrl),
      tokopediaUrl: text(p.tokopediaUrl),
    };
  });
  // Kategori di luar daftar baku tetap bisa difilter (di akhir)
  const extra = [...new Set(items.map((i) => i.category))].filter((c) => !PRODUCT_CATEGORY_ORDER.includes(c));
  const categories = [...PRODUCT_CATEGORY_ORDER.filter((c) => items.some((i) => i.category === c)), ...extra];
  return { ...copy, categories, items };
}

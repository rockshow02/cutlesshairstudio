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
  CtaBannerContent,
  CtaBannerCopy,
  GalleryContent,
  GalleryCopy,
  GalleryItem,
  GalleryLayout,
  HeroContent,
  HeroExtras,
  ImageAsset,
  LocationsContent,
  OpeningHour,
  PartnerLogosContent,
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
  Service,
  ServicesContent,
  ServicesCopy,
  IconName,
  ShowcaseContent,
  ShowcaseCopy,
  ShoeCareContent,
  FaqContent,
  VideosContent,
  VideosCopy,
  ShoeCareCopy,
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
  CtaEntry,
  GalleryEntry,
  HeroEntry,
  OpeningHourEntry,
  PartnersEntry,
  PricingEntry,
  ProductEntry,
  PromoEntry,
  ServiceCardEntry,
  SettingsEntry,
  ShoeCareEntry,
  FaqEntry,
  VideosEntry,
  StudioEntry,
  TestimonialEntry,
} from '@/content/schema';
import { srcSetOf } from './responsiveImage';
import { PRICE_CATEGORIES, priceCategoryAnchor } from '@/content/priceCategories';
import { availableAt, priceAt, samePricesEverywhere } from '@/content/branchPricing';
import { activeFaqItems } from '@/content/faqSeo';
import { activeVideoItems } from '@/content/instagram';
import { formatNumber, formatPhoneDisplay, formatPriceText } from './format';
import { isActiveNow, parseWIB, toIsoWIB } from './dates';
import { fillTemplate, templateLink } from './whatsapp';

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

/* ---------- Logo Partner (Pages CMS → Logo Partner) ---------- */

/** Logo aktif ≤ ini: deret statis di tengah, tanpa animasi */
export const PARTNER_STATIC_MAX = 2;

/** Pita logo di beranda. null = dimatikan atau belum ada logo aktif → pita tidak dirender (tanpa ruang kosong). */
export function buildPartnerLogos(p: PartnersEntry | null | undefined, brandName: string): PartnerLogosContent | null {
  if (!p || p.enabled === false) return null;
  const items = activeSorted(p.logos ?? []).map((l) => {
    const logo = text(l.logo);
    return {
      name: l.name,
      // Lebar/tinggi asli dari file (cegah layout shift); tinggi tampil diatur CSS
      logo: logo ? toImage(logo, l.name, { width: 400, height: 200 }) : null,
      url: text(l.url) ?? null,
      isDemo: l.isDemo === true,
    };
  });
  if (items.length === 0) return null;
  return {
    label: text(p.label) ?? null,
    ariaLabel: `Partner ${brandName}`,
    items,
    animated: items.length > PARTNER_STATIC_MAX,
  };
}

/* ---------- Partner Cuci Sepatu (Pages CMS → Partner Cuci Sepatu) ---------- */

export const SHOE_CARE_PAGE = '/cuci-sepatu/';

/**
 * Halaman /cuci-sepatu/ & teaser. null = "Tampilkan halaman" mati, cabangnya tidak ada, atau belum ada layanan tampil.
 * Semua tombol WhatsApp ke nomor partner; kosong → nomor WhatsApp cabang partner (bukan cabang pilihan pengunjung).
 * Foto hero: CMS → foto hasil pertama → `fallbackImage` (foto CTA penutup).
 */
export function buildShoeCare(p: ShoeCareEntry | null | undefined, branches: Branch[], copy: ShoeCareCopy, fallbackImage?: ImageAsset): ShoeCareContent | null {
  if (!p || p.enabled !== true) return null;
  const branch = branches.find((b) => b.slug === p.branchSlug);
  const services = activeSorted(p.services ?? []);
  if (!branch || services.length === 0) return null;
  const number = text(p.whatsappNumber) ?? branch.whatsappNumber;
  const template = text(p.messageTemplate) ?? copy.defaultTemplate;
  const link = (service: string) => templateLink(number, template, { partner: p.name, service, branch: branch.name });
  const logo = text(p.logo);
  const heroLogo = text(p.heroLogo);
  const photos = (p.photos ?? []).map((ph) => responsiveImage(ph.image, ph.alt, '(min-width: 1024px) 33vw, (min-width: 600px) 50vw, 100vw', { width: 1200, height: 900 }));
  const hero = text(p.heroImage);
  const aboutImage = text(p.aboutImage);
  const placeholder: ImageAsset = { src: '/images/cta/studio.jpg', alt: p.name, width: 750, height: 423 };
  return {
    pageUrl: SHOE_CARE_PAGE,
    isDemo: p.isDemo === true,
    showTeaser: p.showTeaser !== false,
    name: p.name,
    heroKicker: text(p.heroKicker),
    tagline: text(p.tagline),
    description: text(p.description),
    logo: logo ? toImage(logo, p.name, { width: 240, height: 240 }) : undefined,
    // Ukuran asli dari file (SVG/PNG/WebP) → width/height di <img> → tanpa CLS
    heroLogo: heroLogo ? toImage(heroLogo, p.name, { width: 1200, height: 300 }) : undefined,
    heroImage: hero
      ? responsiveImage(hero, `${p.name}, ${copy.kicker.toLowerCase()}`, '100vw', { width: 1920, height: 1080 })
      : (photos[0] ?? fallbackImage ?? placeholder),
    branch: { slug: branch.slug, name: branch.name, pageUrl: branch.pageUrl },
    about: {
      heading: { kicker: copy.aboutKicker, title: text(p.aboutTitle) ?? fillTemplate(copy.aboutTitleFallback, { partner: p.name }) },
      // Kosong → Deskripsi singkat
      paragraphs: (() => {
        const list = (p.aboutParagraphs ?? []).map((t) => t.trim()).filter(Boolean);
        const fallback = text(p.description);
        return list.length ? list : fallback ? [fallback] : [];
      })(),
      image: aboutImage ? responsiveImage(aboutImage, text(p.aboutImageAlt) ?? p.name, '(min-width: 900px) 40vw, 100vw', { width: 1200, height: 900 }) : undefined,
      imagePlain: Boolean(aboutImage) && p.aboutImagePlain === true,
    },
    advantages: (p.advantages ?? []).map((a) => ({ title: a.title, description: a.description, icon: a.icon ?? 'check' })),
    services: services.map((s) => {
      const image = text(s.image);
      const icon = text(s.icon) as IconName | undefined;
      return {
        name: s.name,
        description: text(s.description),
        price: text(s.price) ? formatPriceText(text(s.price)!) : undefined,
        estimate: text(s.estimate),
        ...(icon ? { icon } : {}),
        ...(image ? { image: responsiveImage(image, s.name, '(min-width: 768px) 33vw, 100vw', { width: 1200, height: 900 }) } : {}),
        href: link(s.name),
      };
    }),
    photos,
    notes: (p.notes ?? []).map((n) => n.trim()).filter(Boolean),
    menuUrl: shoeCareMenuUrl(p),
    mainHref: link(copy.genericService),
    copy,
  };
}

/** Tombol "Lihat Daftar Menu": file PDF → Link Daftar Menu → tidak ada (tombol tidak tampil) */
export function shoeCareMenuUrl(p: Pick<ShoeCareEntry, 'menuFile' | 'menuUrl'>): string | undefined {
  return text(p.menuFile) ?? text(p.menuUrl);
}

/* ---------- FAQ (Pages CMS → FAQ) ---------- */

/** null = Tampilkan FAQ mati atau belum ada item aktif berjawaban (bagian & JSON-LD tidak ada) */
export function buildFaq(f: FaqEntry | null | undefined): FaqContent | null {
  const items = activeFaqItems(f);
  if (!f || !items.length) return null;
  return {
    heading: { kicker: text(f.kicker) ?? '', title: f.title },
    items: items.map((i, index) => ({ id: makeId(i.question, index), question: i.question, answer: i.answer })),
  };
}

/* ---------- Video (Pages CMS → Video) ---------- */

/** null = Tampilkan bagian Video mati atau belum ada video aktif (bagian tidak dirender) */
export function buildVideos(v: VideosEntry | null | undefined, copy: VideosCopy): VideosContent | null {
  const items = activeVideoItems(v);
  if (!v || !items.length) return null;
  return {
    heading: { kicker: text(v.kicker) ?? copy.defaultKicker, title: v.title },
    copy,
    items: items.map((i, index) => ({
      id: makeId(i.url, index),
      url: i.url,
      // Kartu 9:16: HP ±270 px, desktop ±360 px (versi 400 px dari workflow kompres gambar)
      image: responsiveImage(i.image, i.caption ?? fillTemplate(copy.untitled, { n: index + 1 }), '(min-width: 768px) 360px, 270px', { width: 800, height: 1422 }),
      ...(i.caption ? { caption: i.caption } : {}),
    })),
  };
}

/**
 * Tempat section Cuci Sepatu: halaman cabang lain → tidak tampil; beranda dengan cabang pilihan lain → tampil
 * dengan catatan "hanya tersedia di cabang …"; selain itu tampil biasa.
 */
export function shoeCarePlacement(partnerSlug: string, ctx: { pageSlug?: string; selectedSlug?: string }): 'hidden' | 'available' | 'other-branch' {
  if (ctx.pageSlug) return ctx.pageSlug === partnerSlug ? 'available' : 'hidden';
  return ctx.selectedSlug && ctx.selectedSlug !== partnerSlug ? 'other-branch' : 'available';
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

/* ---------- CTA penutup (Pages CMS → CTA Penutup) ---------- */

/** Foto latar dari CMS (srcset 1280/1920 bila ada); kosong → foto cadangan. Tombol selalu WhatsApp cabang terpilih. */
export function buildCtaBanner(c: CtaEntry, copy: CtaBannerCopy): CtaBannerContent {
  const image = text(c.image);
  return {
    kicker: c.kicker,
    title: c.title,
    description: c.description,
    cta: { label: c.ctaLabel, action: { type: 'whatsapp' } },
    backgroundImage: image ? responsiveImage(image, text(c.imageAlt) ?? c.title, '100vw', { width: 1920, height: 1080 }) : copy.fallbackImage,
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

/** Dipindah ke ./format (dipakai juga ringkasan statis saat build) */
export { formatPhoneDisplay } from './format';

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

export function buildSite(s: SettingsEntry, base: SiteContent, branches: Branch[], extra: { shoeCare?: boolean } = {}): SiteContent {
  const logo = text(s.logo);
  const vars = { brand: s.siteName, cities: joinIndonesian(operatingCities(branches)) };
  const features = { testimonials: s.showTestimonials, products: s.showProducts, beforeAfter: s.showBeforeAfter, shoeCare: Boolean(extra.shoeCare), tips: Boolean(s.showTips) };
  return {
    ...base,
    brandName: s.siteName,
    siteUrl: s.siteUrl,
    features,
    intro: { enabled: s.enablePreloader !== false, video: text(s.preloaderVideo) },
    // Link menu ikut hilang bila section-nya dimatikan
    nav: base.nav.filter(
      (item) =>
        !(item.href?.startsWith('/produk') && !features.products) &&
        !(item.href === SHOE_CARE_PAGE && !features.shoeCare) &&
        !(item.href?.startsWith('/tips') && !features.tips),
    ),
    logo: logo ? { ...base.logo, stacked: toImage(logo, s.siteName, base.logo.stacked) } : base.logo,
    whatsapp: {
      ...base.whatsapp,
      number: s.mainWhatsappNumber,
      displayNumber: formatPhoneDisplay(s.mainWhatsappNumber),
      templates: {
        ...base.whatsapp.templates,
        general: text(s.defaultWaMessage) ?? base.whatsapp.templates.general,
        barber: text(s.barberWaMessage) ?? base.whatsapp.templates.barber,
      },
    },
    seo: {
      ...base.seo,
      title: fillTemplate(base.seo.title, vars),
      description: fillTemplate(base.seo.description, vars),
      url: `${s.siteUrl}/`,
    },
    email: text(s.email) ?? '',
    footer: { ...base.footer, description: fillTemplate(text(s.footerTagline) ?? base.footer.description, vars) },
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

/** Urutan kategori di Daftar Harga = urutan enum (Paket tampil terpisah sebagai kartu) */
const CATEGORY_ORDER = PRICE_CATEGORIES.filter((c): c is Exclude<PriceCategoryKey, 'Paket'> => c !== 'Paket');
const badgeOf = (b: PricingEntry['badge']): PriceBadge | undefined => (b ? b : undefined);

/**
 * Daftar Harga satu cabang (harga per cabang menimpa harga utama; item yang tidak "Tersedia di cabang" itu tidak tampil).
 * branchSlug kosong/tidak dikenal → cabang Aktif pertama. `uniform` = semua cabang Aktif berdaftar & berharga sama persis
 * (pemilih cabang disembunyikan, label "Berlaku di semua cabang").
 */
export function buildPricing(entries: PricingEntry[], copy: PricingCopy, branches: Branch[], branchSlug?: string): PricingContent {
  const active = branches.filter((b) => b.status === 'Aktif');
  const branch = branches.find((b) => b.slug === branchSlug) ?? active[0];
  const items = branch ? activeSorted(entries).filter((i) => availableAt(i, branch.slug)) : activeSorted(entries);
  const price = (i: PricingEntry) => (branch ? priceAt(i, branch.slug) : i.price);

  const categories: PriceCategory[] = CATEGORY_ORDER.map((key) => ({
    id: key,
    name: copy.categoryLabels[key],
    items: items
      .filter((i) => i.category === key)
      .map((i, index) => ({
        id: makeId(i.name, index),
        name: i.name,
        description: text(i.description),
        price: price(i),
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
      price: price(i),
      features: splitList(i.description, /\r?\n/),
      featured: i.badge === 'Best Seller',
      badge: badgeOf(i.badge),
      ctaLabel: copy.packageCtaLabel,
    }));

  return {
    heading: copy.heading,
    branchSlug: branch?.slug,
    branchName: branch?.name,
    branchOptions: active.map((b) => ({ slug: b.slug, name: b.name })),
    uniform: samePricesEverywhere(entries, active.map((b) => b.slug)),
    categories,
    priceFromLabel: copy.priceFromLabel,
    packagesTitle: copy.packagesTitle,
    packages,
  };
}

/**
 * Harga "mulai" per kategori: harga terendah item aktif yang tersedia di cabang (harga per cabang), atau tanpa cabang:
 * terendah dari harga utama & semua harga per cabang.
 */
export function startingPrices(entries: PricingEntry[], branchSlug?: string): Partial<Record<PriceCategoryKey, number>> {
  const result: Partial<Record<PriceCategoryKey, number>> = {};
  const items = activeSorted(entries).filter((i) => !branchSlug || availableAt(i, branchSlug));
  for (const item of items) {
    const price = branchSlug ? priceAt(item, branchSlug) : Math.min(item.price, ...(item.branchPrices ?? []).map((p) => p.price));
    const current = result[item.category];
    result[item.category] = current === undefined ? price : Math.min(current, price);
  }
  return result;
}

/**
 * Kartu Layanan (Pages CMS → Kartu Layanan): kartu deskriptif tanpa harga. Kategori harga (opsional) hanya untuk tautan
 * "Lihat harga" ke kategori itu di Daftar Harga, dan hanya bila kategori punya item aktif (untuk cabang ini).
 */
export function buildServices(entries: ServiceCardEntry[], copy: ServicesCopy, pricing: PricingEntry[], branchSlug?: string): ServicesContent {
  const priced = startingPrices(pricing, branchSlug);
  const items: Service[] = activeSorted(entries).map((s, index) => {
    const category = text(s.pricingCategory) as Service['pricingCategory'] | undefined;
    const linked = category && priced[category] !== undefined ? category : undefined;
    return {
      id: makeId(s.name, index),
      name: s.name,
      description: s.description,
      icon: (s.icon ?? 'scissors') as IconName,
      ...(linked ? { pricingCategory: linked, priceHref: `#${priceCategoryAnchor(linked)}` } : {}),
    };
  });
  return { heading: copy.heading, items };
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

const GALLERY_FOCUS: Record<string, GalleryItem['focus']> = { atas: 'top', tengah: 'center', bawah: 'bottom' };

export function buildGallery(entries: GalleryEntry[], copy: GalleryCopy, showBeforeAfter: boolean): GalleryContent {
  const items = activeSorted(entries).map((g, index) => {
    const image = toImage(g.image, g.altText);
    return {
      id: makeId(g.altText, index),
      image,
      caption: text(g.caption),
      layout: layoutFromRatio(image.width, image.height),
      styleCategory: g.styleCategory,
      // Kartu kolom foto berjalan: ±150–240 px, pakai versi 600 px bila ada
      thumb: responsiveImage(g.image, g.altText, '(min-width: 768px) 240px, 150px'),
      focus: GALLERY_FOCUS[g.focalPoint ?? 'atas'] ?? 'top',
      showInMarquee: g.showInMarquee !== false,
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

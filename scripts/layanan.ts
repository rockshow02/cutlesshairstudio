/**
 * Halaman Layanan saat build (dipakai scripts/vite-content-plugin.ts; diuji tests/service-pages.test.ts):
 * 1. Baca src/content/layanan/*.md (frontmatter YAML + isi tambahan Markdown dari Pages CMS), validasi Zod
 *    (src/content/schema.ts), slug unik, foto ada, item Daftar Harga & Kartu Layanan terkait ada. Draf divalidasi tapi
 *    tidak di-build.
 * 2. Head, ringkasan statis (#root sebelum React), JSON-LD (Service + offers per cabang dari Daftar Harga, FAQPage,
 *    BreadcrumbList; /layanan/: CollectionPage + ItemList), entri sitemap & llms.txt. Ringkasan statis = teks yang sama
 *    dengan halaman React (e2e/static-content.spec.ts). Harga selalu dari pricing.json (harga per cabang).
 * 3. Bagian baru halaman cabang (deskripsi, area, patokan, fasilitas, jam buka, layanan, FAQ) + JSON-LD HairSalon
 *    tambahan (areaServed, amenityFeature, paymentAccepted, hasOfferCatalog, FAQPage).
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { servicePageSchema, type BranchEntry, type ContentBundle } from '../src/content/schema';
import {
  PAYMENT_FACILITIES,
  SERVICES_PATH,
  SERVICE_PAGE_SLUG,
  dailyHours,
  groupServicePages,
  pageByPricingItem,
  relatedServicePages,
  serviceBranches,
  servicePagePath,
  servicePrices,
  sortFacilities,
  sortServicePages,
  type ServicePage,
  type ServicePageSummary,
} from '../src/content/servicePages';
import { branchDetailsCopy, serviceBookLabel, servicePagesCopy } from '../src/content/servicePagesCopy';
import { PRICE_CATEGORIES } from '../src/content/priceCategories';
import { pricingCopy } from '../src/content/pricing';
import { itemsAt, priceAt } from '../src/content/branchPricing';
import { formatThousandsK } from '../src/lib/format';
import type { ImageMeta } from '../src/lib/responsiveImage';
import { renderMarkdown, resolveImage, splitFrontmatter } from './tips';
import { slugify } from '../src/content/tipsSeo';
import { e2eServicePageFiles } from '../e2e/fixtures/content';

export const SERVICE_PAGES_DIR = path.join('src', 'content', 'layanan');

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLdTag = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
const OG_IMAGE = '/images/og/og-cutless.jpg';
const WA = /^62\d{8,13}$/;

type Site = Pick<ContentBundle['settings'], 'siteUrl' | 'siteName'>;
type Bundle = Pick<ContentBundle, 'pricing' | 'branches' | 'settings'>;

/* ---------- Muat & validasi ---------- */

export interface ServicePageFile {
  file: string;
  source: string;
}

export interface ServicePagesResult {
  errors: string[];
  /** Halaman berstatus Terbit (urut Daftar Harga), siap di-build */
  published: ServicePage[];
  drafts: number;
}

/** File halaman: src/content/layanan/*.md, atau data uji tetap (build E2E) */
export async function readServicePageFiles(root: string, fixtures = false): Promise<ServicePageFile[]> {
  if (fixtures) return e2eServicePageFiles();
  const dir = path.join(root, SERVICE_PAGES_DIR);
  if (!existsSync(dir)) return [];
  const names = (await readdir(dir)).filter((f) => f.endsWith('.md') && !f.startsWith('_') && f.toLowerCase() !== 'readme.md').sort();
  return Promise.all(names.map(async (file) => ({ file, source: await readFile(path.join(dir, file), 'utf8') })));
}

/**
 * Validasi semua halaman (Draf juga, agar admin tahu lebih awal) & siapkan halaman Terbit.
 * `exists(url)`: foto /uploads/... ada di public/ (atau .webp-nya). `bundle`: relasi Daftar Harga & Kartu Layanan.
 */
export function processServicePages(
  files: ServicePageFile[],
  { exists, meta = {}, bundle }: { exists: (url: string) => boolean; meta?: ImageMeta; bundle?: Pick<ContentBundle, 'pricing' | 'services'> },
): ServicePagesResult {
  const errors: string[] = [];
  const at = (file: string, where?: string) => `  • layanan/${file}${where ? `: ${where}` : ''}`;
  const priced = new Set((bundle?.pricing ?? []).map((p) => p.name));
  const cards = new Set((bundle?.services ?? []).map((s) => s.name));
  const bySlug = new Map<string, string>();
  const published: ServicePage[] = [];
  let drafts = 0;

  for (const { file, source } of files) {
    let raw: { data: unknown; body: string };
    try {
      raw = splitFrontmatter(source);
    } catch (error) {
      errors.push(`${at(file)}: ${(error as Error).message}`);
      continue;
    }
    const result = servicePageSchema.safeParse({ ...(raw.data as object), body: raw.body });
    if (!result.success) {
      for (const issue of result.error.issues) errors.push(`${at(file, issue.path.join('.') || '(frontmatter)')}: ${issue.message}`);
      continue;
    }
    const p = result.data;
    const slug = p.slug || file.replace(/\.md$/, '');
    if (!SERVICE_PAGE_SLUG.test(slug)) {
      errors.push(`${at(file, 'slug')}: nama file "${file}" bukan slug yang valid; isi Slug (huruf kecil, angka, strip), mis. ${slugify(p.title) || 'potong-rambut-pria'}`);
      continue;
    }
    const other = bySlug.get(slug);
    if (other) errors.push(`${at(file, 'slug')}: slug "${slug}" sudah dipakai layanan/${other}; ubah Slug salah satunya`);
    bySlug.set(slug, file);
    const pricingItems = [...new Set((p.pricingItems ?? []).filter(Boolean))];
    for (const name of pricingItems) if (bundle && !priced.has(name)) errors.push(`${at(file, 'pricingItems')}: "${name}" tidak ada di Daftar Harga`);
    if (p.serviceCard && bundle && !cards.has(p.serviceCard)) errors.push(`${at(file, 'serviceCard')}: "${p.serviceCard}" tidak ada di Kartu Layanan`);
    const photos = (p.photos ?? []).map((ph) => ({ src: ph.image, alt: ph.alt }));
    for (const ph of photos) if (!exists(ph.src)) errors.push(`${at(file, 'photos')}: foto tidak ditemukan di public${ph.src}`);
    const rendered = renderMarkdown(p.body ?? '', meta);
    for (const img of rendered.images) if (img.startsWith('/') && !exists(img)) errors.push(`${at(file, 'body')}: gambar tidak ditemukan di public${img}`);
    if (p.status !== 'Terbit') {
      drafts++;
      continue;
    }
    published.push({
      slug,
      title: p.title,
      summary: p.summary,
      metaDescription: p.metaDescription,
      pricingItems,
      ...(p.serviceCard ? { serviceCard: p.serviceCard } : {}),
      ...(p.priceNote ? { priceNote: p.priceNote } : {}),
      ...(p.updatedAt ? { updatedAt: p.updatedAt } : {}),
      suitableFor: (p.suitableFor ?? []).filter(Boolean),
      steps: (p.steps ?? []).filter(Boolean),
      ...(p.duration ? { duration: p.duration } : {}),
      photos: photos.map((ph) => ({ ...ph, src: resolveImage(ph.src, meta) })),
      html: rendered.html,
      faq: (p.faq ?? []).map((q) => ({ question: q.question, answer: q.answer })),
    });
  }
  return { errors, published: sortServicePages(published, bundle?.pricing ?? []), drafts };
}

/** Ringkasan (tanpa isi) untuk modul browser virtual:layanan */
export const serviceSummaryOf = ({ slug, title, summary, pricingItems, serviceCard, priceNote, updatedAt }: ServicePage): ServicePageSummary => ({
  slug,
  title,
  summary,
  pricingItems,
  ...(serviceCard ? { serviceCard } : {}),
  ...(priceNote ? { priceNote } : {}),
  ...(updatedAt ? { updatedAt } : {}),
});

/* ---------- JSON-LD ---------- */

const salonId = (siteUrl: string, slug: string) => `${siteUrl}/cabang/${slug}/#salon`;
const pageUrlOf = (site: Site, slug: string) => `${site.siteUrl}${servicePagePath(slug)}`;

const breadcrumbJsonLd = (site: Site, items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${site.siteUrl}${it.path}` })),
});

const crumbs = (page?: Pick<ServicePageSummary, 'title' | 'slug'>) => [
  { name: servicePagesCopy.labels.home, path: '/' },
  { name: servicePagesCopy.heading.kicker, path: SERVICES_PATH },
  ...(page ? [{ name: page.title, path: servicePagePath(page.slug) }] : []),
];

/**
 * Service: provider = HairSalon cabang (@id sama dengan halaman cabang), areaServed = kota & area cabang, offers per
 * cabang = harga terendah item Daftar Harga terkait di cabang itu (IDR).
 */
export function serviceJsonLd(p: ServicePage, bundle: Bundle) {
  const site = bundle.settings;
  const url = pageUrlOf(site, p.slug);
  const branches = serviceBranches(p, bundle.pricing, bundle.branches);
  const prices = servicePrices(p, bundle.pricing, bundle.branches);
  const category = linkedCategory(p, bundle);
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${url}#service`,
    name: p.title,
    description: p.summary,
    url,
    serviceType: category ? pricingCopy.categoryLabels[category as keyof typeof pricingCopy.categoryLabels] ?? category : p.title,
    image: p.photos[0] ? `${site.siteUrl}${p.photos[0].src}` : `${site.siteUrl}${OG_IMAGE}`,
    provider: branches.map((b) => ({ '@type': 'HairSalon', '@id': salonId(site.siteUrl, b.slug), name: `${site.siteName} ${b.name}` })),
    areaServed: [...new Set(branches.flatMap((b) => [b.city, ...(b.serviceAreas ?? [])]))].map((name) => ({ '@type': 'Place', name })),
    ...(prices.length
      ? {
          offers: prices.map((b) => ({
            '@type': 'Offer',
            name: `${p.title} di ${site.siteName} ${b.name}`,
            price: b.from,
            priceCurrency: 'IDR',
            priceSpecification: { '@type': 'PriceSpecification', minPrice: b.from, priceCurrency: 'IDR' },
            availableAtOrFrom: { '@id': salonId(site.siteUrl, b.slug) },
            url,
          })),
        }
      : {}),
  };
}

const linkedCategory = (p: Pick<ServicePageSummary, 'pricingItems'>, bundle: Pick<ContentBundle, 'pricing'>) =>
  bundle.pricing.filter((i) => i.isActive !== false && p.pricingItems.includes(i.name)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0]?.category;

/** FAQPage dari daftar tanya-jawab; undefined bila kosong */
export function faqJsonLd(faq: { question: string; answer: string }[], url: string) {
  if (!faq.length) return undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    url,
    mainEntity: faq.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })),
  };
}

export function servicesCollectionJsonLd(pages: ServicePageSummary[], site: Site) {
  const url = `${site.siteUrl}${SERVICES_PATH}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#collection`,
    url,
    name: `${servicePagesCopy.heading.title} | ${site.siteName}`,
    description: servicePagesCopy.heading.intro,
    inLanguage: 'id-ID',
    isPartOf: { '@type': 'WebSite', url: `${site.siteUrl}/`, name: site.siteName },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: pages.length,
      itemListElement: pages.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: pageUrlOf(site, p.slug), name: p.title })),
    },
  };
}

/* ---------- Head ---------- */

const indexTitle = (siteName: string) => `${servicePagesCopy.heading.title}: Harga & Booking | ${siteName}`;

export function servicesIndexHead(pages: ServicePageSummary[], bundle: Bundle): string {
  const site = bundle.settings;
  const url = `${site.siteUrl}${SERVICES_PATH}`;
  const title = indexTitle(site.siteName);
  const description = servicePagesCopy.heading.intro;
  const image = `${site.siteUrl}${OG_IMAGE}`;
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    jsonLdTag(servicesCollectionJsonLd(sortServicePages(pages, bundle.pricing), site)),
    jsonLdTag(breadcrumbJsonLd(site, crumbs())),
  ].join('\n    ');
}

export function servicePageHead(p: ServicePage, bundle: Bundle): string {
  const site = bundle.settings;
  const url = pageUrlOf(site, p.slug);
  const title = `${p.title} | ${site.siteName}`;
  const image = p.photos[0] ? `${site.siteUrl}${p.photos[0].src}` : `${site.siteUrl}${OG_IMAGE}`;
  const faq = faqJsonLd(p.faq, url);
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(p.metaDescription)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(p.title)}" />`,
    `<meta property="og:description" content="${esc(p.metaDescription)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    p.photos[0] ? `<meta property="og:image:alt" content="${esc(p.photos[0].alt)}" />` : '',
    `<meta name="twitter:image" content="${image}" />`,
    jsonLdTag(serviceJsonLd(p, bundle)),
    faq ? jsonLdTag(faq) : '',
    jsonLdTag(breadcrumbJsonLd(site, crumbs(p))),
  ]
    .filter(Boolean)
    .join('\n    ');
}

/* ---------- Ringkasan statis (teks sama dengan src/components/pages/ServicePages.tsx) ---------- */

const l = servicePagesCopy.labels;
const priceText = (from: number) => `${l.priceFrom} ${formatThousandsK(from)}`;
const categoryName = (c?: string) => (c ? pricingCopy.categoryLabels[c as keyof typeof pricingCopy.categoryLabels] ?? c : servicePagesCopy.otherCategory);

/** Kartu halaman layanan: judul (link), ringkasan, harga mulai per cabang (atau catatan harga) */
function cardHtml(p: ServicePageSummary, bundle: Bundle, heading: 'h3'): string {
  const prices = servicePrices(p, bundle.pricing, bundle.branches);
  return [
    '<li>',
    `<${heading}><a href="${servicePagePath(p.slug)}">${esc(p.title)}</a></${heading}>`,
    `<p>${esc(p.summary)}</p>`,
    prices.length ? `<ul>${prices.map((b) => `<li><span>${esc(b.name)}</span> <span>${priceText(b.from)}</span></li>`).join('')}</ul>` : p.priceNote ? `<p>${esc(p.priceNote)}</p>` : '',
    '</li>',
  ].join('');
}

export function servicesIndexBody(pages: ServicePageSummary[], bundle: Bundle): string {
  const h = servicePagesCopy.heading;
  return [
    '<div class="prerender">',
    `<p>${esc(h.kicker)}</p>`,
    `<h1>${esc(h.title)}</h1>`,
    `<p>${esc(h.intro)}</p>`,
    ...groupServicePages(pages, bundle.pricing, PRICE_CATEGORIES).map((g) => `<h2>${esc(categoryName(g.category))}</h2><ul>${g.pages.map((p) => cardHtml(p, bundle, 'h3')).join('')}</ul>`),
    '</div>',
  ].join('');
}

/**
 * Ringkasan statis halaman layanan: breadcrumb, H1, ringkasan, harga per cabang, tersedia di cabang, cocok untuk,
 * proses, durasi, isi, FAQ, CTA, layanan terkait. Foto tidak ditulis di sini (React menampilkannya).
 */
export function servicePageBody(p: ServicePage, all: ServicePageSummary[], bundle: Bundle): string {
  const prices = servicePrices(p, bundle.pricing, bundle.branches);
  const branches = serviceBranches(p, bundle.pricing, bundle.branches);
  const related = relatedServicePages(all, p, bundle.pricing);
  return [
    '<div class="prerender">',
    `<nav><a href="/">${esc(l.home)}</a> <a href="${SERVICES_PATH}">${esc(servicePagesCopy.heading.kicker)}</a> <span>${esc(p.title)}</span></nav>`,
    `<h1>${esc(p.title)}</h1>`,
    `<p>${esc(p.summary)}</p>`,
    prices.length || p.priceNote ? `<h2>${esc(l.priceTitle)}</h2>` : '',
    prices
      .map(
        (b) =>
          `<h3>${esc(b.name)}</h3><p>${priceText(b.from)}</p><ul>${b.items.map((i) => `<li><span>${esc(i.name)}</span>${i.description ? ` <small>${esc(i.description)}</small>` : ''} ${i.priceFrom ? `<small>${esc(pricingCopy.priceFromLabel)}</small> ` : ''}<span>${formatThousandsK(i.price)}</span></li>`).join('')}</ul>`,
      )
      .join(''),
    p.priceNote ? `<p>${esc(p.priceNote)}</p>` : '',
    branches.length ? `<h2>${esc(l.availableAt)}</h2><ul>${branches.map((b) => `<li><a href="/cabang/${b.slug}/">${esc(b.name)}</a></li>`).join('')}</ul>` : '',
    p.suitableFor.length ? `<h2>${esc(l.suitableFor)}</h2><ul>${p.suitableFor.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '',
    p.steps.length ? `<h2>${esc(l.steps)}</h2><ol>${p.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : '',
    p.duration ? `<p><span>${esc(l.duration)}</span> <span>${esc(p.duration)}</span></p>` : '',
    p.html ? `<article>${p.html}</article>` : '',
    p.faq.length ? `<h2>${esc(l.faqTitle)}</h2><dl>${p.faq.map((q) => `<dt>${esc(q.question)}</dt><dd>${esc(q.answer)}</dd>`).join('')}</dl>` : '',
    `<h2>${esc(servicePagesCopy.cta.title)}</h2><p>${esc(servicePagesCopy.cta.text)}</p>`,
    // Tombol booking hanya bila ada cabang tersedia yang bisa booking (Aktif + nomor WhatsApp asli)
    branches.some((b) => WA.test(b.whatsappNumber)) ? `<p>${esc(serviceBookLabel(p.title))}</p>` : '',
    related.length ? `<h2>${esc(l.relatedTitle)}</h2><ul>${related.map((r) => cardHtml(r, bundle, 'h3')).join('')}</ul>` : '',
    '</div>',
  ].join('');
}

/** Data halaman untuk React (dibaca src/lib/servicePages.ts), di dalam HTML halaman layanan */
export const servicePageDataTag = (p: ServicePage) => `<script type="application/json" id="service-page">${JSON.stringify(p).replace(/</g, '\\u003c')}</script>`;

/* ---------- Sitemap & llms.txt ---------- */

/** /layanan/ (lastmod = halaman terbaru diperbarui) & setiap halaman (lastmod = Tanggal diperbarui, kosong = hari build) */
export function servicesSitemapEntries(pages: ServicePageSummary[]): { path: string; lastmod?: string }[] {
  if (!pages.length) return [];
  const newest = pages.every((p) => p.updatedAt) ? pages.map((p) => p.updatedAt!).sort().pop() : undefined;
  return [{ path: SERVICES_PATH, lastmod: newest }, ...pages.map((p) => ({ path: servicePagePath(p.slug), lastmod: p.updatedAt }))];
}

/** Bagian llms.txt: judul + link + harga mulai per cabang + ringkasan setiap halaman */
export function servicesLlmsLines(pages: ServicePageSummary[], bundle: Bundle): string[] {
  if (!pages.length) return [];
  const { siteUrl } = bundle.settings;
  const line = (p: ServicePageSummary) => {
    const prices = servicePrices(p, bundle.pricing, bundle.branches);
    const price = prices.length ? ` Harga mulai: ${prices.map((b) => `${b.name} ${formatThousandsK(b.from)}`).join(', ')}.` : p.priceNote ? ` ${p.priceNote}` : '';
    return `- [${p.title}](${siteUrl}${servicePagePath(p.slug)}): ${p.summary}${price}`;
  };
  return ['## Halaman layanan', '', ...sortServicePages(pages, bundle.pricing).map(line), ''];
}

/* ---------- Halaman cabang: bagian baru & JSON-LD tambahan ---------- */

type BranchDetails = Pick<BranchEntry, 'slug' | 'name' | 'city' | 'description' | 'serviceAreas' | 'directions' | 'facilities' | 'faq' | 'openingHours'>;

const hoursRows = (b: Pick<BranchEntry, 'openingHours'>) => b.openingHours.map((h) => ({ open: h.openTime, close: h.closeTime, closed: h.isClosed }));

/** "Setiap hari 09.00–21.00" & "Buka sampai 21.00" (semua hari sama), atau undefined */
export function branchHoursHighlight(b: Pick<BranchEntry, 'openingHours'>): { everyDay: string; until: string } | undefined {
  const h = dailyHours(hoursRows(b));
  if (!h) return undefined;
  return {
    everyDay: branchDetailsCopy.everyDay.replace('{open}', h.open).replace('{close}', h.close),
    until: branchDetailsCopy.openUntil.replace('{close}', h.close),
  };
}

/** Layanan terbit yang tersedia di cabang (urut Daftar Harga) + harga mulai di cabang itu */
export function branchServicePages(b: Pick<BranchEntry, 'slug'>, pages: ServicePageSummary[], bundle: Pick<ContentBundle, 'pricing' | 'branches'>) {
  return sortServicePages(pages, bundle.pricing)
    .filter((p) => serviceBranches(p, bundle.pricing, bundle.branches).some((x) => x.slug === b.slug))
    .map((p) => ({ page: p, from: servicePrices(p, bundle.pricing, bundle.branches).find((x) => x.slug === b.slug)?.from }));
}

/**
 * Ringkasan statis bagian baru halaman cabang (sama dengan BranchDetails di src/components/pages/BranchPages.tsx):
 * jam buka (ringkas), deskripsi, area, patokan, fasilitas, layanan (hanya bila halaman layanan aktif), FAQ cabang.
 */
export function branchDetailsBody(b: BranchDetails, pages: ServicePageSummary[], bundle: Pick<ContentBundle, 'pricing' | 'branches'>): string {
  const c = branchDetailsCopy;
  const hours = branchHoursHighlight(b);
  const areas = (b.serviceAreas ?? []).filter(Boolean);
  const facilities = sortFacilities(b.facilities);
  const services = branchServicePages(b, pages, bundle);
  const faq = b.faq ?? [];
  return [
    hours ? `<p>${esc(hours.until)}</p><p>${esc(hours.everyDay)}</p>` : '',
    b.description ? `<p>${esc(b.description)}</p>` : '',
    areas.length ? `<h2>${esc(c.areasTitle)}</h2><ul>${areas.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : '',
    b.directions ? `<h2>${esc(c.directionsTitle)}</h2><p>${esc(b.directions)}</p>` : '',
    facilities.length ? `<h2>${esc(c.facilitiesTitle)}</h2><ul>${facilities.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '',
    services.length
      ? `<h2>${esc(c.servicesTitle)}</h2><ul>${services.map((s) => `<li><a href="${servicePagePath(s.page.slug)}">${esc(s.page.title)}</a>${s.from !== undefined ? ` <span>${priceText(s.from)}</span>` : ''}</li>`).join('')}</ul>`
      : '',
    faq.length ? `<h2>${esc(c.faqTitle)}</h2><dl>${faq.map((q) => `<dt>${esc(q.question)}</dt><dd>${esc(q.answer)}</dd>`).join('')}</dl>` : '',
  ].join('');
}

/**
 * Tambahan JSON-LD HairSalon cabang: description, areaServed (kota + area), amenityFeature (fasilitas non-pembayaran),
 * paymentAccepted, hasOfferCatalog (item Daftar Harga di cabang itu sebagai Service + Offer berharga cabang; item yang
 * punya halaman layanan terbit diberi url halamannya).
 */
export function branchJsonLdExtra(b: BranchDetails & Pick<BranchEntry, 'status'>, bundle: Pick<ContentBundle, 'pricing' | 'settings'>, pages: ServicePageSummary[]) {
  const { siteUrl, siteName } = bundle.settings;
  const facilities = sortFacilities(b.facilities);
  const amenities = facilities.filter((f) => !PAYMENT_FACILITIES.includes(f));
  const payments = facilities.filter((f) => PAYMENT_FACILITIES.includes(f));
  const areas = (b.serviceAreas ?? []).filter(Boolean);
  const items = itemsAt(bundle.pricing, b.slug).filter((i) => i.category !== 'Paket').sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
  const byItem = pageByPricingItem(pages);
  return {
    ...(b.description ? { description: b.description } : {}),
    areaServed: [b.city, ...areas.filter((a) => a !== b.city)].map((name) => ({ '@type': 'Place', name })),
    ...(amenities.length ? { amenityFeature: amenities.map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true })) } : {}),
    ...(payments.length ? { paymentAccepted: payments.join(', '), currenciesAccepted: 'IDR' } : {}),
    ...(b.status === 'Aktif' && items.length
      ? {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: `Layanan ${siteName} ${b.name}`,
            itemListElement: items.map((i) => ({
              '@type': 'Offer',
              price: priceAt(i, b.slug),
              priceCurrency: 'IDR',
              ...(i.priceFrom ? { priceSpecification: { '@type': 'PriceSpecification', minPrice: priceAt(i, b.slug), priceCurrency: 'IDR' } } : {}),
              itemOffered: {
                '@type': 'Service',
                name: i.name,
                ...(i.description?.trim() ? { description: i.description.trim() } : {}),
                ...(byItem.get(i.name) ? { url: `${siteUrl}${servicePagePath(byItem.get(i.name)!)}` } : {}),
              },
            })),
          },
        }
      : {}),
  };
}

/** FAQPage cabang (halaman cabang); undefined bila tanpa FAQ */
export const branchFaqJsonLd = (b: Pick<BranchEntry, 'slug' | 'faq'>, siteUrl: string) => faqJsonLd(b.faq ?? [], `${siteUrl}/cabang/${b.slug}/`);

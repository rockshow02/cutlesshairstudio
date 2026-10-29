/**
 * Plugin Vite untuk konten Pages CMS:
 * 1. Validasi src/content/*.json (skema Zod + relasi cabang + kesiapan launch) saat build.
 *    Konten tidak valid → build GAGAL. Konten belum siap tayang → GAGAL bila CONTENT_CHECK=strict
 *    (default produksi, .env.production), hanya peringatan + badge bila warn (development/staging).
 *    Di dev server, konten tidak valid (mis. dari Pages CMS) tampil sebagai overlay error di browser.
 * 2. Memastikan setiap gambar yang dirujuk konten benar-benar ada di public/.
 * 3. Modul virtual `virtual:image-meta`: ukuran asli tiap gambar di public/uploads.
 * 4. Head HTML dari settings.json → siteUrl adalah SATU-SATUNYA sumber domain
 *    (canonical, og:url, og:image, twitter:image, sitemap.xml, robots.txt).
 *    VITE_SITE_URL (.env.development/.env.staging) menggantinya per environment.
 * 6. Environment selain produksi: noindex (meta, robots.txt Disallow, header X-Robots-Tag), judul berawalan
 *    [DEV]/[STAGING], modul `virtual:content-status` untuk badge. Web Analytics hanya di produksi.
 * 5. Prerender /cabang/<slug>/index.html per cabang (title/meta unik + JSON-LD HairSalon + ringkasan statis).
 * 7. Tips & Trik (scripts/tips.ts): validasi src/content/tips/*.md, modul `virtual:tips`, prerender /tips/,
 *    /tips/halaman/<n>/ & /tips/<slug>/ (atau 301 ke beranda bila dimatikan), entri sitemap & llms.txt.
 */
import { cp, readdir, readFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';
import { CONTENT_FILES, crossCheck, SHOE_CARE_MENU_FILE_MAX_BYTES, type BranchEntry, type ContentBundle, type ContentIssue, type HeroEntry } from '../src/content/schema';
import { srcSetOf, type ImageMeta } from '../src/lib/responsiveImage';
import { applyE2EFixtures } from '../e2e/fixtures/content';
import { activeCategoryNames, branchDescription, homeDescription } from '../src/content/serviceSeo';
import { SHOE_CARE_PATH, shoeCareDescription, shoeCareImage, shoeCareRedirects, shoeCareTitle, shoeCareVisible } from '../src/content/shoeCareSeo';
import { itemsAt, priceAt, priceRangeAt, samePricesEverywhere } from '../src/content/branchPricing';
import { PRODUCTS_PATH, productsRedirects, productsVisible } from '../src/content/productsSeo';
import { activeFaqItems, faqPageJsonLd } from '../src/content/faqSeo';
import { activeVideoItems } from '../src/content/instagram';
import { postalAddressParts } from '../src/content/postalAddress';
import { videosCopy } from '../src/content/videos';
import { PRICE_CATEGORIES } from '../src/content/priceCategories';
import { pricingCopy } from '../src/content/pricing';
import { formatPhoneDisplay, formatThousandsK, formatTime } from '../src/lib/format';
import { branchesCopy } from '../src/content/branches';
import { shoeCareCopy } from '../src/content/shoeCare';
import { TIPS_PATH, tipsPageCount, tipsRedirects, tipsVisible, type TipSummary } from '../src/content/tipsSeo';
import { processTips, readTipFiles, summaryOf, tipBody, tipDataTag, tipHead, tipsIndexBody, tipsIndexHead, tipsLlmsLines, tipsSitemapEntries, type TipsResult } from './tips';

const VIRTUAL_ID = 'virtual:image-meta';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const STATUS_ID = 'virtual:content-status';
const RESOLVED_STATUS_ID = `\0${STATUS_ID}`;
const IMAGE_KEYS = new Set(['photo', 'image', 'logo', 'heroLogo', 'mobileImage', 'src']);
const OG_IMAGE = '/images/og/og-cutless.jpg';
const BRANCH_ROUTE = /^\/cabang\/([a-z0-9-]+)\/?(?:index\.html)?(?:[?#].*)?$/;
/** /tips/, /tips/halaman/<n>/, /tips/<slug>/ (dev server; di build file statis hasil prerender) */
const TIPS_ROUTE = /^\/tips(?:\/(?:halaman\/(\d+)|([a-z0-9-]+)))?\/?(?:index\.html)?(?:[?#].*)?$/;
const TIPS_VIRTUAL_ID = 'virtual:tips';
const RESOLVED_TIPS_ID = `\0${TIPS_VIRTUAL_ID}`;
/** Build E2E: file uji (mis. PDF daftar menu) yang hanya disalin ke dist/ build E2E, tidak pernah ke public/ */
const FIXTURE_PUBLIC = path.join('e2e', 'fixtures', 'public');

/* ---------- Validasi ---------- */

/** Gambar /uploads/... ada di public/ (+ e2e/fixtures/public di build E2E), atau versi .webp-nya */
function imageExists(root: string, url: string, fixtures: boolean): boolean {
  const dirs = [path.join(root, 'public'), ...(fixtures ? [path.join(root, FIXTURE_PUBLIC)] : [])];
  const webp = url.replace(/\.(jpe?g|png|gif|tiff?|avif)$/i, '.webp');
  return dirs.some((d) => existsSync(path.join(d, url)) || existsSync(path.join(d, webp)));
}

function collectImages(value: unknown, at: string, out: { path: string; at: string }[]) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      const entry = v as Record<string, unknown> | null;
      const label = entry?.name ?? entry?.title ?? entry?.altText;
      collectImages(v, `${at}: entri #${i + 1}${label ? ` ("${String(label).slice(0, 40)}")` : ''}`, out);
    });
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (IMAGE_KEYS.has(k) && typeof v === 'string' && v) out.push({ path: v, at: `${at} → ${k}` });
      else collectImages(v, `${at} → ${k}`, out);
    }
  }
}

function formatIssues(file: string, data: unknown, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const [first, ...rest] = issue.path;
    let where: string;
    if (typeof first === 'number' && Array.isArray(data)) {
      const entry = data[first] as Record<string, unknown> | undefined;
      const label = entry?.name ?? entry?.title ?? entry?.message ?? entry?.author ?? entry?.altText ?? entry?.slug;
      where = `entri #${first + 1}${label ? ` ("${String(label).slice(0, 40)}")` : ''}`;
      if (rest.length) where += ` → ${rest.join('.')}`;
    } else {
      where = issue.path.join('.') || '(isi file)';
    }
    return `  • ${file}: ${where}: ${issue.message}`;
  });
}

const formatCross = (issues: ContentIssue[]) => issues.map((i) => `  • ${i.file}: ${i.where}: ${i.message}`);

interface LoadResult {
  /** Masalah skema, gambar, dan relasi → selalu error */
  errors: string[];
  /** Konten belum siap tayang → error saat build (kecuali CONTENT_CHECK=warn) */
  launch: string[];
  bundle?: ContentBundle;
}

/**
 * `fixtures`: build E2E (mode e2e, E2E_FIXTURES=1 di .env.e2e) memakai data uji tetap dari e2e/fixtures/content.ts
 * agar tes tidak bergantung pada isi CMS (mis. status cabang).
 */
export async function loadContent(root: string, { fixtures = false, variant }: { fixtures?: boolean; variant?: string } = {}): Promise<LoadResult> {
  const contentDir = path.join(root, 'src', 'content');
  const publicDir = path.join(root, 'public');
  const errors: string[] = [];
  const parsed: Record<string, unknown> = {};

  for (const [file, schema] of Object.entries(CONTENT_FILES)) {
    let data: unknown;
    try {
      data = JSON.parse(await readFile(path.join(contentDir, file), 'utf8'));
      if (fixtures) data = applyE2EFixtures(file, data, variant);
    } catch (error) {
      errors.push(`  • ${file}: file tidak bisa dibaca sebagai JSON (${(error as Error).message})`);
      continue;
    }
    const result = (schema as z.ZodType).safeParse(data);
    if (result.success) parsed[file.replace('.json', '')] = result.data;
    else errors.push(...formatIssues(file, data, result.error));

    const images: { path: string; at: string }[] = [];
    collectImages(data, file, images);
    // Build E2E: file uji di e2e/fixtures/public juga dihitung (disalin ke dist/ saat build E2E saja)
    const dirs = [publicDir, ...(fixtures ? [path.join(root, FIXTURE_PUBLIC)] : [])];
    for (const img of images) {
      const webp = img.path.replace(/\.(jpe?g|png|gif|tiff?|avif)$/i, '.webp');
      const found = dirs.some((dir) => existsSync(path.join(dir, img.path)) || existsSync(path.join(dir, webp)));
      if (img.path.startsWith('/') && !found) errors.push(`  • ${img.at}: gambar tidak ditemukan di public${img.path}`);
    }
  }

  // Video preloader (opsional): harus ada & ringan agar tidak menunda halaman
  const video = (parsed.settings as { preloaderVideo?: string | null } | undefined)?.preloaderVideo;
  if (video) {
    const file = path.join(publicDir, video);
    if (!existsSync(file)) errors.push(`  • settings.json: preloaderVideo: file tidak ditemukan di public${video}`);
    else if ((await stat(file)).size > 500 * 1024) {
      errors.push(`  • settings.json: preloaderVideo: ${video} lebih dari 500 KB, kompres dulu (mis. 720p, tanpa suara, ±1,5 detik)`);
    }
  }

  // PDF daftar menu Partner Cuci Sepatu: harus ada & ringan (Pages CMS tidak bisa membatasi ukuran upload)
  const menuFile = (parsed.shoeCare as { menuFile?: string | null } | undefined)?.menuFile;
  if (menuFile) {
    const file = [publicDir, ...(fixtures ? [path.join(root, FIXTURE_PUBLIC)] : [])].map((dir) => path.join(dir, menuFile)).find((f) => existsSync(f));
    if (!file) errors.push(`  • shoeCare.json: menuFile: file tidak ditemukan di public${menuFile}`);
    else if ((await stat(file)).size > SHOE_CARE_MENU_FILE_MAX_BYTES) {
      errors.push(`  • shoeCare.json: menuFile: ${menuFile} lebih dari 3 MB, kompres PDF dulu (mis. ekspor ulang dengan gambar beresolusi lebih rendah) lalu upload ulang`);
    }
  }

  // Artikel Tips & Trik (src/content/tips/*.md): frontmatter, slug unik, gambar, penulis & layanan (Draf juga)
  const complete = Object.keys(parsed).length === Object.keys(CONTENT_FILES).length;
  const tipFiles = await readTipFiles(root, fixtures);
  errors.push(...processTips(tipFiles, { exists: (url) => imageExists(root, url, fixtures), bundle: complete ? (parsed as unknown as ContentBundle) : undefined }).errors);

  if (!complete) return { errors, launch: [] };
  const bundle = parsed as unknown as ContentBundle;
  const cross = crossCheck(bundle);
  return { errors: [...errors, ...formatCross(cross.errors)], launch: formatCross(cross.launch), bundle };
}

/* ---------- Ukuran gambar ---------- */

/** Ukuran gambar di public/uploads (Pages CMS) dan public/images (aset bawaan, mis. foto hero awal) */
/**
 * Ukuran intrinsik SVG: atribut width/height (angka/px) pada <svg>, atau dari viewBox (rasio dijaga bila hanya satu
 * atribut diisi). undefined = tidak bisa ditentukan (mis. width="100%" tanpa viewBox).
 */
export function svgSize(svg: string): { width: number; height: number } | undefined {
  const tag = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!tag) return undefined;
  const attr = (name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];
  const num = (v?: string) => (v && /^\s*[\d.]+\s*(px)?\s*$/i.test(v) ? parseFloat(v) : undefined);
  let width = num(attr('width'));
  let height = num(attr('height'));
  const box = attr('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (box?.length === 4 && box[2] > 0 && box[3] > 0) {
    if (!width && !height) [width, height] = [box[2], box[3]];
    else if (width && !height) height = (width * box[3]) / box[2];
    else if (height && !width) width = (height * box[2]) / box[3];
  }
  return width && height ? { width: Math.round(width), height: Math.round(height) } : undefined;
}

async function readImageMeta(root: string, fixtures = false): Promise<ImageMeta> {
  const meta: Record<string, { width: number; height: number }> = {};
  const walk = async (dir: string, base = path.join(root, 'public')): Promise<void> => {
    if (!existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, base);
      else if (/\.(webp|jpe?g|png|gif|avif|svg)$/i.test(entry.name)) {
        try {
          const m = /\.svg$/i.test(entry.name) ? svgSize(await readFile(full, 'utf8')) : await sharp(await readFile(full)).metadata();
          if (m?.width && m?.height) {
            const url = '/' + path.relative(base, full).split(path.sep).join('/');
            meta[url] = { width: m.width, height: m.height };
          }
        } catch {
          /* file bukan gambar valid: dilaporkan oleh validasi bila dirujuk */
        }
      }
    }
  };
  await walk(path.join(root, 'public', 'uploads'));
  await walk(path.join(root, 'public', 'images'));
  // Build E2E: ukuran file uji (URL sama seperti di public/, karena disalin ke akar dist/)
  if (fixtures) await walk(path.join(root, FIXTURE_PUBLIC, 'uploads'), path.join(root, FIXTURE_PUBLIC));
  return meta;
}

/* ---------- SEO: head, JSON-LD, sitemap ---------- */

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const joinCities = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`);
const DAY_EN: Record<string, string> = {
  Senin: 'Monday', Selasa: 'Tuesday', Rabu: 'Wednesday', Kamis: 'Thursday', Jumat: 'Friday', Sabtu: 'Saturday', Minggu: 'Sunday',
};
const isWa = (n: string) => /^62\d{8,13}$/.test(n);
/** Potong di batas kata (meta description ≤ 160 karakter) */
const clip = (text: string, max = 160) => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).replace(/[\s,.;:]+$/, '')}…`;
};
const imageUrl = (siteUrl: string, src: string) => `${siteUrl}${src.replace(/\.(jpe?g|png|gif|tiff?|avif)$/i, '.webp')}`;

function citiesOf(bundle: ContentBundle): string {
  const operating = bundle.branches.filter((b) => b.status !== 'Segera Dibuka');
  return joinCities([...new Set((operating.length ? operating : bundle.branches).map((b) => b.city))]);
}

export function branchJsonLd(b: BranchEntry, bundle: ContentBundle) {
  const { siteUrl, siteName } = bundle.settings;
  const url = `${siteUrl}/cabang/${b.slug}/`;
  const hours = b.openingHours.filter((h) => !h.isClosed && h.openTime && h.closeTime);
  return {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    '@id': `${url}#salon`,
    name: `${siteName} ${b.name}`,
    url,
    image: b.photo ? imageUrl(siteUrl, b.photo) : `${siteUrl}${OG_IMAGE}`,
    ...(isWa(b.whatsappNumber) ? { telephone: `+${b.whatsappNumber}` } : {}),
    // Jalan/kelurahan/kecamatan, kota, provinsi, kode pos terpisah (streetAddress tidak mengulang kota/provinsi/kode pos)
    address: { '@type': 'PostalAddress', ...postalAddressParts(b), addressCountry: 'ID' },
    ...(b.latitude !== null && b.longitude !== null && b.latitude !== undefined && b.longitude !== undefined
      ? { geo: { '@type': 'GeoCoordinates', latitude: b.latitude, longitude: b.longitude } }
      : {}),
    ...(b.status === 'Aktif' && hours.length
      ? {
          openingHoursSpecification: hours.map((h) => ({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: DAY_EN[h.day],
            opens: h.openTime,
            closes: h.closeTime,
          })),
        }
      : {}),
    ...(b.googleMapsUrl ? { hasMap: b.googleMapsUrl } : {}),
    ...(branchSameAs(b, bundle).length ? { sameAs: branchSameAs(b, bundle) } : {}),
    ...(branchPriceRange(b, bundle) ? { priceRange: branchPriceRange(b, bundle) } : {}),
    parentOrganization: { '@type': 'Organization', '@id': `${siteUrl}/#organization`, name: siteName, url: `${siteUrl}/` },
  };
}

/** sameAs HairSalon cabang: akun sosial (Pengaturan Situs) + link Google Maps cabang */
const branchSameAs = (b: Pick<BranchEntry, 'googleMapsUrl'>, bundle: Pick<ContentBundle, 'settings'>) =>
  [bundle.settings.instagramUrl, bundle.settings.tiktokUrl, b.googleMapsUrl].filter((u): u is string => Boolean(u));

const rupiah = (n: number) => `Rp${new Intl.NumberFormat('id-ID').format(n)}`;

/** JSON-LD priceRange dari harga cabang itu (harga per cabang menimpa harga utama), mis. "Rp60.000 - Rp450.000" */
export function branchPriceRange(b: Pick<BranchEntry, 'slug'>, bundle: Pick<ContentBundle, 'pricing'>): string | undefined {
  const range = priceRangeAt(bundle.pricing, b.slug);
  if (!range) return undefined;
  return range.min === range.max ? rupiah(range.min) : `${rupiah(range.min)} - ${rupiah(range.max)}`;
}

/**
 * Daftar harga statis, sama dengan baris Daftar Harga yang terlihat: nama, label, keterangan, "Start from", dan harga
 * format "K" sebagai teks terpisah. `label` = catatan di atas daftar (mis. "Harga cabang Cibubur").
 */
export function branchPriceList(b: Pick<BranchEntry, 'slug' | 'name'>, bundle: Pick<ContentBundle, 'pricing'>, label = branchesCopy.labels.priceFor.replace('{branch}', b.name)): string {
  const items = itemsAt(bundle.pricing, b.slug).sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
  const groups = PRICE_CATEGORIES.filter((c) => c !== 'Paket')
    .map((c) => ({ name: pricingCopy.categoryLabels[c], items: items.filter((i) => i.category === c) }))
    .filter((g) => g.items.length > 0);
  if (!groups.length) return '';
  const row = (i: (typeof items)[number]) =>
    `<li><span>${esc(i.name)}</span>${i.badge ? ` <span>${esc(i.badge)}</span>` : ''}${i.description ? ` <small>${esc(i.description)}</small>` : ''} ${i.priceFrom ? `<small>${esc(pricingCopy.priceFromLabel)}</small> ` : ''}<span>${formatThousandsK(priceAt(i, b.slug))}</span></li>`;
  return `<p>${esc(label)}</p>${groups.map((g) => `<h3>${esc(g.name)}</h3><ul>${g.items.map(row).join('')}</ul>`).join('')}`;
}

/** Logo organisasi untuk Google (persegi 512 px, terbaca di latar putih; scripts/make-favicons.mjs) */
export const ORG_LOGO = '/icon-512.png';

/** JSON-LD Organization (beranda): logo absolut, kontak, & akun sosial; dirujuk HairSalon cabang lewat @id */
export function organizationJsonLd(settings: Pick<ContentBundle['settings'], 'siteUrl' | 'siteName' | 'email' | 'instagramUrl' | 'tiktokUrl' | 'mainWhatsappNumber'>) {
  const { siteUrl, siteName } = settings;
  const sameAs = [settings.instagramUrl, settings.tiktokUrl].filter((u): u is string => Boolean(u));
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: siteName,
    url: `${siteUrl}/`,
    logo: { '@type': 'ImageObject', url: `${siteUrl}${ORG_LOGO}`, width: 512, height: 512 },
    image: `${siteUrl}${ORG_LOGO}`,
    ...(settings.email ? { email: settings.email } : {}),
    ...(isWa(settings.mainWhatsappNumber)
      ? { contactPoint: { '@type': 'ContactPoint', telephone: `+${settings.mainWhatsappNumber}`, contactType: 'customer service', availableLanguage: 'id' } }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

const jsonLdTag = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

/** Halaman /cuci-sepatu/ aktif & partnernya di cabang ini → nama partner (untuk meta & ringkasan halaman cabang) */
export function shoeCareAt(b: BranchEntry, bundle: ContentBundle): string | null {
  const p = bundle.shoeCare;
  return shoeCareVisible(p, bundle.branches) && p.branchSlug === b.slug ? p.name : null;
}

/** Head & ringkasan statis /cuci-sepatu/ (diganti React saat dimuat). Halaman mati → isi netral (dialihkan 301). */
function shoeCareFill(html: string, bundle: ContentBundle): string {
  const p = bundle.shoeCare;
  const { siteUrl, siteName } = bundle.settings;
  const branch = bundle.branches.find((b) => b.slug === p.branchSlug);
  const visible = shoeCareVisible(p, bundle.branches) && branch;
  const title = visible ? shoeCareTitle(p, branch.name) : `Cuci Sepatu | ${siteName}`;
  const description = visible ? shoeCareDescription(p, branch.name) : `Layanan cuci sepatu partner ${siteName}.`;
  const image = visible ? imageUrl(siteUrl, shoeCareImage(p, bundle.cta.image || '/images/cta/studio.jpg')) : `${siteUrl}${OG_IMAGE}`;
  const services = visible ? p.services.filter((s) => s.isActive !== false) : [];
  const body = visible
    ? [
        // Hanya teks yang tampil di halaman (hero & layanan); lihat aturan ringkasan statis di atas branchBody
        '<div class="prerender">',
        p.heroKicker?.trim() ? `<p>${esc(p.heroKicker.trim())}</p>` : '',
        `<h1>${esc(p.name)}</h1>`,
        p.tagline ? `<p>${esc(p.tagline)}</p>` : '',
        p.description ? `<p>${esc(p.description)}</p>` : '',
        `<p>${esc(shoeCareCopy.availableAt)} ${esc(branch.name)}</p>`,
        `<h2>${esc(shoeCareCopy.servicesTitle)}</h2><ul>${services.map((s) => `<li><h3>${esc(s.name)}</h3>${s.description ? `<p>${esc(s.description)}</p>` : ''}</li>`).join('')}</ul>`,
        '</div>',
      ].join('')
    : '';
  // JSON-LD Service: layanan partner di cabang (lokasi = HairSalon cabang, sama dengan @id di halaman cabang)
  const jsonLd = visible
    ? jsonLdTag({
        '@context': 'https://schema.org',
        '@type': 'Service',
        '@id': `${siteUrl}${SHOE_CARE_PATH}#service`,
        name: title,
        serviceType: 'Cuci sepatu',
        url: `${siteUrl}${SHOE_CARE_PATH}`,
        image,
        description,
        provider: { '@type': 'LocalBusiness', name: p.name },
        areaServed: { '@type': 'City', name: branch.city },
        availableChannel: { '@type': 'ServiceChannel', serviceLocation: { '@id': `${siteUrl}/cabang/${branch.slug}/#salon` } },
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: `Layanan ${p.name}`,
          itemListElement: services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name, ...(s.description ? { description: s.description } : {}) } })),
        },
      })
    : '';
  return html
    .replace('<!--cutless:shoe-jsonld-->', jsonLd)
    .replaceAll('%SHOE_TITLE%', esc(title))
    .replaceAll('%SHOE_DESCRIPTION%', esc(description))
    .replaceAll('%SHOE_IMAGE%', image)
    .replace('<!--cutless:shoe-body-->', body);
}

function branchHead(b: BranchEntry, bundle: ContentBundle): string {
  const { siteUrl, siteName } = bundle.settings;
  const url = `${siteUrl}/cabang/${b.slug}/`;
  const title = `${siteName} ${b.name} | Barbershop di ${b.city}`;
  const description = clip(
    b.status === 'Segera Dibuka'
      ? `${siteName} segera hadir di ${b.city}. Cabang baru dengan hairstylist yang sama on point-nya.`
      : branchDescription(siteName, b.name, activeCategoryNames(itemsAt(bundle.pricing, b.slug)), Boolean(shoeCareAt(b, bundle)))
  );
  const image = b.photo ? imageUrl(siteUrl, b.photo) : `${siteUrl}${OG_IMAGE}`;
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    jsonLdTag(branchJsonLd(b, bundle)),
  ].join('\n    ');
}

/*
 * Ringkasan statis di dalam #root: HTML awal yang terlihat sampai React merender halaman yang sama lalu menggantinya.
 * ATURAN: hanya teks yang juga tampil di halaman hasil React, dengan sumber & format yang sama (teks UI dari
 * src/content/*.ts, format dari src/lib/format.ts). Tidak boleh ada teks khusus mesin pencari/AI (berisiko dianggap
 * cloaking); e2e/static-content.spec.ts memastikan setiap potongan teks statis ada di halaman yang dirender.
 */

/** "09.00 – 21.00" atau "Tutup", sama dengan tabel jam buka */
const timeRange = (h: BranchEntry['openingHours'][number]) =>
  h.isClosed || !h.openTime || !h.closeTime ? branchesCopy.labels.closed : `${formatTime(h.openTime)} – ${formatTime(h.closeTime)}`;

/** Kartu cabang di section Lokasi: nama, alamat, nomor WhatsApp (cabang yang bisa booking), tabel jam operasional */
function locationCard(b: BranchEntry, heading: 'h2' | 'h3' | null): string {
  const phone = b.status === 'Aktif' && isWa(b.whatsappNumber) ? formatPhoneDisplay(b.whatsappNumber) : '';
  return [
    heading ? `<${heading}>${esc(b.name)}</${heading}>` : '',
    `<p>${esc(b.address ?? `${b.city}, ${b.province}`)}</p>`,
    phone ? `<p><a href="https://wa.me/${b.whatsappNumber}">${phone}</a></p>` : '',
    b.openingHours.length
      ? `<table><caption>${esc(branchesCopy.labels.hoursCaption)}</caption><tbody>${b.openingHours.map((h) => `<tr><th>${esc(h.day)}</th><td>${esc(timeRange(h))}</td></tr>`).join('')}</tbody></table>`
      : '',
  ].join('');
}

/** Teaser Cuci Sepatu (beranda & halaman cabang partner), sama dengan ShoeCareTeaser */
function shoeTeaser(bundle: ContentBundle): string {
  const p = bundle.shoeCare;
  if (!shoeCareVisible(p, bundle.branches) || p.showTeaser === false) return '';
  return [
    `<p>${esc(shoeCareCopy.ribbon)}</p>`,
    `<p>${esc(p.heroKicker ?? shoeCareCopy.kicker)}</p>`,
    `<h2><a href="${SHOE_CARE_PATH}">${esc(p.name)}</a></h2>`,
    p.tagline ? `<p>${esc(p.tagline)}</p>` : '',
  ].join('');
}

const sortedBranches = (bundle: Pick<ContentBundle, 'branches'>) => [...bundle.branches].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

function branchBody(b: BranchEntry, bundle: ContentBundle): string {
  return [
    '<div class="prerender">',
    `<p><a href="/cabang/">${esc(branchesCopy.labels.allBranches)}</a></p>`,
    `<p>${esc(b.city)}</p>`,
    `<h1>${esc(bundle.settings.siteName)} ${esc(b.name)}</h1>`,
    locationCard(b, null),
    branchPriceList(b, bundle),
    shoeCareAt(b, bundle) ? shoeTeaser(bundle) : '',
    '</div>',
  ].join('');
}

/* ---------- GEO: konten statis beranda & /cabang/, FAQ, llms.txt (semua dari src/content/) ---------- */

/** "Setiap hari 09.00–21.00" bila semua hari sama, selain itu per hari; "" bila belum ada jam buka (untuk /llms.txt) */
export function hoursSummary(b: Pick<BranchEntry, 'openingHours'>): string {
  const fmt = (t: string) => t.replace(':', '.');
  const rows = b.openingHours.map((h) => ({ day: h.day, text: h.isClosed || !h.openTime || !h.closeTime ? 'Tutup' : `${fmt(h.openTime)}–${fmt(h.closeTime)}` }));
  if (!rows.length) return '';
  if (rows.length === 7 && rows.every((r) => r.text === rows[0].text && r.text !== 'Tutup')) return `Setiap hari ${rows[0].text}`;
  return rows.map((r) => `${r.day} ${r.text}`).join(', ');
}

/** Harga "mulai" per kategori Daftar Harga (item aktif yang tersedia di cabang Aktif), format "K" (untuk /llms.txt) */
export function startingPricesText(bundle: Pick<ContentBundle, 'pricing' | 'branches'>): { category: string; from: string }[] {
  const active = bundle.branches.filter((b) => b.status === 'Aktif').map((b) => b.slug);
  return PRICE_CATEGORIES.filter((c) => c !== 'Paket')
    .map((c) => {
      const prices = active.flatMap((slug) => itemsAt(bundle.pricing, slug).filter((i) => i.category === c).map((i) => priceAt(i, slug)));
      return prices.length ? { category: pricingCopy.categoryLabels[c], from: formatThousandsK(Math.min(...prices)) } : null;
    })
    .filter((x): x is { category: string; from: string } => Boolean(x));
}

const shownBranches = (bundle: Pick<ContentBundle, 'branches'>) => bundle.branches.filter((b) => b.status !== 'Tutup Sementara');

/**
 * Ringkasan statis beranda: hero, Daftar Harga (cabang Aktif pertama, seperti tampilan awal), teaser Cuci Sepatu, Video
 * (judul & keterangan, hanya bila bagian Video tampil), FAQ,
 * Lokasi (tab cabang + kartu cabang pertama yang tampil awal), dan footer (tagline, cabang, kontak).
 */
export function homeBody(bundle: ContentBundle): string {
  const { settings, hero } = bundle;
  const cities = citiesOf(bundle);
  const branches = sortedBranches(bundle);
  const active = branches.filter((b) => b.status === 'Aktif');
  const uniform = samePricesEverywhere(bundle.pricing, active.map((b) => b.slug));
  const faq = activeFaqItems(bundle.faq);
  const videos = activeVideoItems(bundle.videos);
  const phone = isWa(settings.mainWhatsappNumber) ? formatPhoneDisplay(settings.mainWhatsappNumber) : '';
  const fill = (t: string) => t.replaceAll('{cities}', cities);
  return [
    '<div class="prerender">',
    hero.kicker ? `<p>${esc(fill(hero.kicker))}</p>` : '',
    `<h1>${hero.titleLines.map(esc).join('<br />')}</h1>`,
    hero.subtitle ? `<p>${esc(hero.subtitle)}</p>` : '',
    active[0] ? `<h2>${esc(pricingCopy.heading.title)}</h2>${branchPriceList(active[0], bundle, uniform ? branchesCopy.labels.priceAllBranches : undefined)}` : '',
    shoeTeaser(bundle),
    videos.length
      ? `<p>${esc(bundle.videos.kicker?.trim() || videosCopy.defaultKicker)}</p><h2>${esc(bundle.videos.title)}</h2><ul>${videos.map((v) => `<li>${v.caption ? `<p>${esc(v.caption)}</p>` : ''}<a href="${esc(v.url)}">${esc(videosCopy.watchOnInstagram)}</a></li>`).join('')}</ul>`
      : '',
    faq.length ? `<h2>${esc(bundle.faq.title)}</h2><dl>${faq.map((q) => `<dt>${esc(q.question)}</dt><dd>${esc(q.answer)}</dd>`).join('')}</dl>` : '',
    branches[0]
      ? `<h2>${esc(branchesCopy.heading.title)}</h2><ul>${branches.map((b) => `<li><a href="/cabang/${b.slug}/">${esc(b.name)}</a></li>`).join('')}</ul>${locationCard(branches[0], 'h3')}`
      : '',
    settings.footerTagline ? `<p>${esc(fill(settings.footerTagline))}</p>` : '',
    phone ? `<p><a href="https://wa.me/${settings.mainWhatsappNumber}">${phone}</a></p>` : '',
    settings.email ? `<p><a href="mailto:${esc(settings.email)}">${esc(settings.email)}</a></p>` : '',
    '</div>',
  ].join('');
}

/** Ringkasan statis /cabang/: judul halaman & kartu cabang (kota, nama, alamat), sama dengan daftar cabang */
export function cabangIndexBody(bundle: ContentBundle): string {
  const h = branchesCopy.indexHeading;
  return [
    '<div class="prerender">',
    `<p>${esc(h.kicker)}</p>`,
    `<h1>${esc(h.title)}</h1>`,
    h.intro ? `<p>${esc(h.intro)}</p>` : '',
    '<ul>',
    ...sortedBranches(bundle).map(
      (b) => `<li><p>${esc(`${b.city}, ${b.province}`)}</p><h2><a href="/cabang/${b.slug}/">${esc(b.name)}</a></h2>${b.address ? `<p>${esc(b.address)}</p>` : ''}</li>`,
    ),
    '</ul>',
    '</div>',
  ].join('');
}

/**
 * /llms.txt (format llmstxt.org): ringkasan bisnis untuk asisten AI, dibangkitkan dari konten saat build. Manfaatnya
 * belum terbukti (belum dipakai resmi oleh mesin pencari), tetapi tanpa biaya.
 */
export function llmsTxt(bundle: ContentBundle, tips: TipSummary[] = []): string {
  const { siteName, siteUrl } = bundle.settings;
  const lines: string[] = [];
  const shoe = shoeCareVisible(bundle.shoeCare, bundle.branches) ? bundle.branches.find((b) => b.slug === bundle.shoeCare.branchSlug) : undefined;
  lines.push(`# ${siteName}`, '', `> ${homeDescription(siteName, citiesOf(bundle), activeCategoryNames(bundle.pricing))}`, '');
  lines.push(`Situs resmi: ${siteUrl}/`, '', '## Cabang', '');
  for (const b of shownBranches(bundle)) {
    lines.push(`### ${siteName} ${b.name}${b.status !== 'Aktif' ? ` (${b.status})` : ''}`, '');
    lines.push(`- Alamat: ${b.address ?? `${b.city}, ${b.province}`}`);
    if (b.status === 'Aktif' && hoursSummary(b)) lines.push(`- Jam buka: ${hoursSummary(b)}`);
    if (b.status === 'Aktif' && isWa(b.whatsappNumber)) lines.push(`- WhatsApp: +${b.whatsappNumber} (https://wa.me/${b.whatsappNumber})`);
    if (b.googleMapsUrl) lines.push(`- Google Maps: ${b.googleMapsUrl}`);
    lines.push(`- Halaman cabang & daftar harga: ${siteUrl}/cabang/${b.slug}/`, '');
  }
  const prices = startingPricesText(bundle);
  if (prices.length) {
    lines.push('## Layanan & harga mulai', '');
    for (const p of prices) lines.push(`- ${p.category}: mulai ${p.from}`);
    lines.push('- Booking lewat WhatsApp cabang (tombol Booking di website).', '');
  }
  lines.push('## Halaman penting', '', `- [Beranda](${siteUrl}/)`, `- [Semua cabang](${siteUrl}/cabang/)`);
  for (const b of shownBranches(bundle)) lines.push(`- [${siteName} ${b.name}](${siteUrl}/cabang/${b.slug}/)`);
  if (shoe) lines.push(`- [Cuci sepatu ${bundle.shoeCare.name} di Cutless ${shoe.name}](${siteUrl}${SHOE_CARE_PATH})`);
  if (productsVisible(bundle.settings)) lines.push(`- [Produk](${siteUrl}${PRODUCTS_PATH})`);
  const shownTips = tipsVisible(bundle.settings) ? tips : [];
  if (shownTips.length) lines.push(`- [Tips & Trik](${siteUrl}${TIPS_PATH})`);
  lines.push('');
  lines.push(...tipsLlmsLines(shownTips, siteUrl));
  const faq = activeFaqItems(bundle.faq);
  if (faq.length) {
    lines.push('## FAQ', '');
    for (const q of faq) lines.push(`### ${q.question}`, '', q.answer, '');
  }
  const contact = [
    isWa(bundle.settings.mainWhatsappNumber) ? `- WhatsApp: +${bundle.settings.mainWhatsappNumber}` : '',
    bundle.settings.email ? `- Email: ${bundle.settings.email}` : '',
    bundle.settings.instagramUrl ? `- Instagram: ${bundle.settings.instagramUrl}` : '',
    bundle.settings.tiktokUrl ? `- TikTok: ${bundle.settings.tiktokUrl}` : '',
  ].filter(Boolean);
  if (contact.length) lines.push('## Kontak', '', ...contact, '');
  return `${lines.join('\n').trimEnd()}\n`;
}

/** File asli (jpg/png) yang sudah dikonversi ke .webp → pakai .webp */
const resolveImage = (src: string, meta: ImageMeta) => {
  const webp = src.replace(/\.(jpe?g|png|gif|tiff?|avif)$/i, '.webp');
  return meta[src] ? src : meta[webp] ? webp : src;
};

/** Preload foto hero (LCP) sesuai hero.json: versi HP < 768 px, versi desktop + srcset ≥ 768 px */
function heroPreload(hero: HeroEntry, meta: ImageMeta): string {
  const desktop = resolveImage(hero.image, meta);
  const srcset = srcSetOf(desktop, meta);
  const set = srcset ? ` imagesrcset="${esc(srcset)}" imagesizes="100vw"` : '';
  if (!hero.mobileImage) return `<link rel="preload" as="image" href="${esc(desktop)}"${set} />`;
  return [
    `<link rel="preload" as="image" href="${esc(resolveImage(hero.mobileImage, meta))}" media="(max-width: 767px)" />`,
    `<link rel="preload" as="image" href="${esc(desktop)}"${set} media="(min-width: 768px)" />`,
  ].join('\n    ');
}

function fillHtml(html: string, bundle: ContentBundle | undefined, meta: ImageMeta = {}): string {
  if (!bundle) return html;
  const { siteUrl, siteName } = bundle.settings;
  const allBranches = jsonLdTag(bundle.branches.map((b) => branchJsonLd(b, bundle)));
  const out = html
    .replaceAll('%SITE_URL%', siteUrl)
    .replaceAll('%BRAND%', esc(siteName))
    .replaceAll('%CITIES%', esc(citiesOf(bundle)))
    // Meta beranda dari kategori Daftar Harga yang punya item aktif, maks. 160 karakter
    .replaceAll('%HOME_DESCRIPTION%', esc(homeDescription(siteName, citiesOf(bundle), activeCategoryNames(bundle.pricing))))
    .replaceAll('%OG_IMAGE%', `${siteUrl}${OG_IMAGE}`)
    .replace('<!--cutless:jsonld-->', allBranches)
    .replace('<!--cutless:org-jsonld-->', jsonLdTag(organizationJsonLd(bundle.settings)))
    .replace('<!--cutless:faq-jsonld-->', faqPageJsonLd(bundle.faq, `${siteUrl}/`) ? jsonLdTag(faqPageJsonLd(bundle.faq, `${siteUrl}/`)) : '')
    .replace('<!--cutless:home-body-->', homeBody(bundle))
    .replace('<!--cutless:hero-preload-->', heroPreload(bundle.hero, meta));
  // Halaman /cuci-sepatu/: title, meta, Open Graph & ringkasan dari Partner Cuci Sepatu
  return out.includes('%SHOE_TITLE%') ? shoeCareFill(out, bundle) : out;
}

const HEAD_REGION = /<!--cutless:head-start-->[\s\S]*?<!--cutless:head-end-->/;

export function sitemap(bundle: ContentBundle, tips: TipSummary[] = []): string {
  const { siteUrl } = bundle.settings;
  const today = new Date().toISOString().slice(0, 10);
  const urls: (string | { path: string; lastmod?: string })[] = [
    '/',
    '/cabang/',
    ...bundle.branches.map((b) => `/cabang/${b.slug}/`),
    ...(productsVisible(bundle.settings) ? [PRODUCTS_PATH] : []),
    // Halaman Cuci Sepatu hanya saat aktif (mati → 301 ke beranda)
    ...(shoeCareVisible(bundle.shoeCare, bundle.branches) ? [SHOE_CARE_PATH] : []),
    // Tips & Trik hanya saat aktif & ada artikel terbit; lastmod artikel = tanggal diperbarui/terbit
    ...(tipsVisible(bundle.settings) && tips.length ? tipsSitemapEntries(tips) : []),
  ];
  const body = urls
    .map((u) => (typeof u === 'string' ? { path: u, lastmod: today } : u))
    .map((u) => `  <url><loc>${siteUrl}${u.path}</loc><lastmod>${u.lastmod ?? today}</lastmod></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export const robots = (bundle: ContentBundle, indexable: boolean) =>
  indexable
    ? `User-agent: *\nAllow: /\n\nSitemap: ${bundle.settings.siteUrl}/sitemap.xml\n`
    : '# Bukan produksi: jangan diindeks\nUser-agent: *\nDisallow: /\n';

/* ---------- Environment ---------- */

type AppEnv = 'development' | 'staging' | 'production';
const ENV_TAG: Record<AppEnv, string> = { development: '[DEV] ', staging: '[STAGING] ', production: '' };

/** Penanda environment di HTML (idempoten: aman dipanggil dua kali pada halaman yang sama) */
function applyEnv(html: string, env: AppEnv, analyticsToken: string): string {
  if (env === 'production') {
    if (!analyticsToken || html.includes('cloudflareinsights')) return html;
    const beacon = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token: analyticsToken })}'></script>`;
    return html.replace('</body>', `    ${beacon}\n  </body>`);
  }
  let out = html;
  if (!out.includes('name="robots"')) out = out.replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n    <meta name="robots" content="noindex, nofollow" />');
  if (!out.includes(`<title>${ENV_TAG[env]}`)) out = out.replace('<title>', `<title>${ENV_TAG[env]}`);
  return out;
}

const NOINDEX_HEADERS = '\n# Bukan produksi (ditambahkan saat build): jangan diindeks mesin pencari\n/*\n  X-Robots-Tag: noindex, nofollow\n';

/* ---------- Plugin ---------- */

const header = (title: string, n: number) => `\n✗ ${title} (${n} masalah). Perbaiki lewat Pages CMS atau file di src/content/:\n`;

export function contentPlugin(): Plugin {
  let root = process.cwd();
  let outDir = 'dist';
  let isBuild = false;
  let bundle: ContentBundle | undefined;
  let appEnv: AppEnv = 'production';
  let siteUrlOverride = '';
  let analyticsToken = '';
  let lenient = false;
  /** Build E2E: data uji tetap (e2e/fixtures/content.ts) untuk validasi, prerender, DAN bundle browser */
  let fixtures = false;
  /** Varian data uji (E2E_VARIANT, mis. "uniform" = Daftar Harga sama di semua cabang) */
  let variant: string | undefined;
  /** Masalah "siap tayang" terakhir (untuk badge DEV/STAGING) */
  let launchIssues: string[] = [];
  /** Pesan konten tidak valid terakhir di dev server (dikirim ulang ke browser yang baru terhubung) */
  let devError: string | null = null;
  /** Ukuran gambar (untuk preload hero), dibaca ulang tiap konten/gambar berubah */
  let imageMeta: ImageMeta = {};
  /** Artikel Tips & Trik (Terbit) terakhir yang lolos validasi */
  let tips: TipsResult = { errors: [], published: [], drafts: 0 };
  /** Artikel yang di-build: kosong bila Tampilkan Tips & Trik mati */
  const shownTips = () => (bundle && tipsVisible(bundle.settings) ? tips.published : []);

  const refresh = async () => {
    const result = await loadContent(root, { fixtures, variant });
    imageMeta = await readImageMeta(root, fixtures);
    if (result.bundle && siteUrlOverride) {
      result.bundle = { ...result.bundle, settings: { ...result.bundle.settings, siteUrl: siteUrlOverride } };
    }
    bundle = result.bundle ?? bundle;
    launchIssues = result.bundle ? result.launch : launchIssues;
    // Tips & Trik dirender ulang dengan ukuran gambar (srcset, width/height); masalahnya sudah dilaporkan loadContent
    const next = processTips(await readTipFiles(root, fixtures), { exists: (url) => imageExists(root, url, fixtures), meta: imageMeta, bundle: result.bundle });
    if (!next.errors.length) tips = next;
    return result;
  };

  const sendOverlay = (server: ViteDevServer) => {
    if (devError) server.ws.send({ type: 'error', err: { message: devError, stack: '', plugin: 'cutless-content' } });
  };

  const revalidate = async (server: ViteDevServer) => {
    const before = launchIssues.join('\n');
    const { errors, launch } = await refresh();
    devError = errors.length ? header('Konten tidak valid', errors.length) + errors.join('\n') : null;
    if (devError) server.config.logger.warn(devError);
    if (launch.length) server.config.logger.warn(header('Konten belum siap tayang', launch.length) + launch.join('\n'));
    if (devError) return sendOverlay(server);
    if (launchIssues.join('\n') !== before) {
      const mod = server.moduleGraph.getModuleById(RESOLVED_STATUS_ID);
      if (mod) server.moduleGraph.invalidateModule(mod);
      server.ws.send({ type: 'full-reload' });
    }
  };

  /** Halaman Tips dari template: daftar (halaman `page`) atau artikel `slug`; undefined = tidak ada */
  const tipsPage = (html: string, slug: string | undefined, page: number): string | undefined => {
    if (!bundle) return undefined;
    const list = shownTips().map(summaryOf);
    const site = bundle.settings;
    if (slug) {
      const t = shownTips().find((a) => a.slug === slug);
      if (!t) return undefined;
      const barber = bundle.barbers.find((b) => b.name === t.author);
      return html
        .replace(HEAD_REGION, tipHead(t, site, imageMeta, barber))
        .replace('<!--cutless:body-->', tipBody(t, list))
        .replace('<!--cutless:tip-data-->', tipDataTag(t));
    }
    if (page < 1 || page > tipsPageCount(list.length)) return undefined;
    return html
      .replace(HEAD_REGION, tipsIndexHead(list, site, page, `${site.siteUrl}${OG_IMAGE}`))
      .replace('<!--cutless:body-->', tipsIndexBody(list, page))
      .replace('<!--cutless:tip-data-->', '');
  };

  /** dist/tips/index.html (template) → /tips/, /tips/halaman/<n>/, /tips/<slug>/ */
  const prerenderTips = async () => {
    const template = path.join(outDir, 'tips', 'index.html');
    if (!bundle || !tipsVisible(bundle.settings) || !existsSync(template)) return;
    const html = await readFile(template, 'utf8');
    const write = async (dir: string, page: string | undefined) => {
      if (!page) return;
      await mkdir(path.join(outDir, dir), { recursive: true });
      await writeFile(path.join(outDir, dir, 'index.html'), applyEnv(page, appEnv, analyticsToken));
    };
    const pages = tipsPageCount(shownTips().length);
    for (let n = 2; n <= pages; n++) await write(path.join('tips', 'halaman', String(n)), tipsPage(html, undefined, n));
    for (const t of shownTips()) await write(path.join('tips', t.slug), tipsPage(html, t.slug, 1));
    await write('tips', tipsPage(html, undefined, 1));
    console.log(`✓ Tips & Trik: ${shownTips().length} artikel diprerender (${tips.drafts} draf tidak di-build)`);
  };

  return {
    name: 'cutless-content',
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
      isBuild = config.command === 'build';
      // .env.<mode> (+ variabel proses, yang selalu menang): VITE_APP_ENV, VITE_SITE_URL, CONTENT_CHECK, ...
      const env = loadEnv(config.mode, config.envDir || config.root, '');
      appEnv = (['development', 'staging', 'production'] as const).find((e) => e === env.VITE_APP_ENV)
        ?? (config.mode === 'production' ? 'production' : 'development');
      siteUrlOverride = (env.VITE_SITE_URL ?? '').trim().replace(/\/+$/, '');
      analyticsToken = (env.VITE_CF_ANALYTICS_TOKEN ?? '').trim();
      // Build produksi SELALU ketat: konten belum siap tayang → build gagal → Workers Builds tidak menjalankan deploy,
      // versi yang tayang tetap versi sebelumnya. CONTENT_CHECK=warn (mis. terpasang di Cloudflare) diabaikan.
      if (isBuild && appEnv === 'production' && env.CONTENT_CHECK === 'warn') {
        console.warn('• CONTENT_CHECK=warn diabaikan: build produksi selalu memakai cek siap tayang strict');
      }
      lenient = !(isBuild && appEnv === 'production') && (env.CONTENT_CHECK || (appEnv === 'production' ? 'strict' : 'warn')) === 'warn';
      fixtures = env.E2E_FIXTURES === '1';
      variant = env.E2E_VARIANT || undefined;
      if (fixtures && appEnv === 'production') throw new Error('E2E_FIXTURES tidak boleh dipakai untuk build produksi');
      if (isBuild) console.log(`• Environment: ${appEnv} · siteUrl: ${siteUrlOverride || '(Pengaturan Situs)'} · cek siap tayang: ${lenient ? 'warn' : 'strict'}${fixtures ? ' · DATA UJI E2E' : ''}`);
    },

    async buildStart() {
      const { errors, launch } = await refresh();
      if (errors.length) {
        const message = header('Konten tidak valid', errors.length) + errors.join('\n');
        if (isBuild) this.error(message);
        devError = message;
        this.warn(message);
      }
      if (launch.length) {
        const message =
          header('Konten belum siap tayang', launch.length) +
          launch.join('\n') +
          (lenient ? `\n  (CONTENT_CHECK=warn [${appEnv}]: hanya peringatan. Produksi memakai strict: build akan gagal)` : '');
        if (isBuild && !lenient) this.error(message);
        else this.warn(message);
      }
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      if (id === STATUS_ID) return RESOLVED_STATUS_ID;
      if (id === TIPS_VIRTUAL_ID) return RESOLVED_TIPS_ID;
      return null;
    },
    async load(id) {
      // Build E2E: import src/content/<file>.json di kode browser juga memakai data uji
      if (fixtures) {
        const file = path.relative(path.join(root, 'src', 'content'), id.split('?')[0]);
        if (file.endsWith('.json') && !file.includes(path.sep) && !file.startsWith('..')) {
          const data = JSON.parse(await readFile(id.split('?')[0], 'utf8'));
          return JSON.stringify(applyE2EFixtures(file, data, variant));
        }
      }
      if (id === RESOLVED_STATUS_ID) {
        return `export default ${JSON.stringify({ issues: appEnv === 'production' ? [] : launchIssues })};`;
      }
      // Ringkasan artikel terbit (tanpa isi): /tips/, Tips Terbaru di beranda, artikel terkait
      if (id === RESOLVED_TIPS_ID) return `export default ${JSON.stringify(shownTips().map(summaryOf))};`;
      if (id !== RESOLVED_ID) return null;
      return `export default ${JSON.stringify(await readImageMeta(root, fixtures))};`;
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        let out = fillHtml(html, bundle, imageMeta);
        // Dev server: /cabang/<slug>/ memakai head cabang tersebut
        const slug = ctx.originalUrl?.match(BRANCH_ROUTE)?.[1];
        const branch = slug && bundle?.branches.find((b) => b.slug === slug);
        if (branch && bundle) {
          out = out.replace(HEAD_REGION, branchHead(branch, bundle)).replace('<!--cutless:body-->', branchBody(branch, bundle));
        }
        // Dev server: /tips/... memakai head & ringkasan halaman itu (build: closeBundle)
        const tipsUrl = !isBuild && out.includes('<!--cutless:tip-data-->') ? ctx.originalUrl?.match(TIPS_ROUTE) : null;
        if (tipsUrl && bundle) out = tipsPage(out, tipsUrl[2], Number(tipsUrl[1] ?? 1)) ?? out;
        return applyEnv(out, appEnv, analyticsToken);
      },
    },

    generateBundle() {
      if (!bundle) return;
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap(bundle, shownTips()) });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots(bundle, appEnv === 'production') });
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: llmsTxt(bundle, shownTips()) });
    },

    /** Prerender halaman per cabang dari dist/cabang/index.html */
    async closeBundle() {
      if (!isBuild || !bundle) return;
      if (fixtures && existsSync(path.join(root, FIXTURE_PUBLIC))) await cp(path.join(root, FIXTURE_PUBLIC), outDir, { recursive: true });
      // Staging: header X-Robots-Tag dari Worker (static assets membaca dist/_headers)
      const headersFile = path.join(outDir, '_headers');
      if (appEnv !== 'production' && existsSync(headersFile)) {
        const current = await readFile(headersFile, 'utf8');
        if (!current.includes('X-Robots-Tag')) await writeFile(headersFile, current.trimEnd() + '\n' + NOINDEX_HEADERS);
      }
      // Halaman yang dimatikan di CMS: HTML-nya dihapus dari dist/ & URL-nya dialihkan 301 ke beranda
      const disablePage = async (dir: string, rules: string[], note: string) => {
        if (!rules.length) return;
        await rm(path.join(outDir, dir), { recursive: true, force: true });
        const redirectsFile = path.join(outDir, '_redirects');
        const current = existsSync(redirectsFile) ? await readFile(redirectsFile, 'utf8') : '';
        if (!current.includes(`/${dir}`)) await writeFile(redirectsFile, `${current.trimEnd()}\n# ${note}\n${rules.join('\n')}\n`);
      };
      await disablePage('cuci-sepatu', shoeCareRedirects(shoeCareVisible(bundle.shoeCare, bundle.branches)), 'Halaman Cuci Sepatu mati (Pages CMS → Partner Cuci Sepatu → Tampilkan halaman)');
      await disablePage('produk', productsRedirects(productsVisible(bundle.settings)), 'Halaman Produk mati (Pages CMS → Pengaturan Situs → Tampilkan Produk)');
      await disablePage('tips', tipsRedirects(tipsVisible(bundle.settings)), 'Halaman Tips & Trik mati (Pages CMS → Pengaturan Situs → Tampilkan Tips & Trik)');
      await prerenderTips();
      const template = path.join(outDir, 'cabang', 'index.html');
      if (!existsSync(template)) return;
      const html = await readFile(template, 'utf8');
      for (const branch of bundle.branches) {
        const dir = path.join(outDir, 'cabang', branch.slug);
        await mkdir(dir, { recursive: true });
        const page = applyEnv(
          html.replace(HEAD_REGION, branchHead(branch, bundle)).replace('<!--cutless:body-->', branchBody(branch, bundle)),
          appEnv,
          analyticsToken,
        );
        await writeFile(path.join(dir, 'index.html'), page);
      }
      // /cabang/ (daftar cabang) sendiri: ringkasan statis (template dipakai halaman cabang di atas)
      await writeFile(template, applyEnv(html.replace('<!--cutless:body-->', cabangIndexBody(bundle)), appEnv, analyticsToken));
      console.log(`✓ ${bundle.branches.length} halaman cabang diprerender`);
    },

    configureServer(server) {
      const contentDir = path.join(root, 'src', 'content');
      const uploadsDir = path.join(root, 'public', 'uploads');
      // /cabang/<slug>/ → template cabang (dev server; di produksi file statis hasil prerender)
      server.middlewares.use((req, _res, next) => {
        if (req.url && BRANCH_ROUTE.test(req.url)) req.url = '/cabang/index.html';
        else if (req.url && TIPS_ROUTE.test(req.url) && !req.url.startsWith('/tips/index.html')) req.url = '/tips/index.html';
        next();
      });
      server.watcher.add(uploadsDir);
      // Browser yang baru dibuka/di-refresh tetap melihat overlay bila konten masih tidak valid
      server.ws.on('connection', () => sendOverlay(server));
      server.watcher.on('all', (_event, file) => {
        if (file.startsWith(uploadsDir)) {
          void refresh();
          const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
          if (mod) server.moduleGraph.invalidateModule(mod);
          server.ws.send({ type: 'full-reload' });
        }
        if (file.startsWith(contentDir) && (file.endsWith('.json') || file.endsWith('.md'))) {
          void revalidate(server);
          const mod = server.moduleGraph.getModuleById(RESOLVED_TIPS_ID);
          if (mod && file.endsWith('.md')) {
            server.moduleGraph.invalidateModule(mod);
            server.ws.send({ type: 'full-reload' });
          }
        }
      });
    },
  };
}

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
import { itemsAt, priceAt, priceRangeAt } from '../src/content/branchPricing';
import { PRODUCTS_PATH, productsRedirects, productsVisible } from '../src/content/productsSeo';
import { PRICE_CATEGORIES } from '../src/content/priceCategories';
import { pricingCopy } from '../src/content/pricing';
import { formatThousandsK } from '../src/lib/format';

const VIRTUAL_ID = 'virtual:image-meta';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const STATUS_ID = 'virtual:content-status';
const RESOLVED_STATUS_ID = `\0${STATUS_ID}`;
const IMAGE_KEYS = new Set(['photo', 'image', 'logo', 'heroLogo', 'mobileImage', 'src']);
const OG_IMAGE = '/images/og/og-cutless.jpg';
const BRANCH_ROUTE = /^\/cabang\/([a-z0-9-]+)\/?(?:index\.html)?(?:[?#].*)?$/;
/** Build E2E: file uji (mis. PDF daftar menu) yang hanya disalin ke dist/ build E2E, tidak pernah ke public/ */
const FIXTURE_PUBLIC = path.join('e2e', 'fixtures', 'public');

/* ---------- Validasi ---------- */

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

  if (Object.keys(parsed).length !== Object.keys(CONTENT_FILES).length) return { errors, launch: [] };
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

function branchJsonLd(b: BranchEntry, bundle: ContentBundle) {
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
    address: {
      '@type': 'PostalAddress',
      ...(b.address ? { streetAddress: b.address } : {}),
      addressLocality: b.city,
      addressRegion: b.province,
      addressCountry: 'ID',
    },
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
    ...(branchPriceRange(b, bundle) ? { priceRange: branchPriceRange(b, bundle) } : {}),
    parentOrganization: { '@type': 'Organization', '@id': `${siteUrl}/#organization`, name: siteName, url: `${siteUrl}/` },
  };
}

const rupiah = (n: number) => `Rp${new Intl.NumberFormat('id-ID').format(n)}`;

/** JSON-LD priceRange dari harga cabang itu (harga per cabang menimpa harga utama), mis. "Rp60.000 - Rp450.000" */
export function branchPriceRange(b: Pick<BranchEntry, 'slug'>, bundle: Pick<ContentBundle, 'pricing'>): string | undefined {
  const range = priceRangeAt(bundle.pricing, b.slug);
  if (!range) return undefined;
  return range.min === range.max ? rupiah(range.min) : `${rupiah(range.min)} - ${rupiah(range.max)}`;
}

/** Daftar harga statis halaman cabang: hanya item yang tersedia di cabang itu, format "K" + "Start from" seperti di website */
export function branchPriceList(b: Pick<BranchEntry, 'slug' | 'name'>, bundle: Pick<ContentBundle, 'pricing'>): string {
  const items = itemsAt(bundle.pricing, b.slug).sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
  const groups = PRICE_CATEGORIES.filter((c) => c !== 'Paket')
    .map((c) => ({ name: pricingCopy.categoryLabels[c], items: items.filter((i) => i.category === c) }))
    .filter((g) => g.items.length > 0);
  if (!groups.length) return '';
  const row = (i: (typeof items)[number]) => `<li>${esc(i.name)}: ${i.priceFrom ? `${esc(pricingCopy.priceFromLabel)} ` : ''}${formatThousandsK(priceAt(i, b.slug))}</li>`;
  return `<h2>Harga cabang ${esc(b.name)}</h2>${groups.map((g) => `<h3>${esc(g.name)}</h3><ul>${g.items.map(row).join('')}</ul>`).join('')}`;
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
        '<div class="prerender">',
        `<h1>${esc(p.name)}</h1>`,
        p.tagline ? `<p>${esc(p.tagline)}</p>` : '',
        `<p>Tersedia di Cutless ${esc(branch.name)}${branch.address ? `: ${esc(branch.address)}` : ''}</p>`,
        `<h2>Layanan</h2><ul>${services.map((s) => `<li>${esc(s.name)}${s.description ? `: ${esc(s.description)}` : ''}</li>`).join('')}</ul>`,
        '<p><a href="/">Beranda</a> · <a href="/cabang/">Semua cabang</a></p>',
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

/** Ringkasan statis di dalam #root (terbaca crawler; diganti React saat halaman dimuat) */
function branchBody(b: BranchEntry, bundle: ContentBundle): string {
  const { siteName } = bundle.settings;
  const hours = b.openingHours
    .map((h) => `<li>${esc(h.day)}: ${h.isClosed || !h.openTime || !h.closeTime ? 'Tutup' : `${h.openTime.replace(':', '.')} – ${h.closeTime.replace(':', '.')}`}</li>`)
    .join('');
  return [
    '<div class="prerender">',
    `<h1>${esc(siteName)} ${esc(b.name)}</h1>`,
    `<p>${esc(b.address ?? `${b.city}, ${b.province}`)}</p>`,
    b.status !== 'Aktif' ? `<p>${esc(b.status)}</p>` : '',
    isWa(b.whatsappNumber) && b.status === 'Aktif' ? `<p>WhatsApp: <a href="https://wa.me/${b.whatsappNumber}">+${b.whatsappNumber}</a></p>` : '',
    hours ? `<h2>Jam operasional</h2><ul>${hours}</ul>` : '',
    branchPriceList(b, bundle),
    shoeCareAt(b, bundle) ? `<p>Layanan cuci sepatu oleh ${esc(shoeCareAt(b, bundle)!)} tersedia di cabang ini.</p>` : '',
    '<p><a href="/cabang/">Semua cabang</a> · <a href="/">Beranda</a></p>',
    '</div>',
  ].join('');
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
    .replace('<!--cutless:hero-preload-->', heroPreload(bundle.hero, meta));
  // Halaman /cuci-sepatu/: title, meta, Open Graph & ringkasan dari Partner Cuci Sepatu
  return out.includes('%SHOE_TITLE%') ? shoeCareFill(out, bundle) : out;
}

const HEAD_REGION = /<!--cutless:head-start-->[\s\S]*?<!--cutless:head-end-->/;

export function sitemap(bundle: ContentBundle): string {
  const { siteUrl } = bundle.settings;
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    '/',
    '/cabang/',
    ...bundle.branches.map((b) => `/cabang/${b.slug}/`),
    ...(productsVisible(bundle.settings) ? [PRODUCTS_PATH] : []),
    // Halaman Cuci Sepatu hanya saat aktif (mati → 301 ke beranda)
    ...(shoeCareVisible(bundle.shoeCare, bundle.branches) ? [SHOE_CARE_PATH] : []),
  ];
  const body = urls.map((u) => `  <url><loc>${siteUrl}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n');
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

  const refresh = async () => {
    const result = await loadContent(root, { fixtures, variant });
    imageMeta = await readImageMeta(root, fixtures);
    if (result.bundle && siteUrlOverride) {
      result.bundle = { ...result.bundle, settings: { ...result.bundle.settings, siteUrl: siteUrlOverride } };
    }
    bundle = result.bundle ?? bundle;
    launchIssues = result.bundle ? result.launch : launchIssues;
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
      lenient = (env.CONTENT_CHECK || (appEnv === 'production' ? 'strict' : 'warn')) === 'warn';
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
        return applyEnv(out, appEnv, analyticsToken);
      },
    },

    generateBundle() {
      if (!bundle) return;
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap(bundle) });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots(bundle, appEnv === 'production') });
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
      console.log(`✓ ${bundle.branches.length} halaman cabang diprerender`);
    },

    configureServer(server) {
      const contentDir = path.join(root, 'src', 'content');
      const uploadsDir = path.join(root, 'public', 'uploads');
      // /cabang/<slug>/ → template cabang (dev server; di produksi file statis hasil prerender)
      server.middlewares.use((req, _res, next) => {
        if (req.url && BRANCH_ROUTE.test(req.url)) req.url = '/cabang/index.html';
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
        if (file.startsWith(contentDir) && file.endsWith('.json')) void revalidate(server);
      });
    },
  };
}

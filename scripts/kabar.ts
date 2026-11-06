/**
 * Kabar, Promo & Acara saat build (dipakai scripts/vite-content-plugin.ts; diuji tests/kabar-build.test.ts):
 * 1. Baca src/content/kabar/*.md (frontmatter YAML + isi Markdown dari Pages CMS), validasi Zod (kabarSchema),
 *    slug unik, gambar ada, cabang = slug di branches.json. Draf divalidasi tapi tidak di-build.
 * 2. Render Markdown dengan renderMarkdown milik Tips (HTML mentah tampil sebagai teks, tidak dieksekusi).
 * 3. Head, JSON-LD (Kabar/Promo → BlogPosting, Acara → Event, CollectionPage + ItemList, BreadcrumbList), ringkasan
 *    statis (#root sebelum React), entri sitemap & llms.txt. Teks ringkasan statis = teks komponen React (kabarCopy.ts).
 * 4. Status (akan datang / berlangsung / berakhir) dihitung dari `now` yang diberikan pemanggil (satu kali per build,
 *    zona WIB); browser menyaring ulang lewat atribut data-kabar-start/-end (skrip pra-paint).
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { kabarSchema, type BranchEntry, type ContentBundle } from '../src/content/schema';
import {
  KABAR_ALL_BRANCHES,
  KABAR_PATH,
  KABAR_SLUG,
  formatKabarDate,
  groupKabar,
  isKabarActive,
  kabarEndMs,
  kabarPath,
  kabarStartMs,
  mapsUrl,
  type KabarArticle,
  type KabarKind,
  type KabarLocationType,
  type KabarSummary,
} from '../src/content/kabarSeo';
import { kabarCopy, kabarPeriodLabel, kabarStatusLabel } from '../src/content/kabarCopy';
import { postalAddressParts } from '../src/content/postalAddress';
import { slugify } from '../src/content/tipsSeo';
import { srcSetOf, type ImageMeta } from '../src/lib/responsiveImage';
import { breadcrumbJsonLd, esc, jsonLdTag, publisher, renderMarkdown, resolveImage, splitFrontmatter } from './tips';
import { e2eKabarFiles } from '../e2e/fixtures/content';

export const KABAR_DIR = path.join('src', 'content', 'kabar');

type Site = Pick<ContentBundle['settings'], 'siteUrl' | 'siteName'>;
type BranchInfo = Pick<BranchEntry, 'slug' | 'name' | 'city' | 'province' | 'address' | 'postalCode' | 'status'>;

const abs = (siteUrl: string, src: string) => `${siteUrl}${src}`;

/* ---------- Muat & validasi ---------- */

export interface KabarFile {
  file: string;
  source: string;
}

export interface KabarResult {
  errors: string[];
  /** Item berstatus Terbit (terbaru dulu), siap di-build */
  published: KabarArticle[];
  /** Jumlah item Draf (tidak di-build) */
  drafts: number;
}

/** File kabar: src/content/kabar/*.md, atau data uji tetap (build E2E). Folder tidak ada = daftar kosong */
export async function readKabarFiles(root: string, fixtures = false): Promise<KabarFile[]> {
  if (fixtures) return e2eKabarFiles();
  const dir = path.join(root, KABAR_DIR);
  if (!existsSync(dir)) return [];
  const names = (await readdir(dir)).filter((f) => f.endsWith('.md') && !f.startsWith('_') && f.toLowerCase() !== 'readme.md').sort();
  return Promise.all(names.map(async (file) => ({ file, source: await readFile(path.join(dir, file), 'utf8') })));
}

/** Terbaru terbit dulu; seri → judul */
const byPublished = (a: KabarSummary, b: KabarSummary) => b.publishedAt.localeCompare(a.publishedAt) || a.title.localeCompare(b.title, 'id');

/** Kolom hasil parse yang boleh ada (tergantung jenis); hanya dibaca menurut jenisnya */
type Parsed = {
  title: string;
  slug?: string | null;
  publishedAt: string;
  kind: KabarKind;
  branches: string[];
  summary: string;
  image?: string | null;
  imageAlt?: string | null;
  waLabel?: string | null;
  status: string;
  body?: string | null;
  validFrom?: string;
  validUntil?: string;
  startsAt?: string;
  endsAt?: string;
  locationType?: KabarLocationType;
  venueName?: string;
  venueAddress?: string;
  linkUrl?: string;
};

/**
 * Validasi semua item (Draf juga, agar admin tahu lebih awal) & siapkan item Terbit.
 * `exists(url)`: gambar /uploads/... ada di public/ (atau .webp-nya). `bundle`: relasi cabang.
 */
export function processKabar(
  files: KabarFile[],
  { exists, meta = {}, bundle }: { exists: (url: string) => boolean; meta?: ImageMeta; bundle?: Pick<ContentBundle, 'branches'> },
): KabarResult {
  const errors: string[] = [];
  const at = (file: string, where?: string) => `  • kabar/${file}${where ? `: ${where}` : ''}`;
  const branchSlugs = (bundle?.branches ?? []).map((b) => b.slug);
  const bySlug = new Map<string, string>();
  const published: KabarArticle[] = [];
  let drafts = 0;

  for (const { file, source } of files) {
    let raw: { data: unknown; body: string };
    try {
      raw = splitFrontmatter(source);
    } catch (error) {
      errors.push(`${at(file)}: ${(error as Error).message}`);
      continue;
    }
    const result = kabarSchema.safeParse({ ...(raw.data as object), body: raw.body });
    if (!result.success) {
      for (const issue of result.error.issues) errors.push(`${at(file, issue.path.join('.') || '(frontmatter)')}: ${issue.message}`);
      continue;
    }
    const k = result.data as Parsed;
    const slug = k.slug || file.replace(/\.md$/, '');
    if (!KABAR_SLUG.test(slug)) {
      errors.push(`${at(file, 'slug')}: nama file "${file}" bukan slug yang valid; isi Slug (huruf kecil, angka, strip), mis. ${slugify(k.title) || 'promo-akhir-tahun'}`);
      continue;
    }
    const other = bySlug.get(slug);
    if (other) errors.push(`${at(file, 'slug')}: slug "${slug}" sudah dipakai kabar/${other}; ubah Slug salah satunya`);
    bySlug.set(slug, file);
    if (k.image && !exists(k.image)) errors.push(`${at(file, 'image')}: gambar tidak ditemukan di public${k.image}`);
    if (bundle) {
      for (const b of k.branches) {
        if (b !== KABAR_ALL_BRANCHES && !branchSlugs.includes(b)) errors.push(at(file, `cabang "${b}" tidak ada di branches.json (pilihan: ${branchSlugs.join(', ')})`));
      }
    }

    const rendered = renderMarkdown(k.body ?? '', meta);
    for (const img of rendered.images) {
      if (img.startsWith('/') && !exists(img)) errors.push(`${at(file, 'body')}: gambar tidak ditemukan di public${img}`);
    }
    if (k.status !== 'Terbit') {
      drafts++;
      continue;
    }
    // Hanya kolom milik jenisnya yang dibawa (kolom jenis lain sudah dibuang skema, dijaga lagi di sini)
    published.push({
      slug,
      title: k.title,
      summary: k.summary,
      kind: k.kind,
      branches: k.branches,
      publishedAt: k.publishedAt,
      ...(k.image ? { image: resolveImage(k.image, meta), imageAlt: k.imageAlt ?? '' } : {}),
      ...(k.kind === 'Promo' ? { ...(k.validFrom ? { validFrom: k.validFrom } : {}), validUntil: k.validUntil } : {}),
      ...(k.kind === 'Acara'
        ? {
            startsAt: k.startsAt,
            endsAt: k.endsAt,
            locationType: k.locationType,
            ...(k.locationType === 'Tempat lain' ? { venueName: k.venueName, venueAddress: k.venueAddress } : {}),
            ...(k.linkUrl ? { linkUrl: k.linkUrl } : {}),
          }
        : {}),
      ...(k.waLabel ? { waLabel: k.waLabel } : {}),
      html: rendered.html,
    });
  }
  return { errors, published: published.sort(byPublished), drafts };
}

/** Ringkasan (tanpa isi & kolom detail) untuk modul browser, kartu, kotak cabang, banner */
export const kabarSummaryOf = (a: KabarSummary): KabarSummary => ({
  slug: a.slug,
  title: a.title,
  summary: a.summary,
  kind: a.kind,
  branches: a.branches,
  publishedAt: a.publishedAt,
  ...(a.image ? { image: a.image, imageAlt: a.imageAlt } : {}),
  ...(a.validFrom ? { validFrom: a.validFrom } : {}),
  ...(a.validUntil ? { validUntil: a.validUntil } : {}),
  ...(a.startsAt ? { startsAt: a.startsAt } : {}),
  ...(a.endsAt ? { endsAt: a.endsAt } : {}),
});

/* ---------- JSON-LD ---------- */

const wibIso = (v: string) => `${v.trim().replace(' ', 'T').slice(0, 16)}:00+07:00`;

/**
 * Cabang yang dituju item: slug tertentu, atau semua cabang yang beroperasi (bukan "Segera Dibuka") bila 'semua'.
 * Hasil kosong (semua Segera Dibuka, slug tak dikenal) → semua cabang, supaya location Event tidak pernah kosong.
 */
function targetBranches(a: KabarArticle, branches: BranchInfo[]): BranchInfo[] {
  const operating = branches.filter((b) => b.status !== 'Segera Dibuka');
  const fallback = operating.length ? operating : branches;
  if (a.branches.includes(KABAR_ALL_BRANCHES)) return fallback;
  const chosen = a.branches.flatMap((slug) => branches.filter((b) => b.slug === slug));
  return chosen.length ? chosen : fallback;
}

const branchPlace = (b: BranchInfo, site: Site) => ({
  '@type': 'Place',
  name: `${site.siteName} ${b.name}`,
  address: { '@type': 'PostalAddress', ...postalAddressParts(b), addressCountry: 'ID' },
});

export function kabarJsonLd(a: KabarArticle, site: Site, branches: BranchInfo[], meta: ImageMeta = {}) {
  const url = `${site.siteUrl}${kabarPath(a.slug)}`;
  const image = a.image ? { image: [abs(site.siteUrl, resolveImage(a.image, meta))] } : {};
  const places = a.kind === 'Acara' && a.locationType !== 'Tempat lain' ? targetBranches(a, branches) : [];
  // Tanpa cabang sama sekali, Event tidak valid untuk Google (location wajib): jatuh ke BlogPosting
  if (a.kind === 'Acara' && a.startsAt && a.endsAt && (a.locationType === 'Tempat lain' || places.length)) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      '@id': `${url}#event`,
      url,
      name: a.title,
      description: a.summary,
      startDate: wibIso(a.startsAt),
      endDate: wibIso(a.endsAt),
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location:
        a.locationType === 'Tempat lain'
          ? { '@type': 'Place', name: a.venueName, address: { '@type': 'PostalAddress', streetAddress: a.venueAddress } }
          : places.map((b) => branchPlace(b, site)),
      organizer: { '@type': 'Organization', '@id': `${site.siteUrl}/#organization`, name: site.siteName, url: `${site.siteUrl}/` },
      inLanguage: 'id-ID',
      ...image,
    };
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    mainEntityOfPage: url,
    url,
    headline: a.title,
    description: a.summary,
    datePublished: a.publishedAt,
    inLanguage: 'id-ID',
    publisher: publisher(site),
    ...image,
  };
}

export function kabarCollectionJsonLd(list: KabarSummary[], site: Site) {
  const url = `${site.siteUrl}${KABAR_PATH}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#collection`,
    url,
    name: `${kabarCopy.heading.title} | ${site.siteName}`,
    description: kabarCopy.heading.intro,
    inLanguage: 'id-ID',
    isPartOf: { '@type': 'WebSite', url: `${site.siteUrl}/`, name: site.siteName },
    publisher: publisher(site),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: list.length,
      itemListElement: list.map((k, i) => ({ '@type': 'ListItem', position: i + 1, url: `${site.siteUrl}${kabarPath(k.slug)}`, name: k.title })),
    },
  };
}

/* ---------- Head ---------- */

/** Head /kabar/ */
export function kabarIndexHead(list: KabarSummary[], site: Site, ogImage = ''): string {
  const url = `${site.siteUrl}${KABAR_PATH}`;
  const title = `${kabarCopy.heading.title} | ${site.siteName}`;
  const description = kabarCopy.heading.intro;
  const first = list.find((k) => k.image);
  const image = first?.image ? abs(site.siteUrl, first.image) : ogImage;
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    image ? `<meta property="og:image" content="${image}" />` : '',
    image ? `<meta name="twitter:image" content="${image}" />` : '',
    jsonLdTag(kabarCollectionJsonLd(list, site)),
    jsonLdTag(
      breadcrumbJsonLd(site, [
        { name: kabarCopy.labels.home, path: '/' },
        { name: kabarCopy.heading.title, path: KABAR_PATH },
      ]),
    ),
  ]
    .filter(Boolean)
    .join('\n    ');
}

/** Head halaman detail (+ preload gambar bila ada = LCP) */
export function kabarHead(a: KabarArticle, site: Site, branches: BranchInfo[], meta: ImageMeta = {}): string {
  const url = `${site.siteUrl}${kabarPath(a.slug)}`;
  const title = `${a.title} | ${site.siteName}`;
  const src = a.image ? resolveImage(a.image, meta) : undefined;
  const srcset = src ? srcSetOf(src, meta) : undefined;
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(a.summary)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${a.kind === 'Acara' ? 'website' : 'article'}" />`,
    `<meta property="og:title" content="${esc(a.title)}" />`,
    `<meta property="og:description" content="${esc(a.summary)}" />`,
    `<meta property="og:url" content="${url}" />`,
    src ? `<meta property="og:image" content="${abs(site.siteUrl, src)}" />` : '',
    src ? `<meta property="og:image:alt" content="${esc(a.imageAlt ?? '')}" />` : '',
    src ? `<meta name="twitter:image" content="${abs(site.siteUrl, src)}" />` : '',
    a.kind === 'Acara' ? '' : `<meta property="article:published_time" content="${a.publishedAt}" />`,
    src ? `<link rel="preload" as="image" href="${esc(src)}"${srcset ? ` imagesrcset="${esc(srcset)}" imagesizes="(min-width: 768px) 48rem, 100vw"` : ''} fetchpriority="high" />` : '',
    jsonLdTag(kabarJsonLd(a, site, branches, meta)),
    jsonLdTag(
      breadcrumbJsonLd(site, [
        { name: kabarCopy.labels.home, path: '/' },
        { name: kabarCopy.heading.title, path: KABAR_PATH },
        { name: a.title, path: kabarPath(a.slug) },
      ]),
    ),
  ]
    .filter(Boolean)
    .join('\n    ');
}

/* ---------- Ringkasan statis ---------- */

/** Atribut waktu untuk saringan pra-paint (epoch ms; tidak ditulis bila tidak ada) */
function timeAttrs(k: KabarSummary): string {
  const start = kabarStartMs(k);
  const end = kabarEndMs(k);
  return `${start !== undefined ? ` data-kabar-start="${start}"` : ''}${end !== undefined ? ` data-kabar-end="${end}"` : ''}`;
}

/** Kartu item (teks sama dengan kartu React) */
function cardHtml(k: KabarSummary, heading: 'h2' | 'h3', now: number): string {
  const status = kabarStatusLabel(k, now);
  const period = kabarPeriodLabel(k);
  return `<li${timeAttrs(k)}><p>${esc(k.kind)}</p><${heading}><a href="${kabarPath(k.slug)}">${esc(k.title)}</a></${heading}><p>${esc(k.summary)}</p>${period ? `<p>${esc(period)}</p>` : ''}${status ? `<p>${esc(status)}</p>` : ''}<p><time datetime="${k.publishedAt}">${formatKabarDate(k.publishedAt)}</time></p></li>`;
}

/** Ringkasan statis /kabar/: judul, intro, tiga grup (grup kosong tidak ditulis), atau pesan kosong */
export function kabarIndexBody(list: KabarSummary[], now: number): string {
  const { active, news, ended } = groupKabar(list, now);
  const group = (title: string, items: KabarSummary[]) => (items.length ? `<h2>${esc(title)}</h2><ul>${items.map((k) => cardHtml(k, 'h3', now)).join('')}</ul>` : '');
  return [
    '<div class="prerender">',
    `<p>${esc(kabarCopy.heading.kicker)}</p>`,
    `<h1>${esc(kabarCopy.heading.title)}</h1>`,
    `<p>${esc(kabarCopy.heading.intro)}</p>`,
    list.length ? [group(kabarCopy.groups.active, active), group(kabarCopy.groups.news, news), group(kabarCopy.groups.ended, ended)].join('') : `<p>${esc(kabarCopy.labels.empty)}</p>`,
    '</div>',
  ].join('');
}

/** Ringkasan statis detail: breadcrumb, jenis, H1, ringkasan, status, periode/waktu, lokasi, cabang, tautan, isi */
export function kabarBody(a: KabarArticle, branches: Pick<BranchInfo, 'slug' | 'name'>[], now: number): string {
  const l = kabarCopy.labels;
  const status = kabarStatusLabel(a, now);
  const period = kabarPeriodLabel(a);
  const names = a.branches.includes(KABAR_ALL_BRANCHES) ? [l.allBranches] : a.branches.map((s) => branches.find((b) => b.slug === s)?.name ?? s);
  const place =
    a.kind !== 'Acara'
      ? ''
      : a.locationType === 'Tempat lain' && a.venueName && a.venueAddress
        ? `<p><span>${esc(l.location)}</span> ${esc(a.venueName)}, ${esc(a.venueAddress)} <a href="${esc(mapsUrl(a.venueName, a.venueAddress))}" target="_blank" rel="noopener noreferrer">${esc(l.openMap)}</a></p>`
        : `<p><span>${esc(l.location)}</span> ${esc(names.join(', '))}</p>`;
  return [
    '<div class="prerender">',
    `<nav><a href="/">${esc(l.home)}</a> <a href="${KABAR_PATH}">${esc(kabarCopy.heading.title)}</a> <span>${esc(a.title)}</span></nav>`,
    `<p>${esc(a.kind)}</p>`,
    `<h1>${esc(a.title)}</h1>`,
    `<p>${esc(a.summary)}</p>`,
    status ? `<p>${esc(status)}</p>` : '',
    period ? `<p><span>${esc(a.kind === 'Acara' ? l.time : l.period)}</span> ${esc(period)}</p>` : '',
    place,
    `<p><span>${esc(l.branches)}</span> ${esc(names.join(', '))}</p>`,
    `<p><span>${esc(l.published)}</span> <time datetime="${a.publishedAt}">${formatKabarDate(a.publishedAt)}</time></p>`,
    a.kind === 'Acara' && a.linkUrl ? `<p><a href="${esc(a.linkUrl)}" target="_blank" rel="noopener noreferrer">${esc(l.eventLink)}</a></p>` : '',
    `<article>${a.html}</article>`,
    '</div>',
  ].join('');
}

/** Fragmen statis kotak "Promo & acara" di halaman cabang; '' bila tidak ada item. `items` = hasil branchBoxItems */
export function branchBoxBody(items: KabarSummary[], now: number): string {
  if (!items.length) return '';
  return `<section data-kabar-box><h2>${esc(kabarCopy.box.title)}</h2><ul>${items.map((k) => cardHtml(k, 'h3', now)).join('')}</ul></section>`;
}

/** Data item untuk React (dibaca src/lib/kabar.ts), di dalam HTML halaman detail */
export const kabarDataTag = (a: KabarArticle) => `<script type="application/json" id="kabar-item">${JSON.stringify(a).replace(/</g, '\\u003c')}</script>`;

/* ---------- Sitemap & llms.txt ---------- */

/** Entri sitemap: /kabar/ & setiap item terbit, termasuk yang sudah lewat (lastmod = tanggal terbit) */
export function kabarSitemapEntries(list: KabarSummary[]): { path: string; lastmod?: string }[] {
  const newest = list.map((k) => k.publishedAt).sort().pop();
  return [{ path: KABAR_PATH, ...(newest ? { lastmod: newest } : {}) }, ...list.map((k) => ({ path: kabarPath(k.slug), lastmod: k.publishedAt }))];
}

/** Bagian llms.txt: hanya Promo & Acara yang belum berakhir (termasuk akan datang) */
export function kabarLlmsLines(list: KabarSummary[], siteUrl: string, now: number): string[] {
  const items = list.filter((k) => k.kind !== 'Kabar' && isKabarActive(k, now));
  if (!items.length) return [];
  return ['## Promo & Acara', '', ...items.map((k) => `- [${k.title}](${siteUrl}${kabarPath(k.slug)}): ${k.summary}`), ''];
}

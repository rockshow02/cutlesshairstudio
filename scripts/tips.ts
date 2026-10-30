/**
 * Tips & Trik saat build (dipakai scripts/vite-content-plugin.ts; diuji tests/tips.test.ts):
 * 1. Baca src/content/tips/*.md (frontmatter YAML + isi Markdown dari Pages CMS), validasi Zod (src/content/schema.ts),
 *    slug unik, gambar ada, penulis = nama Barber, layanan = nama kartu Layanan. Draf divalidasi tapi tidak di-build.
 * 2. Render Markdown → HTML (marked): H2 diberi id (daftar isi), HTML mentah ditampilkan sebagai teks (tidak
 *    dieksekusi), gambar di isi artikel lazy + ukuran asli (tanpa layout shift).
 * 3. Head, ringkasan statis (#root sebelum React), JSON-LD (BlogPosting + author Person, FAQPage, BreadcrumbList,
 *    CollectionPage + ItemList), halaman kategori /tips/kategori/<slug>/, entri sitemap & llms.txt. Ringkasan statis =
 *    teks yang sama dengan halaman React (e2e/static-content.spec.ts).
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Marked, type Tokens } from 'marked';
import { parse as parseYaml } from 'yaml';
import { tipSchema, type BarberEntry, type ContentBundle } from '../src/content/schema';
import {
  RESERVED_TIP_SLUGS,
  TIPS_PATH,
  TIPS_PER_PAGE,
  TIP_CATEGORIES,
  TIP_SLUG,
  TOC_MIN_HEADINGS,
  formatTipDate,
  readingMinutes,
  relatedTips,
  slugify,
  sortTips,
  tipLastModified,
  tipPath,
  tipsPageCount,
  tipsPagePath,
  type TipArticle,
  type TipCategory,
  type TipHeading,
  type TipSummary,
} from '../src/content/tipsSeo';
import { readingLabel, tipsCopy } from '../src/content/tipsCopy';
import { srcSetOf, type ImageMeta } from '../src/lib/responsiveImage';
import { e2eTipFiles } from '../e2e/fixtures/content';

export const TIPS_DIR = path.join('src', 'content', 'tips');

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toWebp = (src: string) => src.replace(/\.(jpe?g|png|gif|tiff?|avif)$/i, '.webp');
/** File asli (jpg/png) yang sudah dikonversi ke .webp → pakai .webp */
export const resolveImage = (src: string, meta: ImageMeta) => (meta[src] ? src : meta[toWebp(src)] ? toWebp(src) : src);

/* ---------- File Markdown ---------- */

/** "---\n<yaml>\n---\n<isi>" → { data, body } (format yaml-frontmatter Pages CMS) */
export function splitFrontmatter(source: string): { data: unknown; body: string } {
  const m = source.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/);
  if (!m) throw new Error('frontmatter (--- ... ---) di awal file tidak ditemukan');
  return { data: parseYaml(m[1]) ?? {}, body: m[2] };
}

interface Rendered {
  html: string;
  headings: TipHeading[];
  /** Teks polos (waktu baca) */
  text: string;
  images: string[];
}

/** Markdown isi artikel → HTML. HTML mentah tidak dieksekusi (ditampilkan sebagai teks) */
export function renderMarkdown(markdown: string, meta: ImageMeta = {}): Rendered {
  const headings: TipHeading[] = [];
  const images: string[] = [];
  const used = new Set<string>();
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens);
        // Judul artikel = H1 halaman; heading di isi mulai dari H2
        const level = Math.min(Math.max(depth, 2), 4);
        if (level !== 2) return `<h${level}>${inner}</h${level}>\n`;
        const text = inner.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        let id = slugify(text) || 'bagian';
        for (let n = 2; used.has(id); n++) id = `${slugify(text) || 'bagian'}-${n}`;
        used.add(id);
        headings.push({ id, text });
        return `<h2 id="${id}">${inner}</h2>\n`;
      },
      html({ text }: Tokens.HTML | Tokens.Tag) {
        return esc(text);
      },
      image({ href, title, text }: Tokens.Image) {
        images.push(href);
        const src = resolveImage(href, meta);
        const size = meta[src];
        const srcset = srcSetOf(src, meta);
        return `<img src="${esc(src)}"${srcset ? ` srcset="${esc(srcset)}" sizes="(min-width: 768px) 42rem, 100vw"` : ''} alt="${esc(text)}"${title ? ` title="${esc(title)}"` : ''}${size ? ` width="${size.width}" height="${size.height}"` : ''} loading="lazy" decoding="async" />`;
      },
      link({ href, title, tokens }: Tokens.Link) {
        const inner = this.parser.parseInline(tokens);
        const external = /^https?:\/\//i.test(href);
        if (/^\s*javascript:/i.test(href)) return inner;
        return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${inner}</a>`;
      },
    },
  });
  const html = (marked.parse(markdown, { async: false }) as string).trim();
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
  return { html, headings, text, images };
}

/* ---------- Muat & validasi ---------- */

export interface TipFile {
  file: string;
  source: string;
}

export interface TipsResult {
  errors: string[];
  /** Artikel berstatus Terbit (terbaru dulu), siap di-build */
  published: TipArticle[];
  /** Jumlah artikel Draf (tidak di-build) */
  drafts: number;
}

/** File artikel: src/content/tips/*.md, atau data uji tetap (build E2E) */
export async function readTipFiles(root: string, fixtures = false): Promise<TipFile[]> {
  if (fixtures) return e2eTipFiles();
  const dir = path.join(root, TIPS_DIR);
  if (!existsSync(dir)) return [];
  const names = (await readdir(dir)).filter((f) => f.endsWith('.md') && !f.startsWith('_') && f.toLowerCase() !== 'readme.md').sort();
  return Promise.all(names.map(async (file) => ({ file, source: await readFile(path.join(dir, file), 'utf8') })));
}

/**
 * Validasi semua artikel (Draf juga, agar admin tahu lebih awal) & siapkan artikel Terbit.
 * `exists(url)`: gambar /uploads/... ada di public/ (atau .webp-nya). `bundle`: relasi penulis & layanan.
 */
export function processTips(
  files: TipFile[],
  { exists, meta = {}, bundle }: { exists: (url: string) => boolean; meta?: ImageMeta; bundle?: Pick<ContentBundle, 'barbers' | 'services'> },
): TipsResult {
  const errors: string[] = [];
  const at = (file: string, where?: string) => `  • tips/${file}${where ? `: ${where}` : ''}`;
  const barbers = new Set((bundle?.barbers ?? []).map((b) => b.name));
  const services = new Set((bundle?.services ?? []).map((s) => s.name));
  const bySlug = new Map<string, string>();
  const published: TipArticle[] = [];
  let drafts = 0;

  for (const { file, source } of files) {
    let raw: { data: unknown; body: string };
    try {
      raw = splitFrontmatter(source);
    } catch (error) {
      errors.push(`${at(file)}: ${(error as Error).message}`);
      continue;
    }
    const result = tipSchema.safeParse({ ...(raw.data as object), body: raw.body });
    if (!result.success) {
      for (const issue of result.error.issues) errors.push(`${at(file, issue.path.join('.') || '(frontmatter)')}: ${issue.message}`);
      continue;
    }
    const t = result.data;
    const base = file.replace(/\.md$/, '');
    const slug = t.slug || base;
    if (!TIP_SLUG.test(slug)) {
      errors.push(`${at(file, 'slug')}: nama file "${file}" bukan slug yang valid; isi Slug (huruf kecil, angka, strip), mis. ${slugify(t.title) || 'cara-merawat-rambut'}`);
      continue;
    }
    if (RESERVED_TIP_SLUGS.includes(slug)) errors.push(`${at(file, 'slug')}: slug "${slug}" dipakai halaman daftar, pilih slug lain`);
    const other = bySlug.get(slug);
    if (other) errors.push(`${at(file, 'slug')}: slug "${slug}" sudah dipakai tips/${other}; ubah Slug salah satunya`);
    bySlug.set(slug, file);
    if (!exists(t.cover)) errors.push(`${at(file, 'cover')}: gambar tidak ditemukan di public${t.cover}`);
    if (t.author && bundle && !barbers.has(t.author)) errors.push(`${at(file, 'author')}: "${t.author}" tidak ada di daftar Barber`);
    const tipServices = (t.services ?? []).filter(Boolean);
    for (const s of tipServices) if (bundle && !services.has(s)) errors.push(`${at(file, 'services')}: layanan "${s}" tidak ada di kartu Layanan`);

    const rendered = renderMarkdown(t.body ?? '', meta);
    for (const img of rendered.images) {
      if (img.startsWith('/') && !exists(img)) errors.push(`${at(file, 'body')}: gambar tidak ditemukan di public${img}`);
    }
    if (t.status !== 'Terbit') {
      drafts++;
      continue;
    }
    published.push({
      slug,
      title: t.title,
      summary: t.summary,
      category: t.category,
      cover: resolveImage(t.cover, meta),
      coverAlt: t.coverAlt,
      ...(t.author ? { author: t.author } : {}),
      publishedAt: t.publishedAt,
      ...(t.updatedAt ? { updatedAt: t.updatedAt } : {}),
      readingMinutes: readingMinutes(rendered.text),
      services: tipServices,
      html: rendered.html,
      headings: rendered.headings,
      keyPoints: (t.keyPoints ?? []).filter(Boolean),
      faq: (t.faq ?? []).map((q) => ({ question: q.question, answer: q.answer })),
    });
  }
  return { errors, published: sortTips(published), drafts };
}

/** Ringkasan (tanpa isi) untuk modul browser virtual:tips, kartu, & artikel terkait */
export const summaryOf = ({ html: _html, headings: _headings, keyPoints: _k, faq: _f, ...summary }: TipArticle): TipSummary => summary;

/* ---------- Head, JSON-LD, ringkasan statis ---------- */

const jsonLdTag = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
const abs = (siteUrl: string, src: string) => `${siteUrl}${src}`;
const ORG_LOGO = '/icon-512.png';

type Site = Pick<ContentBundle['settings'], 'siteUrl' | 'siteName'>;

const publisher = ({ siteUrl, siteName }: Site) => ({
  '@type': 'Organization',
  '@id': `${siteUrl}/#organization`,
  name: siteName,
  url: `${siteUrl}/`,
  logo: { '@type': 'ImageObject', url: `${siteUrl}${ORG_LOGO}`, width: 512, height: 512 },
});

const breadcrumbJsonLd = (site: Site, items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${site.siteUrl}${it.path}` })),
});

/** Penulis artikel (Barber): kotak penulis & JSON-LD Person */
export type TipAuthor = Pick<BarberEntry, 'name' | 'role' | 'photo' | 'specialty' | 'bio' | 'experience'>;

const specialtiesOf = (a?: Pick<TipAuthor, 'specialty'>) => (a?.specialty ?? '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

export function tipJsonLd(t: TipArticle, site: Site, barber?: TipAuthor) {
  const url = `${site.siteUrl}${tipPath(t.slug)}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    mainEntityOfPage: url,
    url,
    headline: t.title,
    description: t.summary,
    image: [abs(site.siteUrl, t.cover)],
    datePublished: t.publishedAt,
    dateModified: tipLastModified(t),
    articleSection: t.category,
    inLanguage: 'id-ID',
    author: t.author
      ? {
          '@type': 'Person',
          name: t.author,
          ...(barber?.role ? { jobTitle: barber.role } : {}),
          ...(barber?.photo ? { image: abs(site.siteUrl, toWebp(barber.photo)) } : {}),
          ...(barber?.bio ? { description: barber.bio } : {}),
          ...(specialtiesOf(barber).length ? { knowsAbout: specialtiesOf(barber) } : {}),
          url: `${site.siteUrl}/#hairstylist`,
          worksFor: { '@id': `${site.siteUrl}/#organization` },
        }
      : { '@type': 'Organization', '@id': `${site.siteUrl}/#organization`, name: site.siteName },
    publisher: publisher(site),
  };
}

/** FAQPage satu artikel (FAQ artikel); undefined bila tanpa FAQ */
export function tipFaqJsonLd(t: Pick<TipArticle, 'slug' | 'faq'>, site: Site) {
  if (!t.faq.length) return undefined;
  const url = `${site.siteUrl}${tipPath(t.slug)}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    url,
    mainEntity: t.faq.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })),
  };
}

/** Artikel satu kategori (atau semua) */
const inCategory = <T extends Pick<TipSummary, 'category'>>(tips: T[], category?: TipCategory) => (category ? tips.filter((t) => t.category === category) : tips);

/** Judul & deskripsi halaman daftar (semua / kategori) */
const listHeading = (category?: TipCategory) =>
  category
    ? { kicker: tipsCopy.categoryKicker, title: category, intro: tipsCopy.categoryIntro[category] }
    : { kicker: tipsCopy.heading.kicker, title: tipsCopy.heading.title, intro: tipsCopy.heading.intro };

export function tipsCollectionJsonLd(all: TipSummary[], site: Site, page = 1, category?: TipCategory) {
  const tips = inCategory(all, category);
  const url = `${site.siteUrl}${tipsPagePath(page, category)}`;
  const start = (page - 1) * TIPS_PER_PAGE;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#collection`,
    url,
    name: category ? `${category} | ${tipsCopy.heading.title} | ${site.siteName}` : `${tipsCopy.heading.title} | ${site.siteName}`,
    description: listHeading(category).intro,
    inLanguage: 'id-ID',
    isPartOf: { '@type': 'WebSite', url: `${site.siteUrl}/`, name: site.siteName },
    publisher: publisher(site),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: tips.length,
      itemListElement: tips.slice(start, start + TIPS_PER_PAGE).map((t, i) => ({
        '@type': 'ListItem',
        position: start + i + 1,
        url: `${site.siteUrl}${tipPath(t.slug)}`,
        name: t.title,
      })),
    },
  };
}

const indexTitle = (siteName: string, page: number, category?: TipCategory) =>
  `${category ? `${category}: ${tipsCopy.heading.title}` : `${tipsCopy.heading.title}: Gaya Rambut, Perawatan & Grooming`}${page > 1 ? ` (Halaman ${page})` : ''} | ${siteName}`;

/** Head /tips/, /tips/halaman/<n>/, /tips/kategori/<slug>/(halaman/<n>/) */
export function tipsIndexHead(all: TipSummary[], site: Site, page = 1, ogImage = '', category?: TipCategory): string {
  const tips = inCategory(all, category);
  const url = `${site.siteUrl}${tipsPagePath(page, category)}`;
  const title = indexTitle(site.siteName, page, category);
  const description = listHeading(category).intro;
  const image = tips[0] ? abs(site.siteUrl, tips[0].cover) : ogImage;
  const crumbs = [{ name: tipsCopy.labels.home, path: '/' }, { name: tipsCopy.heading.title, path: TIPS_PATH }, ...(category ? [{ name: category, path: tipsPagePath(1, category) }] : [])];
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
    jsonLdTag(tipsCollectionJsonLd(all, site, page, category)),
    jsonLdTag(breadcrumbJsonLd(site, crumbs)),
  ].join('\n    ');
}

/** Head halaman artikel (+ preload sampul = LCP) */
export function tipHead(t: TipArticle, site: Site, meta: ImageMeta = {}, barber?: TipAuthor): string {
  const url = `${site.siteUrl}${tipPath(t.slug)}`;
  const title = `${t.title} | ${site.siteName}`;
  const image = abs(site.siteUrl, t.cover);
  const srcset = srcSetOf(t.cover, meta);
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(t.summary)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${esc(t.title)}" />`,
    `<meta property="og:description" content="${esc(t.summary)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:alt" content="${esc(t.coverAlt)}" />`,
    `<meta property="article:published_time" content="${t.publishedAt}" />`,
    `<meta property="article:modified_time" content="${tipLastModified(t)}" />`,
    `<meta property="article:section" content="${esc(t.category)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<link rel="preload" as="image" href="${esc(t.cover)}"${srcset ? ` imagesrcset="${esc(srcset)}" imagesizes="(min-width: 768px) 48rem, 100vw"` : ''} fetchpriority="high" />`,
    jsonLdTag(tipJsonLd(t, site, barber)),
    tipFaqJsonLd(t, site) ? jsonLdTag(tipFaqJsonLd(t, site)) : '',
    jsonLdTag(
      breadcrumbJsonLd(site, [
        { name: tipsCopy.labels.home, path: '/' },
        { name: tipsCopy.heading.title, path: TIPS_PATH },
        { name: t.title, path: tipPath(t.slug) },
      ]),
    ),
  ]
    .filter(Boolean)
    .join('\n    ');
}

/** Kategori yang punya artikel, urut pilihan CMS (chip filter) */
export const tipCategoriesOf = (tips: Pick<TipSummary, 'category'>[]) => TIP_CATEGORIES.filter((c) => tips.some((t) => t.category === c));

/** Kartu artikel (teks sama dengan TipCard React) */
function cardHtml(t: TipSummary, heading: 'h2' | 'h3'): string {
  return `<li><p>${esc(t.category)}</p><${heading}><a href="${tipPath(t.slug)}">${esc(t.title)}</a></${heading}><p>${esc(t.summary)}</p><p><time datetime="${t.publishedAt}">${formatTipDate(t.publishedAt)}</time></p><p>${readingLabel(t.readingMinutes)}</p></li>`;
}

/**
 * Ringkasan statis /tips/ atau /tips/kategori/<slug>/ (halaman `page`): judul, intro, chip kategori (link ke halaman
 * kategori, jalan tanpa JavaScript), kartu, paginasi. `all` = semua artikel terbit (chip dari semua kategori).
 */
export function tipsIndexBody(all: TipSummary[], page = 1, category?: TipCategory): string {
  const tips = inCategory(all, category);
  const pages = tipsPageCount(tips.length);
  const items = tips.slice((page - 1) * TIPS_PER_PAGE, page * TIPS_PER_PAGE);
  const l = tipsCopy.labels;
  const heading = listHeading(category);
  const categories = tipCategoriesOf(all);
  const chip = (label: string, c?: TipCategory) => `<li><a href="${tipsPagePath(1, c)}"${c === category ? ' aria-current="page"' : ''}>${esc(label)}</a></li>`;
  return [
    '<div class="prerender">',
    `<p>${esc(heading.kicker)}</p>`,
    `<h1>${esc(heading.title)}</h1>`,
    `<p>${esc(heading.intro)}</p>`,
    categories.length > 1 ? `<ul>${chip(l.filterAll)}${categories.map((c) => chip(c, c)).join('')}</ul>` : '',
    `<ul>${items.map((t) => cardHtml(t, 'h2')).join('')}</ul>`,
    pages > 1
      ? `<nav><p>${esc(l.pageOf.replace('{page}', String(page)).replace('{pages}', String(pages)))}</p>${page > 1 ? `<a href="${tipsPagePath(page - 1, category)}">${esc(l.previous)}</a>` : ''}${page < pages ? ` <a href="${tipsPagePath(page + 1, category)}">${esc(l.next)}</a>` : ''}</nav>`
      : '',
    '</div>',
  ].join('');
}

/**
 * Ringkasan statis artikel: breadcrumb, kategori, H1, ringkasan, tanggal, penulis, waktu baca, daftar isi, isi, CTA,
 * layanan terkait, artikel terkait. Sampul tidak ditulis di sini (React menampilkannya; preload di head).
 */
export function tipBody(t: TipArticle, all: TipSummary[], author?: TipAuthor): string {
  const l = tipsCopy.labels;
  const a = tipsCopy.authorBox;
  const related = relatedTips(all, summaryOf(t));
  const specialties = specialtiesOf(author);
  return [
    '<div class="prerender">',
    `<nav><a href="/">${esc(l.home)}</a> <a href="${TIPS_PATH}">${esc(tipsCopy.heading.title)}</a> <span>${esc(t.title)}</span></nav>`,
    `<p>${esc(t.category)}</p>`,
    `<h1>${esc(t.title)}</h1>`,
    `<p>${esc(t.summary)}</p>`,
    `<p><span>${esc(l.published)}</span> <time datetime="${t.publishedAt}">${formatTipDate(t.publishedAt)}</time></p>`,
    t.updatedAt && t.updatedAt > t.publishedAt ? `<p><span>${esc(l.updated)}</span> <time datetime="${t.updatedAt}">${formatTipDate(t.updatedAt)}</time></p>` : '',
    `<p>${readingLabel(t.readingMinutes)}</p>`,
    t.author ? `<p><span>${esc(l.author)}</span> <a href="/#hairstylist">${esc(t.author)}</a></p>` : '',
    t.keyPoints.length ? `<h2>${esc(l.keyPoints)}</h2><ul>${t.keyPoints.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : '',
    t.headings.length >= TOC_MIN_HEADINGS ? `<p>${esc(l.toc)}</p><ol>${t.headings.map((h) => `<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join('')}</ol>` : '',
    `<article>${t.html}</article>`,
    t.faq.length ? `<h2>${esc(l.faqTitle)}</h2><dl>${t.faq.map((q) => `<dt>${esc(q.question)}</dt><dd>${esc(q.answer)}</dd>`).join('')}</dl>` : '',
    t.author
      ? [
          `<h2>${esc(a.title)}</h2>`,
          author?.role ? `<p>${esc(author.role)}</p>` : '',
          `<p><a href="/#hairstylist">${esc(t.author)}</a></p>`,
          author?.experience ? `<p><span>${esc(a.experience)}</span> <span>${esc(author.experience)}</span></p>` : '',
          specialties.length ? `<p>${esc(a.specialties)}</p><ul>${specialties.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '',
          author?.bio ? `<p>${esc(author.bio)}</p>` : '',
        ].join('')
      : '',
    `<h2>${esc(tipsCopy.cta.title)}</h2><p>${esc(tipsCopy.cta.text)}</p>`,
    t.services.length ? `<h2>${esc(l.servicesTitle)}</h2><ul>${t.services.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '',
    related.length ? `<h2>${esc(l.relatedTitle)}</h2><ul>${related.map((r) => cardHtml(r, 'h3')).join('')}</ul>` : '',
    '</div>',
  ].join('');
}

/** Data artikel untuk React (dibaca src/lib/tips.ts), di dalam HTML halaman artikel */
export const tipDataTag = (t: TipArticle) => `<script type="application/json" id="tip-article">${JSON.stringify(t).replace(/</g, '\\u003c')}</script>`;

/* ---------- Sitemap & llms.txt ---------- */

/** Entri sitemap: /tips/, halaman daftar berikutnya, & setiap artikel (lastmod = diperbarui/terbit) */
export function tipsSitemapEntries(tips: TipSummary[]): { path: string; lastmod?: string }[] {
  const listPages = (list: TipSummary[], category?: TipCategory) => {
    const newest = list.map(tipLastModified).sort().pop();
    return Array.from({ length: tipsPageCount(list.length) }, (_, i) => ({ path: tipsPagePath(i + 1, category), lastmod: newest }));
  };
  return [
    ...listPages(tips),
    // Halaman kategori: hanya kategori yang punya artikel terbit
    ...tipCategoriesOf(tips).flatMap((c) => listPages(inCategory(tips, c), c)),
    ...tips.map((t) => ({ path: tipPath(t.slug), lastmod: tipLastModified(t) })),
  ];
}

/** Bagian llms.txt: judul + link + ringkasan setiap artikel */
export function tipsLlmsLines(tips: TipSummary[], siteUrl: string): string[] {
  if (!tips.length) return [];
  return ['## Tips & Trik', '', ...tips.map((t) => `- [${t.title}](${siteUrl}${tipPath(t.slug)}): ${t.summary}`), ''];
}

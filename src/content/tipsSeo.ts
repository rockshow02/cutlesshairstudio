/**
 * Halaman Tips & Trik (/tips/ & /tips/<slug>/) mengikuti Pengaturan Situs → Tampilkan Tips & Trik saat build, sama
 * seperti /produk/: mati → HTML /tips/ tidak ikut di-build, /tips & /tips/* dialihkan 301 ke beranda, tidak ada di
 * menu / sitemap / llms.txt. Artikel ditulis di Pages CMS sebagai file Markdown di src/content/tips/.
 * Fungsi murni tanpa Zod & tanpa import runtime: dipakai plugin build (scripts/tips.ts) dan kode browser.
 */
export const TIPS_PATH = '/tips/';

/** Kategori artikel (pilihan "Kategori" di Pages CMS, urutan = urutan filter) */
export const TIP_CATEGORIES = ['Hair Style', 'Hair Care', 'Grooming', 'Produk', 'Tips Barbershop'] as const;
export type TipCategory = (typeof TIP_CATEGORIES)[number];

export const TIP_STATUSES = ['Draf', 'Terbit'] as const;

/** Artikel per halaman daftar; lebih dari ini → /tips/halaman/2/ dst. */
export const TIPS_PER_PAGE = 12;

/** Segmen URL yang dipakai halaman daftar (tidak boleh jadi slug artikel) */
export const RESERVED_TIP_SLUGS = ['halaman', 'kategori'];

export const TIP_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const tipsVisible = (settings: { showTips?: boolean | null }): boolean => settings.showTips === true;

/** Aturan _redirects (Cloudflare Workers static assets) saat halaman Tips mati */
export function tipsRedirects(visible: boolean): string[] {
  return visible ? [] : ['/tips    /   301', '/tips/*  /   301'];
}

/** "Cara Merawat Rambut Ikal!" → "cara-merawat-rambut-ikal" (huruf kecil, kata dipisah strip) */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' dan ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Kategori → bagian URL halaman kategori, mis. "Hair Care" → "hair-care" (/tips/kategori/hair-care/) */
export const categorySlug = (category: string): string => slugify(category);

/** "hair-care" → "Hair Care"; tidak dikenal → undefined */
export const categoryFromSlug = (slug: string | null | undefined): TipCategory | undefined => TIP_CATEGORIES.find((c) => categorySlug(c) === slug);

/** Menit baca (±200 kata/menit, dibulatkan ke atas, minimal 1) dari teks polos isi artikel */
export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export const tipPath = (slug: string): string => `${TIPS_PATH}${slug}/`;

/** Halaman daftar ke-n (semua, atau satu kategori): 1 → /tips/ | /tips/kategori/hair-care/, 2 → …/halaman/2/ */
export const tipsPagePath = (page: number, category?: TipCategory): string => {
  const base = category ? `${TIPS_PATH}kategori/${categorySlug(category)}/` : TIPS_PATH;
  return page <= 1 ? base : `${base}halaman/${page}/`;
};

export type TipsRoute = { kind: 'index'; category?: TipCategory; page: number } | { kind: 'article'; slug: string };

/**
 * URL → halaman Tips: /tips/, /tips/halaman/2/, /tips/kategori/<slug>/(halaman/<n>/), /tips/<slug>/.
 * Kategori tidak dikenal / bukan URL Tips → undefined. Dipakai plugin build (dev server) & browser.
 */
export function parseTipsPath(pathname: string): TipsRoute | undefined {
  const path = pathname.replace(/index\.html$/, '').replace(/\/?$/, '/');
  const index = path.match(/^\/tips\/(?:kategori\/([a-z0-9-]+)\/)?(?:halaman\/(\d+)\/)?$/);
  if (index) {
    const category = index[1] ? categoryFromSlug(index[1]) : undefined;
    if (index[1] && !category) return undefined;
    return { kind: 'index', ...(category ? { category } : {}), page: Math.max(1, Number(index[2] ?? 1)) };
  }
  const article = path.match(/^\/tips\/([a-z0-9-]+)\/$/);
  return article && !RESERVED_TIP_SLUGS.includes(article[1]) ? { kind: 'article', slug: article[1] } : undefined;
}

export const tipsPageCount = (count: number): number => Math.max(1, Math.ceil(count / TIPS_PER_PAGE));

/** Data ringkas satu artikel terbit (kartu, artikel terkait, sitemap, llms.txt, JSON-LD) */
export interface TipSummary {
  slug: string;
  title: string;
  summary: string;
  category: TipCategory;
  cover: string;
  coverAlt: string;
  /** Nama kapster penulis/peninjau (dari Barber), opsional */
  author?: string;
  /** YYYY-MM-DD */
  publishedAt: string;
  updatedAt?: string;
  readingMinutes: number;
  /** Nama kartu Layanan terkait */
  services: string[];
}

/** Daftar H2 untuk daftar isi */
export interface TipHeading {
  id: string;
  text: string;
}

export interface TipFaq {
  question: string;
  answer: string;
}

/** Artikel lengkap (halaman artikel): isi sudah HTML hasil render Markdown saat build */
export interface TipArticle extends TipSummary {
  html: string;
  headings: TipHeading[];
  /** Poin penting (2–5) di bawah sampul; kosong = tidak tampil */
  keyPoints: string[];
  /** FAQ artikel (maks. 5) di akhir artikel + JSON-LD FAQPage */
  faq: TipFaq[];
}

/** Daftar isi hanya bila artikel punya minimal 3 subjudul (H2) */
export const TOC_MIN_HEADINGS = 3;

/** Terbaru dulu (tanggal terbit, lalu judul) */
export const sortTips = <T extends Pick<TipSummary, 'publishedAt' | 'title'>>(tips: T[]): T[] =>
  [...tips].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.title.localeCompare(b.title, 'id'));

/** Tanggal terakhir diubah (sitemap lastmod, dateModified) */
export const tipLastModified = (t: Pick<TipSummary, 'publishedAt' | 'updatedAt'>): string =>
  t.updatedAt && t.updatedAt > t.publishedAt ? t.updatedAt : t.publishedAt;

/**
 * 3 artikel terkait: kategori sama dulu, lalu berbagi layanan terkait, lalu yang terbaru. Artikel itu sendiri tidak
 * ikut. Daftar masukan sudah terurut terbaru dulu (sortTips).
 */
export function relatedTips<T extends Pick<TipSummary, 'slug' | 'category' | 'services'>>(all: T[], current: T, count = 3): T[] {
  const score = (t: T) => (t.category === current.category ? 2 : 0) + (t.services.some((s) => current.services.includes(s)) ? 1 : 0);
  return all
    .filter((t) => t.slug !== current.slug)
    .map((t, i) => ({ t, i, s: score(t) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, count)
    .map((x) => x.t);
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "2026-10-29" → "29 Oktober 2026" (tanpa Intl: hasil build & browser sama persis) */
export function formatTipDate(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

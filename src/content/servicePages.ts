/**
 * Halaman layanan (/layanan/ & /layanan/<slug>/) mengikuti Pengaturan Situs → Tampilkan halaman layanan saat build,
 * sama seperti /tips/: mati → HTML /layanan/ tidak ikut di-build, /layanan & /layanan/* dialihkan 301 ke beranda,
 * tidak ada di menu / sitemap / llms.txt, link "Selengkapnya" di Daftar Harga & Kartu Layanan tidak tampil.
 * Halaman ditulis di Pages CMS sebagai file Markdown di src/content/layanan/. Harga TIDAK ditulis di halaman: diambil
 * dari item Daftar Harga terkait (harga per cabang & "Tersedia di cabang", src/content/branchPricing.ts).
 * Juga: fasilitas & jam buka cabang (halaman cabang + JSON-LD HairSalon).
 * Fungsi murni tanpa Zod & tanpa import runtime selain branchPricing: dipakai plugin build (scripts/layanan.ts) & browser.
 */
import { availableAt, priceAt } from './branchPricing';
import type { PricingEntry } from './schema';

export const SERVICES_PATH = '/layanan/';

export const SERVICE_PAGE_STATUSES = ['Draf', 'Terbit'] as const;

export const SERVICE_PAGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const servicePagesVisible = (settings: { showServicePages?: boolean | null }): boolean => settings.showServicePages === true;

/** Aturan _redirects (Cloudflare Workers static assets) saat halaman layanan mati */
export function servicePagesRedirects(visible: boolean): string[] {
  return visible ? [] : ['/layanan    /   301', '/layanan/*  /   301'];
}

export const servicePagePath = (slug: string): string => `${SERVICES_PATH}${slug}/`;

export type ServicesRoute = { kind: 'index' } | { kind: 'page'; slug: string };

/** URL → /layanan/ (daftar) atau /layanan/<slug>/; bukan URL layanan → undefined */
export function parseServicesPath(pathname: string): ServicesRoute | undefined {
  const path = pathname.replace(/index\.html$/, '').replace(/\/?$/, '/');
  if (path === SERVICES_PATH) return { kind: 'index' };
  const page = path.match(/^\/layanan\/([a-z0-9-]+)\/$/);
  return page ? { kind: 'page', slug: page[1] } : undefined;
}

export interface ServicePhoto {
  src: string;
  alt: string;
}

export interface ServiceFaq {
  question: string;
  answer: string;
}

/** Data ringkas satu halaman layanan terbit (daftar /layanan/, layanan terkait, link "Selengkapnya", sitemap, llms.txt) */
export interface ServicePageSummary {
  slug: string;
  title: string;
  summary: string;
  /** Nama item Daftar Harga terkait (sumber harga per cabang & "Tersedia di cabang") */
  pricingItems: string[];
  /** Nama Kartu Layanan yang diberi link "Selengkapnya" ke halaman ini (opsional) */
  serviceCard?: string;
  /** Catatan harga bila tanpa item Daftar Harga, mis. "Harga menyesuaikan" */
  priceNote?: string;
  /** YYYY-MM-DD (sitemap lastmod) */
  updatedAt?: string;
}

/** Halaman lengkap: isi tambahan sudah HTML hasil render Markdown saat build */
export interface ServicePage extends ServicePageSummary {
  metaDescription: string;
  suitableFor: string[];
  steps: string[];
  duration?: string;
  photos: ServicePhoto[];
  html: string;
  faq: ServiceFaq[];
}

/* ---------- Harga dari Daftar Harga ---------- */

type PricingItem = Pick<PricingEntry, 'name' | 'category' | 'price' | 'priceFrom' | 'description' | 'branchPrices' | 'branchSlugs' | 'isActive' | 'order'>;
type BranchLike = { slug: string; name: string; status: string; order?: number | null };

/** Item Daftar Harga terkait yang aktif, urut "Urutan" Daftar Harga (nama tidak dikenal/nonaktif diabaikan) */
export function linkedItems<T extends PricingItem>(page: Pick<ServicePageSummary, 'pricingItems'>, pricing: T[]): T[] {
  return pricing
    .filter((i) => i.isActive !== false && page.pricingItems.includes(i.name))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export interface ServiceBranchPrice {
  slug: string;
  name: string;
  /** Harga terendah item terkait di cabang ini (harga per cabang menimpa harga utama) */
  from: number;
  items: { name: string; description?: string; price: number; priceFrom: boolean }[];
}

/**
 * Harga "mulai" per cabang Aktif tempat layanan tersedia (urut "Urutan" cabang): item terkait yang tersedia di cabang
 * itu, harga cabang itu. Tanpa item terkait → [] (lihat serviceBranches untuk "Tersedia di cabang").
 */
export function servicePrices(page: Pick<ServicePageSummary, 'pricingItems'>, pricing: PricingItem[], branches: BranchLike[]): ServiceBranchPrice[] {
  const items = linkedItems(page, pricing);
  return [...branches]
    .filter((b) => b.status === 'Aktif')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((b) => {
      const here = items.filter((i) => availableAt(i, b.slug)).map((i) => ({
        name: i.name,
        ...(i.description?.trim() ? { description: i.description.trim() } : {}),
        price: priceAt(i, b.slug),
        priceFrom: Boolean(i.priceFrom),
      }));
      return here.length ? { slug: b.slug, name: b.name, from: Math.min(...here.map((i) => i.price)), items: here } : null;
    })
    .filter((x): x is ServiceBranchPrice => Boolean(x));
}

/**
 * Cabang Aktif tempat layanan tersedia: cabang yang punya item terkait; halaman tanpa item Daftar Harga (mis. harga
 * menyesuaikan) → semua cabang Aktif.
 */
export function serviceBranches<B extends BranchLike>(page: Pick<ServicePageSummary, 'pricingItems'>, pricing: PricingItem[], branches: B[]): B[] {
  const active = [...branches].filter((b) => b.status === 'Aktif').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const items = linkedItems(page, pricing);
  if (!items.length) return active;
  return active.filter((b) => items.some((i) => availableAt(i, b.slug)));
}

/** Kategori Daftar Harga halaman (kategori item terkait pertama); undefined = "Layanan lainnya" */
export const serviceCategory = (page: Pick<ServicePageSummary, 'pricingItems'>, pricing: PricingItem[]): string | undefined =>
  linkedItems(page, pricing)[0]?.category;

/** Urutan halaman: urutan item Daftar Harga terkait pertama, lalu judul (tanpa item → paling akhir) */
export function sortServicePages<T extends Pick<ServicePageSummary, 'pricingItems' | 'title'>>(pages: T[], pricing: PricingItem[]): T[] {
  const rank = (p: T) => linkedItems(p, pricing)[0]?.order ?? Number.MAX_SAFE_INTEGER;
  return [...pages].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, 'id'));
}

/**
 * Halaman dikelompokkan per kategori Daftar Harga (urutan kategori = `categories`, mis. PRICE_CATEGORIES); halaman
 * tanpa item terkait di grup terakhir (category undefined). Kategori tanpa halaman tidak ikut.
 */
export function groupServicePages<T extends Pick<ServicePageSummary, 'pricingItems' | 'title'>>(
  pages: T[],
  pricing: PricingItem[],
  categories: readonly string[],
): { category?: string; pages: T[] }[] {
  const sorted = sortServicePages(pages, pricing);
  const groups = categories.map((c) => ({ category: c as string | undefined, pages: sorted.filter((p) => serviceCategory(p, pricing) === c) }));
  const other = sorted.filter((p) => !serviceCategory(p, pricing) || !categories.includes(serviceCategory(p, pricing)!));
  return [...groups, { category: undefined, pages: other }].filter((g) => g.pages.length > 0);
}

/** 3 layanan terkait: kategori sama dulu, lalu urutan Daftar Harga. Halaman itu sendiri tidak ikut. */
export function relatedServicePages<T extends Pick<ServicePageSummary, 'slug' | 'pricingItems' | 'title'>>(all: T[], current: T, pricing: PricingItem[], count = 3): T[] {
  const category = serviceCategory(current, pricing);
  return sortServicePages(all.filter((p) => p.slug !== current.slug), pricing)
    .map((p, i) => ({ p, i, same: category !== undefined && serviceCategory(p, pricing) === category }))
    .sort((a, b) => Number(b.same) - Number(a.same) || a.i - b.i)
    .slice(0, count)
    .map((x) => x.p);
}

/** Nama item Daftar Harga → slug halaman layanan pertama yang menautkannya (link "Selengkapnya" di baris harga) */
export function pageByPricingItem(pages: Pick<ServicePageSummary, 'slug' | 'pricingItems'>[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of pages) for (const name of p.pricingItems) if (!map.has(name)) map.set(name, p.slug);
  return map;
}

/** Nama Kartu Layanan → slug halaman layanan (link "Selengkapnya" di kartu) */
export function pageByServiceCard(pages: Pick<ServicePageSummary, 'slug' | 'serviceCard'>[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of pages) if (p.serviceCard && !map.has(p.serviceCard)) map.set(p.serviceCard, p.slug);
  return map;
}

/* ---------- Cabang: fasilitas & jam buka ---------- */

/** Fasilitas cabang (pilihan "Fasilitas" di Pages CMS, urutan = urutan tampil) */
export const BRANCH_FACILITIES = [
  'Walk-in diterima',
  'Parkir motor',
  'Parkir mobil',
  'AC',
  'Wi-Fi',
  'Toilet',
  'Ruang tunggu',
  'Tunai',
  'QRIS',
  'Kartu debit/kredit',
  'Transfer bank',
] as const;
export type BranchFacility = (typeof BRANCH_FACILITIES)[number];

/** Fasilitas yang merupakan metode pembayaran (JSON-LD paymentAccepted, bukan amenityFeature) */
export const PAYMENT_FACILITIES: readonly BranchFacility[] = ['Tunai', 'QRIS', 'Kartu debit/kredit', 'Transfer bank'];

/** Fasilitas terpilih, urut BRANCH_FACILITIES, tanpa duplikat */
export const sortFacilities = (list: readonly string[] | null | undefined): BranchFacility[] =>
  BRANCH_FACILITIES.filter((f) => (list ?? []).includes(f));

type HoursRow = { open?: string | null; close?: string | null; closed?: boolean | null };

/**
 * Ringkasan jam buka bila SEMUA 7 hari buka dengan jam sama: { open: "09.00", close: "21.00" } → "Setiap hari
 * 09.00–21.00" + penanda "Buka sampai 21.00". Jam berbeda per hari / ada hari tutup → undefined (tabel jam buka saja).
 */
export function dailyHours(rows: HoursRow[]): { open: string; close: string } | undefined {
  const open = rows.filter((r) => !r.closed && r.open && r.close);
  if (rows.length !== 7 || open.length !== 7) return undefined;
  const first = open[0];
  if (!open.every((r) => r.open === first.open && r.close === first.close)) return undefined;
  return { open: first.open!.replace(':', '.'), close: first.close!.replace(':', '.') };
}

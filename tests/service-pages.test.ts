/**
 * Halaman Layanan & halaman cabang yang diperkaya: skema, harga per cabang dari Daftar Harga (harga per cabang &
 * "Tersedia di cabang"), validasi file Markdown, JSON-LD Service/FAQPage/HairSalon, ringkasan statis, sitemap &
 * llms.txt, toggle, menu navbar. Data uji saja (tidak membaca halaman/cabang CMS), kecuali tes isian awal di akhir.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { z } from 'zod';
import { branchSchema, pricingItemSchema, servicePageSchema, settingsSchema, type ContentBundle } from '../src/content/schema';
import {
  BRANCH_FACILITIES,
  dailyHours,
  groupServicePages,
  pageByPricingItem,
  pageByServiceCard,
  parseServicesPath,
  relatedServicePages,
  serviceBranches,
  servicePagesRedirects,
  servicePrices,
  sortFacilities,
} from '../src/content/servicePages';
import { PRICE_CATEGORIES } from '../src/content/priceCategories';
import { site } from '../src/content/site';
import { buildBranches, buildSite } from '../src/lib/contentTransforms';
import {
  branchDetailsBody,
  branchJsonLdExtra,
  processServicePages,
  serviceJsonLd,
  servicePageBody,
  servicePageHead,
  serviceSummaryOf,
  servicesIndexBody,
  servicesSitemapEntries,
} from '../scripts/layanan';
import { branchJsonLd, llmsTxt, sitemap, waClickAllowlist } from '../scripts/vite-content-plugin';
import { splitFrontmatter } from '../scripts/tips';
import { E2E_SERVICE_PAGES, e2eServicePageFiles } from '../e2e/fixtures/content';
import { sanitizeObject, setMedia, simulateCmsSave, validateCmsContent, type CmsField, type CmsMedia } from './helpers/pagesCms';
import { rawFixture } from './helpers/contentFixture';

const everyDay = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((day) => ({ day, openTime: '09:00', closeTime: '21:00', isClosed: false }));
const branch = (slug: string, name: string, extra: Record<string, unknown> = {}) =>
  branchSchema.parse({ slug, name, city: name, province: 'Jawa Barat', address: `Jl. Uji ${name} No. 1`, whatsappNumber: '6281100000101', openingHours: everyDay, ...extra });

/** Daftar Harga uji: Black berharga lain di Cibubur, "Hanya Bogor" hanya di Bogor, satu item nonaktif */
const pricing = [
  pricingItemSchema.parse({ name: 'White Uji', category: 'Haircut', price: 100000, order: 10, description: 'Haircut + Hair Wash' }),
  pricingItemSchema.parse({ name: 'Black Uji', category: 'Haircut', price: 175000, order: 20, branchPrices: [{ branchSlug: 'cibubur', price: 185000 }] }),
  pricingItemSchema.parse({ name: 'Hanya Bogor Uji', category: 'Haircut', price: 90000, order: 30, branchSlugs: ['bogor'] }),
  pricingItemSchema.parse({ name: 'Keratin Uji', category: 'Special Treatment', price: 300000, priceFrom: true, order: 40 }),
  pricingItemSchema.parse({ name: 'Woman Uji', category: 'Woman Haircut & Treatment', price: 150000, order: 50 }),
  pricingItemSchema.parse({ name: 'Lama Uji', category: 'Coloring', price: 450000, order: 60, isActive: false }),
];
const branches = [
  branch('bogor', 'Bogor', {
    order: 10,
    description: 'Deskripsi Bogor uji.',
    serviceAreas: ['Bantarjati Uji', 'Bogor Utara Uji'],
    directions: 'Patokan uji.',
    facilities: ['QRIS', 'Walk-in diterima', 'Parkir motor', 'Tunai'],
    faq: [{ question: 'Parkir uji?', answer: 'Ada uji.' }],
  }),
  branch('cibubur', 'Cibubur', { order: 20 }),
  branch('baru', 'Baru', { order: 30, status: 'Segera Dibuka' }),
];

const page = (fm: Record<string, unknown>, body = '') =>
  `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n${body}`;
const base = { title: 'Haircut Uji', metaDescription: 'Meta uji.', summary: 'Ringkasan uji.', suitableFor: ['Satu', 'Dua'], status: 'Terbit' };
const services = [{ name: 'Kartu Haircut', description: 'x', icon: 'scissors', order: 0, isActive: true }] as unknown as ContentBundle['services'];

const process = (files: { file: string; source: string }[]) =>
  processServicePages(files, { exists: (url) => url.startsWith('/uploads/layanan/ada'), bundle: { pricing, services } });

const settings = settingsSchema.parse({ ...rawFixture.settings, siteUrl: 'https://cutless.test', siteName: 'Cutless Uji', showServicePages: true });
const bundle = (extra: Partial<ContentBundle> = {}) =>
  ({
    settings,
    branches,
    pricing,
    services,
    shoeCare: { enabled: false, branchSlug: 'bogor', services: [] },
    hero: { kicker: 'x', titleLines: ['x'], subtitle: 'x' },
    faq: { enabled: false, title: 'x', items: [] },
    products: [],
    barbers: [],
    ...extra,
  }) as unknown as ContentBundle;

const { published } = process([
  { file: 'haircut-uji.md', source: page({ ...base, pricingItems: ['White Uji', 'Black Uji', 'Hanya Bogor Uji'], serviceCard: 'Kartu Haircut', faq: [{ question: 'Lama?', answer: '±45 menit.' }] }, '## Sub\n\nIsi.\n\n<script>x()</script>') },
  { file: 'keratin-uji.md', source: page({ ...base, title: 'Keratin Uji Page', pricingItems: ['Keratin Uji'] }) },
  { file: 'anak-uji.md', source: page({ ...base, title: 'Anak Uji', priceNote: 'Harga menyesuaikan.' }) },
  { file: 'draf-uji.md', source: page({ ...base, title: 'Draf Uji', status: 'Draf', suitableFor: [] }) },
]);
const [haircut, keratin, kids] = published;
const list = published.map(serviceSummaryOf);

describe('skema', () => {
  it('halaman: judul ≤ 70, meta ≤ 160, ringkasan ≤ 300, FAQ ≤ 5 (q ≤ 120, a ≤ 400), foto ≤ 6 di /uploads/layanan/', () => {
    const ok = { ...base };
    expect(servicePageSchema.safeParse(ok).success).toBe(true);
    expect(servicePageSchema.safeParse({ ...ok, title: 'x'.repeat(71) }).success).toBe(false);
    expect(servicePageSchema.safeParse({ ...ok, metaDescription: 'x'.repeat(161) }).success).toBe(false);
    expect(servicePageSchema.safeParse({ ...ok, summary: 'x'.repeat(301) }).success).toBe(false);
    expect(servicePageSchema.safeParse({ ...ok, faq: Array.from({ length: 6 }, () => ({ question: 'q?', answer: 'a' })) }).success).toBe(false);
    expect(servicePageSchema.safeParse({ ...ok, faq: [{ question: 'q'.repeat(121), answer: 'a' }] }).success).toBe(false);
    expect(servicePageSchema.safeParse({ ...ok, faq: [{ question: 'q?', answer: 'a'.repeat(401) }] }).success).toBe(false);
    expect(servicePageSchema.safeParse({ ...ok, photos: [{ image: '/uploads/layanan/a.webp', alt: 'A' }] }).success).toBe(true);
    expect(servicePageSchema.safeParse({ ...ok, photos: [{ image: '/uploads/tips/a.webp', alt: 'A' }] }).success).toBe(false);
    expect(servicePageSchema.safeParse({ ...ok, photos: Array.from({ length: 7 }, () => ({ image: '/uploads/layanan/a.webp', alt: 'A' })) }).success).toBe(false);
  });

  it('Cocok untuk: Terbit wajib 2–6 butir; Draf boleh kosong; 1 butir / 1 langkah ditolak', () => {
    expect(servicePageSchema.safeParse({ ...base, suitableFor: [] }).success).toBe(false);
    expect(servicePageSchema.safeParse({ ...base, status: 'Draf', suitableFor: [] }).success).toBe(true);
    expect(servicePageSchema.safeParse({ ...base, status: 'Draf', suitableFor: ['Satu'] }).success).toBe(false);
    expect(servicePageSchema.safeParse({ ...base, suitableFor: Array(7).fill('x') }).success).toBe(false);
    expect(servicePageSchema.safeParse({ ...base, steps: ['Satu'] }).success).toBe(false);
    expect(servicePageSchema.safeParse({ ...base, steps: Array(9).fill('x') }).success).toBe(false);
  });

  it('cabang: field baru opsional (deskripsi ≤ 500, area ≤ 12 × 40, patokan ≤ 400, fasilitas dari daftar, FAQ ≤ 5)', () => {
    expect(branch('a', 'A').description).toBeUndefined();
    expect(branchSchema.safeParse({ ...branch('a', 'A'), description: 'x'.repeat(501) }).success).toBe(false);
    expect(branchSchema.safeParse({ ...branch('a', 'A'), serviceAreas: Array(13).fill('x') }).success).toBe(false);
    expect(branchSchema.safeParse({ ...branch('a', 'A'), serviceAreas: ['x'.repeat(41)] }).success).toBe(false);
    expect(branchSchema.safeParse({ ...branch('a', 'A'), directions: 'x'.repeat(401) }).success).toBe(false);
    expect(branchSchema.safeParse({ ...branch('a', 'A'), facilities: ['Kolam renang'] }).success).toBe(false);
    expect(branchSchema.safeParse({ ...branch('a', 'A'), facilities: ['QRIS', 'QRIS'] }).success).toBe(false);
    expect(branchSchema.safeParse({ ...branch('a', 'A'), faq: Array(6).fill({ question: 'q?', answer: 'a' }) }).success).toBe(false);
  });

  it('Tampilkan halaman layanan: default mati; mati → /layanan* 301 ke beranda', () => {
    expect(settingsSchema.parse({ ...rawFixture.settings, showServicePages: undefined }).showServicePages).toBe(false);
    expect(servicePagesRedirects(false)).toEqual(['/layanan    /   301', '/layanan/*  /   301']);
    expect(servicePagesRedirects(true)).toEqual([]);
    expect(parseServicesPath('/layanan/')).toEqual({ kind: 'index' });
    expect(parseServicesPath('/layanan/haircut-uji/index.html')).toEqual({ kind: 'page', slug: 'haircut-uji' });
    expect(parseServicesPath('/tips/')).toBeUndefined();
  });
});

describe('harga per cabang dari Daftar Harga', () => {
  it('harga per cabang menimpa harga utama, "Tersedia di cabang" dihormati, cabang selain Aktif tidak ikut', () => {
    const prices = servicePrices(haircut, pricing, branches);
    expect(prices.map((b) => [b.slug, b.from, b.items.map((i) => `${i.name}=${i.price}`)])).toEqual([
      ['bogor', 90000, ['White Uji=100000', 'Black Uji=175000', 'Hanya Bogor Uji=90000']],
      ['cibubur', 100000, ['White Uji=100000', 'Black Uji=185000']],
    ]);
    expect(serviceBranches(haircut, pricing, branches).map((b) => b.slug)).toEqual(['bogor', 'cibubur']);
    expect(servicePrices({ pricingItems: ['Hanya Bogor Uji'] }, pricing, branches).map((b) => b.slug)).toEqual(['bogor']);
    expect(serviceBranches({ pricingItems: ['Hanya Bogor Uji'] }, pricing, branches).map((b) => b.slug)).toEqual(['bogor']);
  });

  it('harga mengikuti Daftar Harga (tidak diketik di halaman): ubah harga → halaman ikut berubah', () => {
    const changed = pricing.map((i) => (i.name === 'White Uji' ? { ...i, price: 120000 } : i));
    expect(servicePrices({ pricingItems: ['White Uji'] }, changed, branches)[0].from).toBe(120000);
  });

  it('tanpa item / item nonaktif: tanpa harga, tersedia di semua cabang Aktif', () => {
    expect(servicePrices(kids, pricing, branches)).toEqual([]);
    expect(serviceBranches(kids, pricing, branches).map((b) => b.slug)).toEqual(['bogor', 'cibubur']);
    expect(servicePrices({ pricingItems: ['Lama Uji'] }, pricing, branches)).toEqual([]);
  });

  it('grup per kategori Daftar Harga (tanpa item → terakhir), terkait: kategori sama dulu, link Selengkapnya', () => {
    expect(groupServicePages(list, pricing, PRICE_CATEGORIES).map((g) => [g.category, g.pages.map((p) => p.slug)])).toEqual([
      ['Haircut', ['haircut-uji']],
      ['Special Treatment', ['keratin-uji']],
      [undefined, ['anak-uji']],
    ]);
    expect(relatedServicePages(list, keratin, pricing).map((p) => p.slug)).toEqual(['haircut-uji', 'anak-uji']);
    expect(Object.fromEntries(pageByPricingItem(list))).toEqual({ 'White Uji': 'haircut-uji', 'Black Uji': 'haircut-uji', 'Hanya Bogor Uji': 'haircut-uji', 'Keratin Uji': 'keratin-uji' });
    expect(Object.fromEntries(pageByServiceCard(list))).toEqual({ 'Kartu Haircut': 'haircut-uji' });
  });
});

describe('file Markdown (src/content/layanan/*.md)', () => {
  it('Draf divalidasi tapi tidak di-build; HTML mentah di isi tidak dieksekusi', () => {
    expect(published.map((p) => p.slug)).toEqual(['haircut-uji', 'keratin-uji', 'anak-uji']);
    expect(haircut.html).toContain('&lt;script&gt;');
    expect(haircut.html).not.toContain('<script>');
  });

  it('kesalahan: slug ganda, item Daftar Harga / Kartu Layanan tidak dikenal, foto tidak ada', () => {
    const { errors } = process([
      { file: 'a.md', source: page({ ...base, slug: 'sama' }) },
      { file: 'b.md', source: page({ ...base, slug: 'sama', pricingItems: ['Tidak Ada'], serviceCard: 'Kartu Lain', photos: [{ image: '/uploads/layanan/hilang.webp', alt: 'x' }] }) },
      { file: 'c.md', source: page({ ...base, status: 'Draf', title: 'x'.repeat(71) }) },
    ]);
    expect(errors.join('\n')).toMatch(/slug "sama" sudah dipakai/);
    expect(errors.join('\n')).toMatch(/"Tidak Ada" tidak ada di Daftar Harga/);
    expect(errors.join('\n')).toMatch(/"Kartu Lain" tidak ada di Kartu Layanan/);
    expect(errors.join('\n')).toMatch(/foto tidak ditemukan di public\/uploads\/layanan\/hilang\.webp/);
    expect(errors.join('\n')).toMatch(/layanan\/c\.md: title: maksimal 70 karakter/);
  });
});

describe('JSON-LD, ringkasan statis, sitemap & llms.txt', () => {
  const b = bundle();

  it('Service: provider = HairSalon cabang (@id), areaServed = kota + area, offers per cabang (IDR, harga cabang)', () => {
    const ld = serviceJsonLd(haircut, b);
    expect(ld['@type']).toBe('Service');
    expect(ld.serviceType).toBe('Haircut');
    expect(ld.provider.map((p) => p['@id'])).toEqual(['https://cutless.test/cabang/bogor/#salon', 'https://cutless.test/cabang/cibubur/#salon']);
    expect(ld.areaServed.map((a) => a.name)).toEqual(['Bogor', 'Bantarjati Uji', 'Bogor Utara Uji', 'Cibubur']);
    expect(ld.offers!.map((o) => [o.availableAtOrFrom['@id'], o.price, o.priceCurrency])).toEqual([
      ['https://cutless.test/cabang/bogor/#salon', 90000, 'IDR'],
      ['https://cutless.test/cabang/cibubur/#salon', 100000, 'IDR'],
    ]);
    expect(serviceJsonLd(kids, b).offers).toBeUndefined();
  });

  it('head: title, meta, canonical, Service + FAQPage (bila ada) + BreadcrumbList', () => {
    const head = servicePageHead(haircut, b);
    expect(head).toContain('<title>Haircut Uji | Cutless Uji</title>');
    expect(head).toContain('<meta name="description" content="Meta uji." />');
    expect(head).toContain('<link rel="canonical" href="https://cutless.test/layanan/haircut-uji/" />');
    expect(head).toContain('"@type":"FAQPage"');
    expect(head).toContain('"@type":"BreadcrumbList"');
    expect(servicePageHead(keratin, b)).not.toContain('FAQPage');
  });

  it('ringkasan statis: harga per cabang format K, tersedia di cabang (link), FAQ, layanan terkait; /layanan/ per kategori', () => {
    const body = servicePageBody(haircut, list, b);
    expect(body).toContain('<h3>Bogor</h3><p>mulai 90K</p>');
    expect(body).toContain('<h3>Cibubur</h3><p>mulai 100K</p>');
    expect(body).toContain('<span>Black Uji</span> <span>185K</span>');
    expect(body).toContain('<a href="/cabang/cibubur/">Cibubur</a>');
    expect(body).toContain('<dt>Lama?</dt><dd>±45 menit.</dd>');
    expect(body).toContain('<p>Booking Haircut Uji</p>');
    const index = servicesIndexBody(list, b);
    expect(index.indexOf('<h2>Haircut</h2>')).toBeLessThan(index.indexOf('<h2>Special Treatment</h2>'));
    expect(index).toContain('<h2>Layanan lainnya</h2>');
    expect(index).toContain('<p>Harga menyesuaikan.</p>');
  });

  it('sitemap & llms.txt: hanya saat aktif; harga mulai per cabang; lastmod = Tanggal diperbarui', () => {
    expect(sitemap(b, [], list)).toMatch(/<loc>https:\/\/cutless\.test\/layanan\/haircut-uji\/<\/loc>/);
    expect(servicesSitemapEntries([{ ...list[0], updatedAt: '2026-10-26' }])).toEqual([
      { path: '/layanan/', lastmod: '2026-10-26' },
      { path: '/layanan/haircut-uji/', lastmod: '2026-10-26' },
    ]);
    const llms = llmsTxt(b, [], list);
    expect(llms).toContain('- [Haircut Uji](https://cutless.test/layanan/haircut-uji/): Ringkasan uji. Harga mulai: Bogor 90K, Cibubur 100K.');
    expect(llms).toContain('- [Anak Uji](https://cutless.test/layanan/anak-uji/): Ringkasan uji. Harga menyesuaikan.');
    expect(llms).toContain('- Area sekitar: Bantarjati Uji, Bogor Utara Uji');
    expect(llms).toContain('- Fasilitas & pembayaran: Walk-in diterima, Parkir motor, Tunai, QRIS');
    expect(waClickAllowlist(b, [], list).pages).toContain('/layanan/haircut-uji/');
    const off = bundle({ settings: { ...settings, showServicePages: false } });
    expect(sitemap(off, [], list)).not.toContain('/layanan');
    expect(llmsTxt(off, [], list)).not.toContain('/layanan');
  });
});

describe('halaman cabang', () => {
  const b = bundle();
  const bogor = branches[0];

  it('jam buka sama setiap hari → "Buka sampai 21.00"; jam beda / ada hari tutup → tidak ada', () => {
    expect(dailyHours(everyDay.map((h) => ({ open: h.openTime, close: h.closeTime, closed: h.isClosed })))).toEqual({ open: '09.00', close: '21.00' });
    expect(dailyHours(everyDay.map((h, i) => ({ open: h.openTime, close: i ? h.closeTime : '20:00', closed: false })))).toBeUndefined();
    expect(dailyHours(everyDay.map((h, i) => ({ open: h.openTime, close: h.closeTime, closed: i === 6 })))).toBeUndefined();
  });

  it('ringkasan statis: jam, deskripsi, area, patokan, fasilitas (urut daftar), layanan + harga cabang, FAQ; kosong = tidak tampil', () => {
    const body = branchDetailsBody(bogor, list, b);
    expect(body).toContain('<p>Buka sampai 21.00</p><p>Setiap hari 09.00–21.00</p>');
    expect(body).toContain('<li>Bantarjati Uji</li>');
    expect(body).toContain('<p>Patokan uji.</p>');
    expect(body).toContain('<ul><li>Walk-in diterima</li><li>Parkir motor</li><li>Tunai</li><li>QRIS</li></ul>');
    expect(body).toContain('<a href="/layanan/haircut-uji/">Haircut Uji</a> <span>mulai 90K</span>');
    expect(body).toContain('<dt>Parkir uji?</dt>');
    const cibubur = branchDetailsBody(branches[1], [], b);
    expect(cibubur).toBe('<p>Buka sampai 21.00</p><p>Setiap hari 09.00–21.00</p>');
  });

  it('JSON-LD HairSalon: areaServed, amenityFeature (non-pembayaran), paymentAccepted, hasOfferCatalog berharga cabang + url halaman', () => {
    const ld = branchJsonLd(branches[1], b, list) as Record<string, unknown> & ReturnType<typeof branchJsonLdExtra>;
    expect(ld.areaServed).toEqual([{ '@type': 'Place', name: 'Cibubur' }]);
    expect(ld.amenityFeature).toBeUndefined();
    const black = ld.hasOfferCatalog!.itemListElement.find((o) => o.itemOffered.name === 'Black Uji')!;
    expect([black.price, black.priceCurrency, black.itemOffered.url]).toEqual([185000, 'IDR', 'https://cutless.test/layanan/haircut-uji/']);
    expect(ld.hasOfferCatalog!.itemListElement.map((o) => o.itemOffered.name)).not.toContain('Hanya Bogor Uji');
    const extra = branchJsonLdExtra(bogor, b, []);
    expect(extra.description).toBe('Deskripsi Bogor uji.');
    expect(extra.amenityFeature!.map((a) => a.name)).toEqual(['Walk-in diterima', 'Parkir motor']);
    expect(extra.paymentAccepted).toBe('Tunai, QRIS');
    expect(extra.hasOfferCatalog!.itemListElement[0].itemOffered.url).toBeUndefined();
  });

  it('data browser: field baru dirapikan, fasilitas urut daftar, FAQ kosong dibuang', () => {
    const [built] = buildBranches([{ ...bogor, faq: [...bogor.faq!, { question: ' ', answer: ' ' }] }], 'Cutless');
    expect(built.facilities).toEqual(sortFacilities(bogor.facilities));
    expect(built.faq).toHaveLength(1);
    expect(built.landmark).toBe('Patokan uji.');
    expect(BRANCH_FACILITIES).toContain('Walk-in diterima');
  });
});

describe('menu navbar', () => {
  it('aktif & ada halaman terbit: menu "Layanan" → /layanan/ (jumlah menu sama); mati: tetap #layanan', () => {
    const s = settingsSchema.parse(rawFixture.settings);
    const off = buildSite(s, site, []).nav;
    const on = buildSite(s, site, [], { servicePages: true }).nav;
    expect(on).toHaveLength(off.length);
    expect(off.find((n) => n.label === 'Layanan')).toMatchObject({ sectionId: 'layanan' });
    expect(on.find((n) => n.label === 'Layanan')).toEqual({ label: 'Layanan', href: '/layanan/' });
  });
});

describe('Pages CMS', () => {
  type Collection = { name: string; type?: string; path: string; format?: string; list?: boolean; fields: CmsField[] };
  const config = parse(readFileSync('.pages.yml', 'utf8')) as { media: CmsMedia[]; content: Collection[] };
  setMedia(config.media);
  const layanan = config.content.find((c) => c.name === 'layanan')!;
  const normalized = (value: unknown) => sanitizeObject(JSON.parse(JSON.stringify(servicePageSchema.parse(value))));

  it('koleksi Markdown, pilihan item Daftar Harga & Kartu Layanan disinkronkan, status default Draf', () => {
    expect(layanan).toMatchObject({ type: 'collection', path: 'src/content/layanan', format: 'yaml-frontmatter' });
    const field = (name: string) => layanan.fields.find((f) => f.name === name) as CmsField & { default?: string; options?: { values?: { name: string }[]; multiple?: boolean } };
    expect(field('status').default).toBe('Draf');
    expect(field('pricingItems').options?.multiple).toBe(true);
    const names = (f: ReturnType<typeof field>) => (f.options?.values ?? []).map((v) => v.name).sort();
    const pricingNames = [...new Set((JSON.parse(readFileSync('src/content/pricing.json', 'utf8')) as { name: string }[]).map((p) => p.name))].sort();
    expect(names(field('pricingItems'))).toEqual(pricingNames);
    expect(names(field('serviceCard'))).toEqual([...new Set((JSON.parse(readFileSync('src/content/services.json', 'utf8')) as { name: string }[]).map((s) => s.name))].sort());
    const facilities = config.content.find((c) => c.name === 'branches')!.fields.find((f) => f.name === 'facilities') as { options: { values: string[] } };
    expect(facilities.options.values).toEqual([...BRANCH_FACILITIES]);
  });

  // Simulasi Save: data uji (e2e/fixtures; item & kartu diganti pilihan yang ada di form) & halaman isian awal dibuka lalu
  // disimpan tanpa perubahan
  const asCmsChoice = (d: Record<string, unknown>) => ({
    ...d,
    ...(d.pricingItems ? { pricingItems: ['White Grooming'] } : {}),
    ...(d.serviceCard ? { serviceCard: 'Haircut & Grooming' } : {}),
  });
  const files = [
    ...e2eServicePageFiles().map((f) => ({ name: `uji/${f.file}`, source: f.source, fixture: true })),
    ...readdirSync('src/content/layanan').filter((f) => f.endsWith('.md')).map((f) => ({ name: f, source: readFileSync(`src/content/layanan/${f}`, 'utf8'), fixture: false })),
  ];
  for (const { name, source, fixture } of files) {
    it(`simpan tanpa perubahan: ${name}`, () => {
      const { data, body } = splitFrontmatter(source);
      const original = { ...(fixture ? asCmsChoice(data as Record<string, unknown>) : (data as object)), body };
      const { saved, errors } = simulateCmsSave(layanan, original);
      expect(errors).toEqual([]);
      expect(validateCmsContent(layanan, original)).toEqual([]);
      const parsed = (servicePageSchema as z.ZodType).safeParse(saved);
      expect(parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual([]);
      expect(normalized(saved)).toEqual(normalized(original));
    });
  }
});

describe('isian awal (src/content/layanan/*.md & branches.json)', () => {
  it('semua halaman isian awal berstatus Draf, item Daftar Harga & Kartu Layanan terkait ada', () => {
    const real = { pricing: JSON.parse(readFileSync('src/content/pricing.json', 'utf8')), services: JSON.parse(readFileSync('src/content/services.json', 'utf8')) };
    const files = readdirSync('src/content/layanan').filter((f) => f.endsWith('.md')).map((file) => ({ file, source: readFileSync(`src/content/layanan/${file}`, 'utf8') }));
    const result = processServicePages(files, { exists: () => true, bundle: real });
    expect(result.errors).toEqual([]);
    expect(result.published).toEqual([]);
    expect(result.drafts).toBe(files.length);
  });

  it('data uji E2E: 3 halaman Terbit + 1 Draf', () => {
    expect(e2eServicePageFiles()).toHaveLength(4);
    expect(E2E_SERVICE_PAGES.haircut.pricingItems).toHaveLength(2);
  });
});

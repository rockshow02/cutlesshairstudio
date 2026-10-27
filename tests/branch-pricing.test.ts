/**
 * Harga per cabang: harga per cabang menimpa harga utama, "Tersedia di cabang", pemilih cabang (tampil hanya bila
 * daftar/harga berbeda antar cabang Aktif), JSON-LD priceRange & daftar harga statis per cabang, aturan launch, CMS.
 * Data uji sendiri (bukan pricing.json/branches.json, yang bisa berubah dari CMS kapan saja).
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { branchSchema, CONTENT_FILES, crossCheck, pricingItemSchema, type BranchEntry, type PricingEntry } from '../src/content/schema';
import { availableAt, priceAt, priceRangeAt, samePricesEverywhere } from '../src/content/branchPricing';
import { pricingCopy } from '../src/content/pricing';
import { buildPricing, buildServices } from '../src/lib/contentTransforms';
import { servicesCopy } from '../src/content/services';
import { PriceRows } from '../src/components/sections/Pricing';
import { branchPriceList, branchPriceRange } from '../scripts/vite-content-plugin';
import { syncBranchOptions } from '../scripts/sync-pages-config.mjs';
import type { Branch } from '../src/types';
import { setMedia, validateCmsContent, type CmsField, type CmsMedia } from './helpers/pagesCms';
import { contentFixture } from './helpers/contentFixture';

const item = (name: string, category: string, price: number, extra: Record<string, unknown> = {}): PricingEntry =>
  pricingItemSchema.parse({ name, category, price, ...extra });
const BASE = [
  item('White Grooming', 'Haircut', 100000),
  item('Black Grooming', 'Haircut', 175000),
  item('Coloring Fashion', 'Special Treatment', 400000, { priceFrom: true }),
  item('Item Lama', 'Haircut', 90000, { isActive: false, branchPrices: [{ branchSlug: 'cibubur', price: 1 }] }),
];
/** (b) satu item berbeda harga di Cibubur; (c) satu layanan hanya di Bogor */
const DIFFERENT = BASE.map((i) => (i.name === 'Black Grooming' ? { ...i, branchPrices: [{ branchSlug: 'cibubur', price: 185000 }] } : i));
const BOGOR_ONLY = [...BASE, item('Hanya Bogor', 'Haircut', 120000, { branchSlugs: ['bogor-bantarjati'] })];

const branch = (slug: string, name: string, status = 'Aktif') => ({ slug, name, status, pageUrl: `/cabang/${slug}/` }) as unknown as Branch;
const BRANCHES = [branch('bogor-bantarjati', 'Bogor Bantarjati'), branch('cibubur', 'Cibubur'), branch('depok', 'Depok', 'Segera Dibuka')];
const ACTIVE = ['bogor-bantarjati', 'cibubur'];
const pricing = (entries: PricingEntry[], slug?: string) => buildPricing(entries, pricingCopy, BRANCHES, slug);
const rows = (entries: PricingEntry[], slug?: string) =>
  pricing(entries, slug).categories.flatMap((c) => c.items.map((i) => `${i.name} ${i.priceFrom ? 'mulai ' : ''}${i.price}`));

describe('harga per cabang', () => {
  it('harga per cabang menimpa harga utama hanya untuk cabang itu; "Tersedia di cabang" kosong = semua cabang', () => {
    const black = DIFFERENT[1];
    expect(priceAt(black, 'cibubur')).toBe(185000);
    expect(priceAt(black, 'bogor-bantarjati')).toBe(175000);
    expect(availableAt(BASE[0], 'cibubur')).toBe(true);
    expect(availableAt(BOGOR_ONLY[4], 'cibubur')).toBe(false);
    expect(availableAt(BOGOR_ONLY[4], 'bogor-bantarjati')).toBe(true);
  });

  it('(a) semua harga sama → uniform (pemilih tersembunyi, "Berlaku di semua cabang")', () => {
    expect(samePricesEverywhere(BASE, ACTIVE)).toBe(true);
    // Harga per cabang yang sama dengan harga utama tetap dihitung sama; item nonaktif diabaikan
    const same = BASE.map((i, n) => (n === 0 ? { ...i, branchPrices: [{ branchSlug: 'cibubur', price: i.price }] } : i));
    expect(samePricesEverywhere(same, ACTIVE)).toBe(true);
    const data = pricing(BASE);
    expect(data.uniform).toBe(true);
    // Belum memilih cabang → cabang Aktif pertama; pilihan untuk pemilih = cabang Aktif saja
    expect(data.branchName).toBe('Bogor Bantarjati');
    expect(data.branchOptions.map((b) => b.slug)).toEqual(ACTIVE);
  });

  it('(b) satu item berbeda harga di Cibubur → pemilih muncul, harga berpindah per cabang', () => {
    expect(samePricesEverywhere(DIFFERENT, ACTIVE)).toBe(false);
    expect(pricing(DIFFERENT).uniform).toBe(false);
    expect(rows(DIFFERENT, 'bogor-bantarjati')).toEqual(['White Grooming 100000', 'Black Grooming 175000', 'Coloring Fashion mulai 400000']);
    expect(rows(DIFFERENT, 'cibubur')).toEqual(['White Grooming 100000', 'Black Grooming 185000', 'Coloring Fashion mulai 400000']);
    // Cabang Segera Dibuka (halaman cabangnya) tetap memakai harga utama
    expect(pricing(DIFFERENT, 'depok').branchName).toBe('Depok');
  });

  it('(c) layanan hanya di Bogor → tersembunyi di Cibubur; pemilih muncul', () => {
    expect(samePricesEverywhere(BOGOR_ONLY, ACTIVE)).toBe(false);
    expect(rows(BOGOR_ONLY, 'bogor-bantarjati')).toContain('Hanya Bogor 120000');
    expect(rows(BOGOR_ONLY, 'cibubur')).not.toContain('Hanya Bogor 120000');
    // Cabang Segera Dibuka tidak ikut menentukan pemilih
    expect(samePricesEverywhere(BASE.concat(item('Hanya Depok', 'Haircut', 1, { branchSlugs: ['depok'] })), ACTIVE)).toBe(true);
  });

  it('format "K" & "Start from" berlaku untuk harga per cabang', () => {
    const special = DIFFERENT.map((i) => (i.name === 'Coloring Fashion' ? { ...i, branchPrices: [{ branchSlug: 'cibubur', price: 425000 }] } : i));
    const category = pricing(special, 'cibubur').categories.find((c) => c.id === 'Special Treatment')!;
    const html = renderToStaticMarkup(createElement(PriceRows, { category, priceFromLabel: pricingCopy.priceFromLabel }));
    expect(html).toMatch(/Start from<\/small>425K/);
    expect(renderToStaticMarkup(createElement(PriceRows, { category: pricing(DIFFERENT, 'cibubur').categories[0], priceFromLabel: 'Start from' }))).toContain('185K');
  });

  it('Kartu Layanan tetap tanpa harga; "Lihat harga" hanya bila kategori punya layanan di cabang itu', () => {
    const cards = [{ name: 'Haircut', description: 'x', pricingCategory: 'Haircut', isActive: true, order: 0 }] as never;
    const onlyBogor = [item('Hanya Bogor', 'Haircut', 120000, { branchSlugs: ['bogor-bantarjati'] })];
    expect(buildServices(cards, servicesCopy, onlyBogor, 'bogor-bantarjati').items[0].priceHref).toBe('#harga-haircut');
    expect(buildServices(cards, servicesCopy, onlyBogor, 'cibubur').items[0].priceHref).toBeUndefined();
    for (const s of buildServices(cards, servicesCopy, DIFFERENT, 'cibubur').items) expect(Object.keys(s)).not.toContain('startingPrice');
  });
});

describe('halaman cabang & SEO', () => {
  it('JSON-LD priceRange & daftar harga statis dari harga cabang itu', () => {
    const bogor = { slug: 'bogor-bantarjati', name: 'Bogor Bantarjati' };
    const cibubur = { slug: 'cibubur', name: 'Cibubur' };
    expect(priceRangeAt(BOGOR_ONLY, 'cibubur')).toEqual({ min: 100000, max: 400000 });
    expect(branchPriceRange(bogor, { pricing: DIFFERENT })).toBe('Rp100.000 - Rp400.000');
    const cheap = DIFFERENT.map((i) => (i.name === 'White Grooming' ? { ...i, branchPrices: [{ branchSlug: 'cibubur', price: 60000 }] } : i));
    expect(branchPriceRange(cibubur, { pricing: cheap })).toBe('Rp60.000 - Rp400.000');
    expect(branchPriceRange(cibubur, { pricing: [] })).toBeUndefined();
    const html = branchPriceList(cibubur, { pricing: BOGOR_ONLY.concat(DIFFERENT[1]) });
    expect(html).toContain('<p>Harga cabang Cibubur</p><h3>Haircut</h3>');
    expect(html).toContain('<li><span>Coloring Fashion</span> <small>Start from</small> <span>400K</span></li>');
    expect(html).not.toContain('Hanya Bogor');
    expect(branchPriceList(bogor, { pricing: BOGOR_ONLY })).toContain('<li><span>Hanya Bogor</span> <span>120K</span></li>');
  });
});

describe('validasi', () => {
  const branchEntry = (slug: string, name: string, status = 'Aktif'): BranchEntry =>
    branchSchema.parse({
      slug,
      name,
      city: name,
      province: 'Jawa Barat',
      address: 'Jl. Uji No. 1',
      whatsappNumber: '6281100000101',
      status,
      openingHours: [{ day: 'Senin', openTime: '09:00', closeTime: '21:00', isClosed: false }],
    });
  const base = contentFixture();
  const check = (pricingEntries: PricingEntry[]) => {
    const r = crossCheck({ ...base, branches: [branchEntry('bogor-bantarjati', 'Bogor Bantarjati'), branchEntry('cibubur', 'Cibubur'), branchEntry('depok', 'Depok', 'Segera Dibuka')], pricing: pricingEntries });
    return { errors: r.errors.filter((i) => i.file === 'pricing.json'), launch: r.launch.filter((i) => i.file === 'pricing.json') };
  };

  it('harga sama di semua cabang (atau berbeda) bukan masalah launch', () => {
    expect(check(BASE)).toEqual({ errors: [], launch: [] });
    expect(check(DIFFERENT)).toEqual({ errors: [], launch: [] });
    expect(check(BOGOR_ONLY)).toEqual({ errors: [], launch: [] });
  });

  it('cabang Aktif tanpa satu pun layanan akibat "Tersedia di cabang" ditolak; cabang lain/Segera Dibuka tidak', () => {
    const allBogor = BASE.map((i) => ({ ...i, branchSlugs: ['bogor-bantarjati'] }));
    expect(check(allBogor).launch.map((i) => i.message)).toEqual(['cabang Aktif "Cibubur" tidak punya satu pun layanan di Daftar Harga (cek "Tersedia di cabang")']);
    // Hanya item aktif yang dihitung
    const onlyInactiveAtCibubur = BASE.map((i) => (i.isActive === false ? i : { ...i, branchSlugs: ['bogor-bantarjati'] }));
    expect(check(onlyInactiveAtCibubur).launch).toHaveLength(1);
  });

  it('cabang tidak dikenal di "Tersedia di cabang" = error struktur', () => {
    expect(check([item('A', 'Haircut', 1, { branchSlugs: ['bekasi'] })]).errors[0].message).toMatch(/cabang "bekasi" tidak ada/);
  });
});

describe('CMS Daftar Harga', () => {
  const config = parse(readFileSync('.pages.yml', 'utf8')) as { media: CmsMedia[]; content: { name: string; path: string; fields: CmsField[] }[] };
  const cms = config.content.find((c) => c.path === 'src/content/pricing.json')!;
  const f = (name: string) => cms.fields.find((x) => x.name === name)! as CmsField & { label: string; description: string };

  it('label & deskripsi jelas; "Tersedia di cabang" multi-pilih berisi cabang', () => {
    expect(f('price').label).toBe('Harga utama (Rupiah)');
    expect(f('branchPrices').label).toBe('Harga per cabang');
    expect(f('branchPrices').description).toMatch(/angka saja tanpa titik, mis\. 120000/);
    expect(f('branchSlugs')).toMatchObject({ label: 'Tersedia di cabang', type: 'select', options: { multiple: true } });
    expect(f('branchSlugs').required).toBeFalsy();
    expect(f('branchSlugs').description).toMatch(/Kosongkan = tersedia di SEMUA cabang/);
    // Pilihan diisi workflow sinkron dari branches.json (bisa tertinggal sesaat setelah admin menambah cabang)
    expect(f('branchSlugs').options!.values!.length).toBeGreaterThan(0);
  });

  it('sinkron pilihan cabang (npm run sync-cms): semua dropdown cabang diisi dari daftar cabang, urut Urutan (data uji)', () => {
    const yaml = readFileSync('.pages.yml', 'utf8');
    const branches = [
      { slug: 'depok', name: 'Depok Margonda', city: 'Depok', order: 30 },
      { slug: 'bogor-bantarjati', name: 'Bogor Bantarjati', city: 'Bogor', order: 10 },
      { slug: 'cibubur', name: 'Cibubur', city: 'Cibubur', order: 20 },
      { slug: '', name: 'Tanpa slug' },
    ];
    const { text, blocks } = syncBranchOptions(yaml, branches);
    expect(blocks).toBeGreaterThanOrEqual(4);
    const synced = parse(text) as { content: { path: string; fields: CmsField[] }[] };
    const options = synced.content.find((c) => c.path === 'src/content/pricing.json')!.fields.find((x) => x.name === 'branchSlugs')!.options!.values as { name: string; label: string }[];
    expect(options).toEqual([
      { name: 'bogor-bantarjati', label: 'Bogor Bantarjati' },
      { name: 'cibubur', label: 'Cibubur' },
      { name: 'depok', label: 'Depok Margonda' },
    ]);
    // Berjalan ulang dengan daftar yang sama tidak mengubah apa pun
    expect(syncBranchOptions(text, branches).text).toBe(text);
  });

  it('form CMS & Zod sepakat: "Tersedia di cabang" kosong, satu, atau beberapa cabang (data uji)', () => {
    setMedia(config.media);
    const row = { name: 'Uji', category: 'Haircut', price: 100000, priceFrom: false, order: 0, isActive: true };
    for (const branchSlugs of [[], ['bogor-bantarjati'], ['bogor-bantarjati', 'cibubur']]) {
      const content = [{ ...row, branchSlugs, branchPrices: [{ branchSlug: 'cibubur', price: 120000 }] }];
      expect(validateCmsContent(cms, content)).toEqual([]);
      expect(CONTENT_FILES['pricing.json'].safeParse(content).success).toBe(true);
    }
    expect(validateCmsContent(cms, [{ ...row, branchSlugs: ['bekasi'] }])[0]).toMatch(/bekasi/);
  });

  it('pricing.json saat ini (apa pun isi dari CMS) lolos form & Zod', () => {
    setMedia(config.media);
    const raw = JSON.parse(readFileSync('src/content/pricing.json', 'utf8'));
    expect(validateCmsContent(cms, raw)).toEqual([]);
    expect(CONTENT_FILES['pricing.json'].safeParse(raw).success).toBe(true);
  });
});

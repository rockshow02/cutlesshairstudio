/** Kartu Layanan deskriptif tanpa harga, tautan "Lihat harga", meta description dari kategori aktif, CMS. Data uji sendiri. */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { crossCheck, pricingItemSchema, serviceCardSchema, type PricingEntry, type ServiceCardEntry } from '../src/content/schema';
import { servicesCopy } from '../src/content/services';
import { activeCategoryNames, branchDescription, fitDescription, homeDescription, joinList, META_MAX } from '../src/content/serviceSeo';
import { buildServices } from '../src/lib/contentTransforms';
import { categoryFromHash } from '../src/lib/priceCategoryEvent';
import { renderToStaticMarkup } from 'react-dom/server';
import { ServiceCardView } from '../src/components/sections/Services';
import { setMedia, validateCmsContent, type CmsField, type CmsMedia } from './helpers/pagesCms';
import { contentFixture } from './helpers/contentFixture';

const price = (name: string, category: string, value: number, extra: Record<string, unknown> = {}): PricingEntry =>
  pricingItemSchema.parse({ name, category, price: value, ...extra });
const card = (name: string, extra: Record<string, unknown> = {}): ServiceCardEntry =>
  serviceCardSchema.parse({ name, description: `Deskripsi ${name}`, ...extra });

const PRICING = [
  price('White Grooming', 'Haircut', 100000),
  price('Coloring Fashion', 'Special Treatment', 400000, { priceFrom: true }),
  price('Woman Haircut', 'Woman Haircut & Treatment', 150000),
  price('Coloring Highlight', 'Coloring', 450000, { isActive: false }),
  price('Student Deal', 'Paket', 60000),
];
const CARDS = [
  card('Coloring', { pricingCategory: 'Special Treatment', order: 30 }),
  card('Haircut & Grooming', { pricingCategory: 'Haircut', order: 10 }),
  card('Perming', { pricingCategory: 'Special Treatment', order: 40 }), // dua kartu satu kategori: boleh
  card('Highlight', { pricingCategory: 'Coloring', order: 50 }), // kategori tanpa item aktif → tanpa tautan
  card('Konsultasi', { order: 60 }), // tanpa kategori
  card('Hair Tattoo', { order: 70, isActive: false }),
];

describe('kartu Layanan tanpa harga', () => {
  it('semua kartu tampil berurutan (tanpa harga); "Lihat harga" hanya bila kategori punya item aktif', () => {
    const { items, heading } = buildServices(CARDS, servicesCopy, PRICING);
    expect(heading).toEqual(servicesCopy.heading);
    expect(items.map((s) => [s.name, s.priceHref ?? null])).toEqual([
      ['Haircut & Grooming', '#harga-haircut'],
      ['Coloring', '#harga-special-treatment'],
      ['Perming', '#harga-special-treatment'],
      ['Highlight', null],
      ['Konsultasi', null],
    ]);
    for (const s of items) expect(Object.keys(s)).not.toContain('startingPrice');
  });

  it('tampilan kartu: tidak ada "mulai Rp"/"Tanya harga"; ada "Lihat harga" & "Booking"', () => {
    const [withLink, , , noLink] = buildServices(CARDS, servicesCopy, PRICING).items;
    const html = (s: (typeof withLink)) => renderToStaticMarkup(createElement(ServiceCardView, { service: s, index: 0, bookHref: 'https://wa.me/62811', viewPriceLabel: 'Lihat harga', bookLabel: 'Booking' }));
    expect(html(withLink)).toContain('href="#harga-haircut"');
    expect(html(withLink)).toContain('Lihat harga');
    expect(html(withLink)).not.toMatch(/Rp|Tanya harga|mulai/);
    expect(html(noLink)).not.toContain('Lihat harga');
    expect(html(noLink)).toContain('Booking');
  });

  it('tidak ada lagi aturan launch "satu kartu per kategori"', () => {
    const bundle = contentFixture();
    expect(crossCheck({ ...bundle, pricing: PRICING, services: CARDS }).launch.filter((i) => i.file === 'services.json')).toEqual([]);
    expect(crossCheck({ ...bundle, pricing: PRICING, services: [] }).launch.filter((i) => i.file === 'services.json')).toEqual([]);
  });

  it('hash #harga-<kategori> memilih tab kategori', () => {
    const keys = ['Haircut', 'Special Treatment', 'Woman Haircut & Treatment'];
    expect(categoryFromHash(keys, '#harga-special-treatment')).toBe('Special Treatment');
    expect(categoryFromHash(keys, '#harga-woman-haircut-dan-treatment')).toBe('Woman Haircut & Treatment');
    expect(categoryFromHash(keys, '#harga')).toBeUndefined();
  });
});

describe('meta description dari kategori aktif', () => {
  const names = activeCategoryNames(PRICING);
  it('kategori dengan item aktif, urut Daftar Harga, tanpa Paket', () => {
    expect(names).toEqual(['Haircut', 'Special Treatment', 'Woman Haircut & Treatment']);
    expect(joinList(['A', 'B'])).toBe('A dan B');
    expect(joinList(['A', 'B', 'C'])).toBe('A, B, dan C');
  });

  it('beranda & cabang ≤ 160 karakter, menyebut kategori aktif', () => {
    expect(homeDescription('Cutless Hair Studio', 'Bogor', names)).toBe(
      'Cutless Hair Studio, hair studio di Bogor: Haircut, Special Treatment, dan Woman Haircut & Treatment. Booking via WhatsApp.',
    );
    const branch = branchDescription('Cutless Hair Studio', 'Bogor Bantarjati', names, true);
    expect(branch).toContain('Haircut, Special Treatment, dan Woman Haircut & Treatment');
    expect(branch).toContain('cuci sepatu');
    expect(branch.length).toBeLessThanOrEqual(META_MAX);
    expect(branchDescription('Cutless', 'X', names, false)).not.toContain('cuci sepatu');
  });

  it('terlalu panjang → kategori belakang diganti "dan lainnya", tidak pernah lewat 160', () => {
    const many = ['Haircut', 'Special Treatment', 'Woman Haircut & Treatment', 'Haircut & Grooming', 'Braids & Dreadlock', 'Shaving', 'Kids'];
    for (let n = 0; n <= many.length; n++) {
      expect(branchDescription('Cutless Hair Studio', 'Bogor Bantarjati', many.slice(0, n), true).length).toBeLessThanOrEqual(META_MAX);
      expect(homeDescription('Cutless Hair Studio', 'Bogor & Cibubur', many.slice(0, n)).length).toBeLessThanOrEqual(META_MAX);
    }
    expect(branchDescription('Cutless Hair Studio', 'Bogor Bantarjati', many, true)).toMatch(/, dan lainnya\. Ada juga layanan cuci sepatu\./);
    expect(fitDescription('x'.repeat(200), ['A'], '.').length).toBeLessThanOrEqual(META_MAX);
  });
});

describe('CMS Kartu Layanan', () => {
  const config = parse(readFileSync('.pages.yml', 'utf8')) as { media: CmsMedia[]; content: { name: string; path: string; list?: boolean; fields: CmsField[] }[] };
  const cms = config.content.find((c) => c.path === 'src/content/services.json')!;
  const raw = JSON.parse(readFileSync('src/content/services.json', 'utf8')) as Record<string, unknown>[];

  it('kategori harga opsional; batas karakter; isi saat ini lolos form', () => {
    expect(cms).toMatchObject({ name: 'services', label: 'Kartu Layanan', list: true });
    const f = (n: string) => cms.fields.find((x) => x.name === n)!;
    expect(f('name').options?.maxlength).toBe(40);
    expect(f('description').options?.maxlength).toBe(160);
    expect(f('pricingCategory').required).toBeFalsy();
    expect(f('pricingCategory').options?.values).not.toContain('Paket');
    setMedia(config.media);
    expect(validateCmsContent(cms, raw)).toEqual([]);
    const ok = { name: 'Uji', description: 'Deskripsi' };
    expect(validateCmsContent(cms, [ok])).toEqual([]);
    expect(serviceCardSchema.safeParse(ok).success).toBe(true);
    expect(serviceCardSchema.safeParse({ ...ok, pricingCategory: '' }).success).toBe(true);
    expect(validateCmsContent(cms, [{ ...ok, name: 'x'.repeat(41) }])[0]).toMatch(/lebih dari 40/);
    expect(validateCmsContent(cms, [{ ...ok, pricingCategory: 'Paket' }])[0]).toMatch(/pricingCategory: bukan pilihan/);
    expect(serviceCardSchema.safeParse({ ...ok, pricingCategory: 'Paket' }).success).toBe(false);
  });
});

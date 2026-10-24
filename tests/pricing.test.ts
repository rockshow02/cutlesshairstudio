/** Daftar Harga: 3 kategori aktif berurutan, format "K" + "Start from", deskripsi, paket tidak berubah. Data uji sendiri. */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { pricingCopy } from '../src/content/pricing';
import { PRICE_CATEGORIES, priceCategoryAnchor } from '../src/content/priceCategories';
import { pricingItemSchema, type PricingEntry } from '../src/content/schema';
import { buildPricing } from '../src/lib/contentTransforms';
import { formatRupiah, formatThousandsK } from '../src/lib/format';
import { PriceRows } from '../src/components/sections/Pricing';

const item = (name: string, category: string, price: number, extra: Record<string, unknown> = {}): PricingEntry =>
  pricingItemSchema.parse({ name, category, price, ...extra });

const ENTRIES = [
  item('Woman Haircut', 'Woman Haircut & Treatment', 150000, { description: 'Haircut + Hair Wash', order: 140 }),
  item('White Grooming', 'Haircut', 100000, { description: 'Haircut + Hair Wash', order: 10 }),
  item('Coloring Fashion', 'Special Treatment', 400000, { priceFrom: true, description: 'Fashion / trend hair coloring', order: 60 }),
  item('Dreadlock', 'Special Treatment', 1500000, { priceFrom: true, order: 110 }),
  item('Hair Wash', 'Special Treatment', 30000, { order: 40 }),
  item('Coloring Highlight', 'Coloring', 450000, { isActive: false }), // kategori lama, nonaktif
  item('Cutless Pass', 'Paket', 260000, { isActive: false }),
];

describe('format "K" khusus Daftar Harga', () => {
  it('ribuan + K, tanpa Rp & pemisah ribuan', () => {
    expect(formatThousandsK(100000)).toBe('100K');
    expect(formatThousandsK(1500000)).toBe('1500K');
    expect(formatThousandsK(30000)).toBe('30K');
    expect(formatThousandsK(12500)).toBe('12,5K');
    expect(formatThousandsK(500)).toBe('0,5K');
    expect(formatThousandsK(0)).toBe('0K');
    // Rupiah biasa (paket, dll.) tidak berubah
    expect(formatRupiah(260000)).toMatch(/^Rp\s260\.000$/);
  });
});

describe('daftar harga', () => {
  it('kategori aktif = Haircut, Special Treatment, Woman Haircut & Treatment (urutan ini); kategori lama tetap di enum', () => {
    expect(PRICE_CATEGORIES.slice(0, 3)).toEqual(['Haircut', 'Special Treatment', 'Woman Haircut & Treatment']);
    for (const old of ['Haircut & Grooming', 'Wanita', 'Treatment', 'Coloring', 'Perming', 'Braids & Dreadlock', 'Shaving', 'Kids', 'Paket']) {
      expect(PRICE_CATEGORIES).toContain(old);
    }
    const p = buildPricing(ENTRIES, pricingCopy, []);
    expect(p.categories.map((c) => [c.name, c.items.map((i) => i.name)])).toEqual([
      ['Haircut', ['White Grooming']],
      ['Special Treatment', ['Hair Wash', 'Coloring Fashion', 'Dreadlock']],
      ['Woman Haircut & Treatment', ['Woman Haircut']],
    ]);
    expect(p.packages).toEqual([]);
    expect(p.priceFromLabel).toBe('Start from');
  });

  it('deskripsi & "Start from" (priceFrom) per item', () => {
    const special = buildPricing(ENTRIES, pricingCopy, []).categories[1].items;
    expect(special.map((i) => [i.name, i.description, i.priceFrom])).toEqual([
      ['Hair Wash', undefined, false],
      ['Coloring Fashion', 'Fashion / trend hair coloring', true],
      ['Dreadlock', undefined, true],
    ]);
  });

  it('tampilan: "Start from" + harga K, deskripsi di bawah nama (tidak ada bila kosong)', () => {
    const category = buildPricing(ENTRIES, pricingCopy, []).categories[1];
    const html = renderToStaticMarkup(createElement(PriceRows, { category, priceFromLabel: 'Start from' }));
    expect(html).toContain('Start from</small>400K');
    expect(html).toContain('Start from</small>1500K');
    expect(html).toMatch(/Hair Wash<\/span>|Hair Wash(?!<small)/);
    expect(html).not.toMatch(/Hair Wash<small/);
    expect(html).toContain('Coloring Fashion<small>Fashion / trend hair coloring</small>');
    expect(html).not.toContain('Rp');
    expect(html.match(/Start from/g)).toHaveLength(2);
  });

  it('anchor kategori untuk tautan "Lihat harga"', () => {
    expect(priceCategoryAnchor('Special Treatment')).toBe('harga-special-treatment');
    expect(priceCategoryAnchor('Woman Haircut & Treatment')).toBe('harga-woman-haircut-dan-treatment');
  });

  it('pricing.json saat ini lolos skema', () => {
    const raw = JSON.parse(readFileSync('src/content/pricing.json', 'utf8')) as unknown[];
    for (const r of raw) expect(pricingItemSchema.safeParse(r).success).toBe(true);
  });
});

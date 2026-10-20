/** Daftar Harga: paket nonaktif tidak tampil (sub-judul "Paket & Membership" ikut hilang), urutan kategori. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pricingCopy } from '../src/content/pricing';
import { PRICE_CATEGORIES } from '../src/content/priceCategories';
import { buildPricing } from '../src/lib/contentTransforms';
import type { PricingEntry } from '../src/content/schema';

const entries = JSON.parse(readFileSync('src/content/pricing.json', 'utf8')) as PricingEntry[];

describe('daftar harga', () => {
  it('Student Deal, Cutless Pass, Groom Package nonaktif → tidak ada paket', () => {
    for (const name of ['Student Deal', 'Cutless Pass', 'Groom Package']) expect(entries.find((e) => e.name === name)?.isActive).toBe(false);
    expect(buildPricing(entries, pricingCopy, []).packages).toEqual([]);
  });

  it('paket aktif tetap tampil sebagai kartu', () => {
    const one = entries.map((e) => (e.name === 'Cutless Pass' ? { ...e, isActive: true } : e));
    expect(buildPricing(one, pricingCopy, []).packages.map((p) => p.name)).toEqual(['Cutless Pass']);
  });

  it('30 item aktif, kategori berurutan sesuai daftar kategori', () => {
    const p = buildPricing(entries, pricingCopy, []);
    expect(p.categories.reduce((n, c) => n + c.items.length, 0)).toBe(30);
    const order = p.categories.map((c) => PRICE_CATEGORIES.indexOf(c.id));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

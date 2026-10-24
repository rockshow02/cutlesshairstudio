/**
 * Kategori layanan aktif untuk meta description (beranda & halaman cabang), dari Pages CMS → Daftar Harga.
 * Tanpa alias "@/" & tanpa Zod: dipakai plugin build (scripts/vite-content-plugin.ts) dan frontend.
 */
import type { PricingEntry } from './schema';
import { PRICE_CATEGORIES } from './priceCategories';

export const META_MAX = 160;

/** Kategori Daftar Harga yang punya item aktif (tanpa Paket), urut seperti di section Daftar Harga */
export function activeCategoryNames(pricing: PricingEntry[]): string[] {
  const active = new Set(pricing.filter((p) => p.isActive !== false).map((p) => p.category));
  return PRICE_CATEGORIES.filter((c) => c !== 'Paket' && active.has(c));
}

/** "A", "A dan B", "A, B, dan C" */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} dan ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, dan ${items[items.length - 1]}`;
}

/**
 * prefix + daftar layanan + suffix, maksimal `max` karakter: bila terlalu panjang, layanan paling belakang
 * dikurangi dan diganti "dan lainnya" (tidak memotong di tengah kata).
 */
export function fitDescription(prefix: string, names: string[], suffix: string, max = META_MAX): string {
  for (let k = names.length; k >= 1; k -= 1) {
    const list = k === names.length ? joinList(names) : `${names.slice(0, k).join(', ')}, dan lainnya`;
    const text = `${prefix}${list}${suffix}`;
    if (text.length <= max) return text;
  }
  const bare = `${prefix.replace(/[:\s]+$/, '')}${suffix}`;
  return bare.length <= max ? bare : `${bare.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

export const homeDescription = (brand: string, cities: string, names: string[]) =>
  fitDescription(`${brand}, hair studio di ${cities}: `, names, '. Booking via WhatsApp.');

export const branchDescription = (brand: string, branchName: string, names: string[], shoeCare: boolean) =>
  fitDescription(`${brand} cabang ${branchName}: `, names, `.${shoeCare ? ' Ada juga layanan cuci sepatu.' : ''} Booking via WhatsApp.`);

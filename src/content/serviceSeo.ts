/**
 * Nama layanan aktif untuk meta description (beranda & halaman cabang), dari Pages CMS → Kartu Layanan + Daftar Harga.
 * Tanpa alias "@/" & tanpa Zod: dipakai plugin build (scripts/vite-content-plugin.ts) dan frontend.
 */
import type { PricingEntry, ServiceCardEntry } from './schema';

export const META_MAX = 160;

/** Kartu tampil yang kategorinya punya item harga aktif, urut seperti section Layanan (sama dengan buildServices) */
export function pricedServiceNames(services: ServiceCardEntry[], pricing: PricingEntry[]): string[] {
  const priced = new Set(pricing.filter((p) => p.isActive !== false).map((p) => p.category));
  const names = services
    .map((s, index) => ({ s, index }))
    .filter(({ s }) => s.isActive !== false && priced.has(s.pricingCategory as PricingEntry['category']))
    .sort((a, b) => (a.s.order ?? 0) - (b.s.order ?? 0) || a.index - b.index)
    .map(({ s }) => s.name.trim());
  return [...new Set(names)];
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

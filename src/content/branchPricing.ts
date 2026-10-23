import type { PricingEntry } from './schema';

/**
 * Harga per cabang (Pages CMS → Daftar Harga), dipakai browser, prerender, JSON-LD, dan pemeriksaan konten:
 * - "Harga per cabang" (branchPrices) menimpa harga utama untuk cabang itu; cabang lain memakai harga utama.
 * - "Tersedia di cabang" (branchSlugs) kosong = semua cabang; diisi = item hanya tampil di cabang terpilih.
 * Tanpa import runtime agar aman dipakai plugin build (scripts/vite-content-plugin.ts).
 */
type Item = Pick<PricingEntry, 'price' | 'branchPrices' | 'branchSlugs' | 'isActive'>;

export const availableAt = (item: Pick<Item, 'branchSlugs'>, slug: string): boolean => !item.branchSlugs?.length || item.branchSlugs.includes(slug);

export const priceAt = (item: Pick<Item, 'price' | 'branchPrices'>, slug: string): number =>
  item.branchPrices?.find((p) => p.branchSlug === slug)?.price ?? item.price;

/** Item aktif yang tersedia di cabang */
export const itemsAt = <T extends Item>(entries: T[], slug: string): T[] => entries.filter((i) => i.isActive !== false && availableAt(i, slug));

/**
 * true = semua cabang (mis. cabang Aktif) punya daftar & harga yang sama persis: setiap item aktif tersedia di semua
 * cabang itu dengan harga yang sama. Satu harga berbeda atau satu layanan yang tidak tersedia → false.
 */
export function samePricesEverywhere(entries: Item[], slugs: string[]): boolean {
  return entries
    .filter((i) => i.isActive !== false)
    .every((i) => {
      const values = slugs.map((s) => (availableAt(i, s) ? priceAt(i, s) : null));
      return values.every((v) => v === values[0]);
    });
}

/** Harga terendah & tertinggi item aktif yang tersedia di cabang (JSON-LD priceRange); undefined = tidak ada item */
export function priceRangeAt(entries: Item[], slug: string): { min: number; max: number } | undefined {
  const prices = itemsAt(entries, slug).map((i) => priceAt(i, slug));
  return prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : undefined;
}

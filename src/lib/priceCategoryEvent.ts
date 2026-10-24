import { priceCategoryAnchor } from '@/content/priceCategories';

/**
 * Tautan "Lihat harga" (kartu Layanan) → kategori di Daftar Harga. Di desktop cukup anchor #harga-<kategori>; di HP
 * Daftar Harga memakai tab, jadi tab kategori itu ikut dipilih lewat event ini (juga saat halaman dibuka dengan hash).
 */
export const PRICE_CATEGORY_EVENT = 'cutless:price-category';

export function selectPriceCategory(category: string) {
  window.dispatchEvent(new CustomEvent<string>(PRICE_CATEGORY_EVENT, { detail: category }));
}

/** Kategori dari hash URL (#harga-special-treatment), bila cocok */
export function categoryFromHash(categories: string[], hash = typeof window === 'undefined' ? '' : window.location.hash): string | undefined {
  const id = decodeURIComponent(hash.replace(/^#/, ''));
  return categories.find((c) => priceCategoryAnchor(c) === id);
}

/**
 * Kategori Daftar Harga. Urutan = urutan tampil di website. Dipakai skema Zod (schema.ts), .pages.yml (pilihan
 * "Kategori", dijaga tes), dan frontend. Tanpa Zod agar aman diimpor ke kode browser.
 * Kategori aktif (revisi klien Okt 2026): Haircut, Special Treatment, Woman Haircut & Treatment.
 * Kategori lama dipertahankan untuk item nonaktif (data tidak dihapus); Paket = kartu paket.
 */
export const PRICE_CATEGORIES = [
  'Haircut',
  'Special Treatment',
  'Woman Haircut & Treatment',
  'Haircut & Grooming',
  'Wanita',
  'Treatment',
  'Coloring',
  'Perming',
  'Braids & Dreadlock',
  'Shaving',
  'Kids',
  'Paket',
] as const;

/** id elemen kategori di section Daftar Harga, mis. "Special Treatment" → "harga-special-treatment" (tautan "Lihat harga") */
export const priceCategoryAnchor = (category: string): string =>
  `harga-${category.toLowerCase().replace(/&/g, 'dan').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

/**
 * Kategori Daftar Harga. Urutan = urutan tampil di website. Dipakai skema Zod (schema.ts), .pages.yml (pilihan
 * "Kategori", dijaga tes), dan frontend. Tanpa Zod agar aman diimpor ke kode browser.
 * Shaving, Kids, Paket dipertahankan sampai klien konfirmasi.
 */
export const PRICE_CATEGORIES = ['Haircut & Grooming', 'Wanita', 'Treatment', 'Coloring', 'Perming', 'Braids & Dreadlock', 'Shaving', 'Kids', 'Paket'] as const;

import type { ServicesCopy } from '@/types';

/**
 * Judul section Layanan (teks statis). Kartu layanan ada di src/content/services.json (Pages CMS → Kartu Layanan):
 * satu kartu per kategori Daftar Harga; "mulai Rp…" = harga terendah item aktif kategori itu untuk cabang terpilih.
 * Kartu yang kategorinya tanpa harga aktif tidak tampil.
 */
export const servicesCopy: ServicesCopy = {
  heading: {
    kicker: 'Layanan',
    title: 'Semua yang kepalamu butuhin.',
    intro: 'Dari haircut harian sampai ganti warna total. Pilih layanannya, sisanya biar kami yang urus.',
  },
};

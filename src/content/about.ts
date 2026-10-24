import type { AboutCopy } from '@/types';

/**
 * Label statistik section Tentang. Teks, poin nilai, dan foto slideshow ada di src/content/about.json
 * (Pages CMS → Tentang Kami). Angka statistik TIDAK ditulis di sini: jumlah cabang & hairstylist dihitung
 * dari data aktif, angka lain (pelanggan, tahun berdiri, rating, ulasan) dari Pengaturan Situs.
 */
export const aboutCopy: AboutCopy = {
  statLabels: {
    branches: 'Cabang',
    barbers: 'Hairstylist',
    customers: 'Pelanggan dilayani',
    foundedYear: 'Tahun berdiri',
    rating: 'Rating Google',
    reviewCount: 'Ulasan Google',
  },
};

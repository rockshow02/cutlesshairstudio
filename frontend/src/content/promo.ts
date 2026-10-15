import type { PromoContent } from '@/types';

/**
 * Teks pendukung section Promo. Daftar promo dikelola di CMS (Strapi → Promo).
 * `items` di sini adalah fallback bila CMS tidak bisa diakses: dibiarkan kosong agar
 * promo kedaluwarsa tidak pernah tampil dari data statis.
 */
export const promo: PromoContent = {
  heading: { kicker: 'Promo', title: 'Lagi ada yang spesial.' },
  labels: {
    validUntil: 'Berlaku sampai {date}',
    badge: 'Promo',
  },
  items: [],
};

import type { PromoCopy } from '@/types';

/** Teks section Promo (statis). Daftar promo dikelola lewat Pages CMS → src/content/promos.json. */
export const promoCopy: PromoCopy = {
  heading: { kicker: 'Promo', title: 'Lagi ada yang spesial.' },
  labels: {
    validUntil: 'Berlaku sampai {date}',
    badge: 'Promo',
  },
};

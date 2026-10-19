import type { PricingCopy } from '@/types';

/**
 * Teks section Harga (statis). Daftar harga & paket dikelola lewat Pages CMS → src/content/pricing.json.
 */
export const pricingCopy: PricingCopy = {
  heading: {
    kicker: 'Daftar Harga',
    title: 'Harga jelas, tanpa kejutan.',
    intro: 'Semua harga sudah termasuk konsultasi dan styling. Harga chemical tergantung panjang & ketebalan rambut.',
  },
  // Label kategori yang tampil di website (kunci = pilihan "Kategori" di Pages CMS)
  categoryLabels: {
    'Haircut & Grooming': 'Haircut & Grooming',
    Wanita: 'Wanita',
    Treatment: 'Treatment',
    Coloring: 'Coloring',
    Perming: 'Perming',
    'Braids & Dreadlock': 'Braids & Dreadlock',
    Shaving: 'Shaving & Beard',
    Kids: 'Kids',
  },
  packagesTitle: 'Paket & Membership',
  packageCtaLabel: 'Ambil Paket',
  packageDefaultTag: 'Paket',
};

import type { ShowcaseCopy } from '@/types';

/**
 * Kartu foto studio yang membesar (di bawah section Tentang).
 * Foto diambil otomatis dari foto cabang pertama di Pages CMS; bila belum ada, memakai fallbackImage.
 */
export const showcaseCopy: ShowcaseCopy = {
  heading: 'Suasana studio Cutless',
  fallbackImage: {
    src: '/images/cta/studio.jpg',
    alt: 'Suasana studio Cutless Hair Studio saat hairstylist melayani pelanggan',
    width: 750,
    height: 423,
  },
  taglines: ['On point, always.', 'Kursi nyaman, obrolan santai.', 'Detail yang bikin balik lagi.'],
};

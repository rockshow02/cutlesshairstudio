import type { ShowcaseCopy } from '@/types';

/**
 * Kartu foto studio yang membesar (di bawah section Tentang). Foto & tagline: src/content/studio.json
 * (Pages CMS → Kartu Studio). Foto kosong → foto cabang pertama; belum ada juga → fallbackImage.
 */
export const showcaseCopy: ShowcaseCopy = {
  heading: 'Suasana studio Cutless',
  fallbackImage: {
    src: '/images/cta/studio.jpg',
    alt: 'Suasana studio Cutless Hair Studio saat hairstylist melayani pelanggan',
    width: 750,
    height: 423,
  },
};

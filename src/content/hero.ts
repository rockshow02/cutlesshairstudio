import type { HeroExtras } from '@/types';

/**
 * Bagian hero yang tidak diedit admin. Kicker, judul, subjudul, label tombol, foto desktop/HP, dan teks berjalan
 * ada di src/content/hero.json (Pages CMS → Hero).
 */
export const heroExtras: HeroExtras = {
  // Opsional: video latar, mis. { src: '/videos/hero.mp4', type: 'video/mp4' }
  video: undefined,
  secondaryHref: '#layanan',
  scrollHint: 'Scroll',
};

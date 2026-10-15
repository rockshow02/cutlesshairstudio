import type { TestimonialsCopy } from '@/types';

/**
 * Teks section Testimoni. Ulasan dikelola lewat Pages CMS → src/content/testimonials.json,
 * rating & jumlah ulasan dari Pengaturan Situs. Section tampil hanya bila "Tampilkan testimoni" aktif.
 */
export const testimonialsCopy: TestimonialsCopy = {
  heading: { kicker: 'Testimoni', title: 'Kata mereka yang udah duduk di kursi kami.' },
  ctaLabel: 'Lihat semua ulasan',
  reviewCountLabel: 'dari {count} ulasan Google',
};

import type { GalleryCopy } from '@/types';

/**
 * Teks section Galeri + blok before/after (statis).
 * Foto galeri dikelola lewat Pages CMS → src/content/gallery.json.
 */
export const galleryCopy: GalleryCopy = {
  heading: { kicker: 'Galeri', title: 'Hasil kerja, bukan janji.' },
  // TODO: ganti dengan pasangan foto sebelum & sesudah asli (ukuran & sudut kamera sama persis)
  beforeAfter: [
    {
      id: 'ba1',
      kicker: 'Before / After',
      title: 'Geser, lihat bedanya.',
      description: 'Transformasi lengkap tiap minggu kami upload di Instagram dan TikTok. Follow buat referensi gaya berikutnya.',
      before: { src: '/images/before-after/before-01.jpg', alt: 'Sebelum: rambut belum dirapikan', width: 360, height: 423 },
      after: { src: '/images/before-after/after-01.jpg', alt: 'Sesudah: hair tattoo dan fade yang rapi', width: 360, height: 423 },
      beforeLabel: 'Sebelum',
      afterLabel: 'Sesudah',
      sliderLabel: 'Geser untuk membandingkan sebelum dan sesudah',
    },
  ],
};

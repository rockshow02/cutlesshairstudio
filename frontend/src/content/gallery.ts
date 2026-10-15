import type { GalleryContent } from '@/types';

export const gallery: GalleryContent = {
  heading: { kicker: 'Galeri', title: 'Hasil kerja, bukan janji.' },
  // TODO: ganti dengan foto hasil potongan asli (min. 900px, sudah dikompres). Atur layout: square | tall | wide
  items: [
    { id: 'g1', layout: 'tall', caption: 'Beard trim & textured crop', image: { src: '/images/gallery/gallery-01.jpg', alt: 'Hairstylist merapikan jenggot dan rambut pelanggan', width: 384, height: 558 } },
    { id: 'g2', layout: 'square', caption: 'Hair tattoo', image: { src: '/images/gallery/gallery-02.jpg', alt: 'Proses hair tattoo garis di sisi kepala', width: 360, height: 423 } },
    { id: 'g3', layout: 'wide', caption: 'Suasana studio', image: { src: '/images/gallery/gallery-03.jpg', alt: 'Beberapa hairstylist sedang bekerja di studio', width: 750, height: 423 } },
    { id: 'g4', layout: 'wide', caption: 'Fade dengan clipper', image: { src: '/images/gallery/gallery-04.jpg', alt: 'Hairstylist membuat fade dengan clipper', width: 750, height: 423 } },
    { id: 'g5', layout: 'square', caption: 'Beard shaping', image: { src: '/images/gallery/gallery-05.jpg', alt: 'Pelanggan berbaring saat beard shaping', width: 360, height: 423 } },
    { id: 'g6', layout: 'tall', caption: 'Beard detail', image: { src: '/images/gallery/gallery-06.jpg', alt: 'Detail perapian jenggot dengan trimmer', width: 441, height: 583 } },
    { id: 'g7', layout: 'square', caption: 'Taper fade', image: { src: '/images/gallery/gallery-07.jpg', alt: 'Hairstylist memotong taper fade', width: 555, height: 323 } },
    { id: 'g8', layout: 'square', caption: 'Finishing', image: { src: '/images/gallery/gallery-08.jpg', alt: 'Finishing potongan rambut dengan gunting', width: 556, height: 325 } },
  ],
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

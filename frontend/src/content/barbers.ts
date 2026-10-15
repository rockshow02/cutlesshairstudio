import type { BarbersContent } from '@/types';

export const barbers: BarbersContent = {
  heading: {
    kicker: 'Hairstylist',
    title: 'Tangan-tangan di balik potonganmu.',
    intro: 'Punya hairstylist favorit? Langsung booking orangnya.',
  },
  // TODO: ganti nama, peran, spesialisasi, dan foto (rasio 3:4) tiap hairstylist. Nama di bawah adalah contoh.
  items: [
    {
      id: 'raka',
      name: 'Raka',
      role: 'Head Hairstylist',
      specialties: ['Skin fade', 'Pompadour'],
      photo: { src: '/images/barbers/barber-01.jpg', alt: 'Foto Raka, Head Hairstylist Cutless', width: 360, height: 479 },
    },
    {
      id: 'dimas',
      name: 'Dimas',
      role: 'Senior Hairstylist',
      specialties: ['Beard', 'Classic cut'],
      photo: { src: '/images/barbers/barber-02.jpg', alt: 'Foto Dimas, Senior Hairstylist Cutless', width: 360, height: 479 },
    },
    {
      id: 'bayu',
      name: 'Bayu',
      role: 'Color Specialist',
      specialties: ['Coloring', 'Perming'],
      photo: { src: '/images/barbers/barber-03.jpg', alt: 'Foto Bayu, Color Specialist Cutless', width: 360, height: 479 },
    },
    {
      id: 'fajar',
      name: 'Fajar',
      role: 'Hairstylist',
      specialties: ['Hair tattoo', 'Textured crop'],
      photo: { src: '/images/barbers/barber-04.jpg', alt: 'Foto Fajar, Hairstylist Cutless', width: 690, height: 870 },
    },
  ],
};

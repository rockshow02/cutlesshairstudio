import type { AboutContent } from '@/types';

export const about: AboutContent = {
  heading: { kicker: 'Tentang Kami', title: 'Bukan sekadar potong rambut.' },
  // TODO: sesuaikan cerita singkat studio
  lead:
    'Cutless lahir dari satu hal sederhana: semua orang berhak keluar dari kursi barber dengan rasa percaya diri. Kami ngobrol dulu, baca bentuk wajah dan tekstur rambutmu, baru eksekusi.',
  body: ['Hasilnya potongan yang rapi hari ini dan tetap enak di-styling dua minggu lagi. Santai, tapi detailnya serius.'],
  // TODO: ganti dengan foto interior/aktivitas studio resolusi tinggi (rasio 3:4)
  image: {
    src: '/images/about/about-studio.jpg',
    alt: 'Hairstylist Cutless memotong rambut pelanggan di studio yang terang dan minimalis',
    width: 464,
    height: 619,
  },
  imageCaption: 'Studio Cutless, Bogor',
  values: [
    { title: 'Konsultasi dulu', description: 'Gaya ditentukan bareng, bukan ditebak.' },
    { title: 'Detail sampai rapi', description: 'Fade halus, garis tegas, finishing bersih.' },
    { title: 'Nyaman & on time', description: 'Booking jelas, nggak pakai antre lama.' },
  ],
  // TODO: sesuaikan angka pencapaian
  stats: [
    { value: 5000, suffix: '+', animate: true, label: 'Pelanggan dilayani' },
    { value: 2021, display: '2021', label: 'Tahun berdiri' },
    { value: 6, animate: true, label: 'Hairstylist' },
    { value: 4.9, display: '4,9', label: 'Rating Google' },
  ],
};

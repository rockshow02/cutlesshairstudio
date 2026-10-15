import type { AboutCopy } from '@/types';

/**
 * Teks section Tentang. Angka statistik TIDAK ditulis di sini: jumlah cabang & hairstylist dihitung
 * dari data aktif, angka lain (pelanggan, tahun berdiri, rating, ulasan) dari Pengaturan Situs.
 */
export const aboutCopy: AboutCopy = {
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
  statLabels: {
    branches: 'Cabang',
    barbers: 'Hairstylist',
    customers: 'Pelanggan dilayani',
    foundedYear: 'Tahun berdiri',
    rating: 'Rating Google',
    reviewCount: 'Ulasan Google',
  },
};

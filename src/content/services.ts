import type { ServicesContent } from '@/types';

export const services: ServicesContent = {
  heading: {
    kicker: 'Layanan',
    title: 'Semua yang kepalamu butuhin.',
    intro: 'Dari haircut harian sampai ganti warna total. Pilih layanannya, sisanya biar kami yang urus.',
  },
  // TODO: sesuaikan daftar layanan, deskripsi, dan harga "mulai" (samakan dengan pricing.ts)
  items: [
    { id: 'haircut', name: 'Haircut', icon: 'scissors', startingPrice: 75000, description: 'Fade, crop, pompadour, comma hair. Konsultasi, potong, styling.' },
    { id: 'haircut-wash', name: 'Haircut + Wash', icon: 'wash', startingPrice: 90000, description: 'Haircut lengkap plus keramas, pijat kepala ringan, dan blow-dry.' },
    { id: 'shaving', name: 'Shaving & Beard', icon: 'shave', startingPrice: 40000, description: 'Hot towel shave dan beard trim biar jenggot rapi dan kulit tetap adem.' },
    { id: 'coloring', name: 'Hair Coloring', icon: 'color', startingPrice: 150000, description: 'Full color, highlight, sampai bleaching. Konsultasi warna sesuai skin tone.' },
    { id: 'perming', name: 'Perming', icon: 'perm', startingPrice: 120000, description: 'Wavy, curly, atau down perm biar rambut lebih bervolume dan gampang diatur.' },
    { id: 'kids', name: 'Kids Haircut', icon: 'kids', startingPrice: 60000, description: 'Untuk jagoan kecil di bawah 12 tahun. Sabar, cepat, dan tetap keren.' },
    { id: 'hair-spa', name: 'Hair Spa', icon: 'spa', startingPrice: 100000, description: 'Treatment nutrisi dan scalp care untuk rambut kering, rontok, atau habis coloring.' },
    { id: 'hair-tattoo', name: 'Hair Tattoo', icon: 'tattoo', startingPrice: 25000, description: 'Garis, pola, atau desain custom di sisi kepala buat look yang beda.' },
  ],
};

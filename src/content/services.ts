import type { ServicesContent } from '@/types';

export const services: ServicesContent = {
  heading: {
    kicker: 'Layanan',
    title: 'Semua yang kepalamu butuhin.',
    intro: 'Dari haircut harian sampai ganti warna total. Pilih layanannya, sisanya biar kami yang urus.',
  },
  // "mulai Rp..." dihitung otomatis dari Daftar Harga (pricing.json) per kategori `pricingCategory`,
  // untuk cabang yang dipilih pengunjung. Kategori tanpa harga aktif (atau tanpa pricingCategory) → "Tanya harga".
  // Hair Spa & Hair Tattoo sengaja tanpa kategori: harga terendah Treatment (Hair Wash Rp30.000) bukan harga layanan itu.
  items: [
    { id: 'haircut', name: 'Haircut', icon: 'scissors', pricingCategory: 'Haircut & Grooming', description: 'Fade, crop, pompadour, comma hair. Konsultasi, potong, styling.' },
    { id: 'haircut-wash', name: 'Haircut + Wash', icon: 'wash', pricingCategory: 'Haircut & Grooming', description: 'Haircut lengkap plus keramas, pijat kepala ringan, dan blow-dry.' },
    { id: 'shaving', name: 'Shaving & Beard', icon: 'shave', pricingCategory: 'Shaving', description: 'Hot towel shave dan beard trim biar jenggot rapi dan kulit tetap adem.' },
    { id: 'coloring', name: 'Hair Coloring', icon: 'color', pricingCategory: 'Coloring', description: 'Full color, highlight, sampai bleaching. Konsultasi warna sesuai skin tone.' },
    { id: 'perming', name: 'Perming', icon: 'perm', pricingCategory: 'Perming', description: 'Wavy, curly, atau down perm biar rambut lebih bervolume dan gampang diatur.' },
    { id: 'kids', name: 'Kids Haircut', icon: 'kids', pricingCategory: 'Kids', description: 'Untuk jagoan kecil di bawah 12 tahun. Sabar, cepat, dan tetap keren.' },
    { id: 'hair-spa', name: 'Hair Spa', icon: 'spa', description: 'Treatment nutrisi dan scalp care untuk rambut kering, rontok, atau habis coloring.' },
    { id: 'hair-tattoo', name: 'Hair Tattoo', icon: 'tattoo', description: 'Garis, pola, atau desain custom di sisi kepala buat look yang beda.' },
  ],
};

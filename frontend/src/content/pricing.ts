import type { PricingContent } from '@/types';

export const pricing: PricingContent = {
  heading: {
    kicker: 'Daftar Harga',
    title: 'Harga jelas, tanpa kejutan.',
    intro: 'Semua harga sudah termasuk konsultasi dan styling. Harga chemical tergantung panjang & ketebalan rambut.',
  },
  // Data ini dipakai sebagai FALLBACK bila CMS tidak bisa diakses, dan sebagai sumber seed awal ke CMS.
  // Setelah CMS aktif, ubah harga lewat panel admin (Daftar Harga), bukan di file ini.
  // `id` kategori = enum `category` di CMS; `name` = label yang tampil di website.
  // TODO: isi harga asli (angka bulat Rupiah, tanpa titik). Format tampil diatur otomatis.
  categories: [
    {
      id: 'Haircut',
      name: 'Haircut',
      items: [
        { id: 'signature', name: 'Signature Haircut', description: 'Konsultasi, cut, styling', price: 75000 },
        { id: 'haircut-wash', name: 'Haircut + Wash', description: 'Plus keramas & blow-dry', price: 90000 },
        { id: 'skin-fade', name: 'Skin Fade / Taper', price: 85000 },
      ],
    },
    {
      id: 'Kids',
      name: 'Kids',
      items: [{ id: 'kids', name: 'Kids Haircut', description: 'Di bawah 12 tahun', price: 60000 }],
    },
    {
      id: 'Shaving',
      name: 'Shaving & Beard',
      items: [
        { id: 'hot-towel', name: 'Hot Towel Shave', price: 50000 },
        { id: 'beard-trim', name: 'Beard Trim & Shape', price: 40000 },
        { id: 'cut-shave', name: 'Haircut + Shave', price: 110000 },
      ],
    },
    {
      id: 'Coloring',
      name: 'Coloring & Perming',
      items: [
        { id: 'coloring', name: 'Hair Coloring', description: 'Full color', price: 150000, priceFrom: true },
        { id: 'highlight', name: 'Highlight / Bleaching', price: 250000, priceFrom: true },
        { id: 'perming', name: 'Perming', description: 'Wavy / curly', price: 250000, priceFrom: true },
        { id: 'down-perm', name: 'Down Perm', price: 120000 },
      ],
    },
    {
      id: 'Treatment',
      name: 'Treatment & Extra',
      items: [
        { id: 'hair-spa', name: 'Hair Spa', description: 'Nutrisi & scalp care', price: 100000 },
        { id: 'hair-tattoo', name: 'Hair Tattoo', price: 25000, priceFrom: true },
        { id: 'wash-styling', name: 'Hair Wash & Styling', price: 35000 },
      ],
    },
  ],
  packagesTitle: 'Paket & Membership',
  // TODO: sesuaikan paket & membership (kosongkan array bila belum ada)
  packages: [
    {
      id: 'student',
      name: 'Student Deal',
      tag: 'Pelajar & Mahasiswa',
      price: 60000,
      unit: '/ haircut',
      features: ['Signature Haircut', 'Tunjukkan kartu pelajar/KTM', 'Senin – Kamis'],
      ctaLabel: 'Ambil Paket',
    },
    {
      id: 'cutless-pass',
      name: 'Cutless Pass',
      tag: 'Paling Hemat',
      price: 260000,
      unit: '/ 4x haircut',
      features: ['4x Signature Haircut', 'Berlaku 60 hari', 'Prioritas jadwal booking'],
      featured: true,
      badge: 'Best Seller',
      ctaLabel: 'Ambil Paket',
    },
    {
      id: 'groom',
      name: 'Groom Package',
      tag: 'Hari Spesial',
      price: 450000,
      features: ['Haircut + Hot Towel Shave', 'Hair Spa & facial ringan', 'Styling di hari H'],
      ctaLabel: 'Ambil Paket',
    },
  ],
};

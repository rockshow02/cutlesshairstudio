import type { SiteContent } from '@/types';

/**
 * Konfigurasi & teks statis situs.
 * Nilai berikut DITIMPA oleh Pengaturan Situs di Pages CMS (src/content/settings.json):
 *   brandName, logo.stacked (logo footer), whatsapp.number, whatsapp.displayNumber,
 *   whatsapp.templates.general, address, footer.description, footer.hoursSummary.
 * Ubah nilai-nilai itu lewat Pages CMS, bukan di file ini.
 */
export const site: SiteContent = {
  brandName: 'Cutless Hair Studio',
  city: 'Kota Bogor',
  logo: {
    horizontal: { src: '/images/brand/cutless-logo-horizontal-white.png', alt: 'Cutless Hair Studio', width: 432, height: 120 },
    stacked: { src: '/images/brand/cutless-logo-white.png', alt: 'Cutless Hair Studio', width: 404, height: 360 },
    mark: { src: '/images/brand/cutless-mark-white.png', alt: '', width: 206, height: 240 },
  },
  nav: [
    { label: 'Layanan', sectionId: 'layanan' },
    { label: 'Harga', sectionId: 'harga' },
    { label: 'Hairstylist', sectionId: 'hairstylist' },
    { label: 'Galeri', sectionId: 'galeri' },
    { label: 'Produk', href: '/produk/' },
    { label: 'Lokasi', sectionId: 'lokasi' },
    { label: 'Kontak', sectionId: 'kontak' },
  ],
  whatsapp: {
    // TODO: ganti dengan nomor WhatsApp bisnis (format 62..., tanpa +, 0, spasi, atau strip)
    number: '6281234567890',
    // TODO: ganti dengan nomor yang ditampilkan
    displayNumber: '0812-3456-7890',
    templates: {
      general: 'Halo {brand}, saya mau booking haircut untuk [hari/jam].',
      service: 'Halo {brand}, saya mau booking {service} untuk [hari/jam].',
      barber: 'Halo {brand}, saya mau booking haircut dengan {barber} untuk [hari/jam].',
      branch: 'Halo {brand} cabang {branch}, saya mau booking haircut untuk [hari/jam].',
      package: 'Halo {brand}, saya mau ambil paket {package}. Bisa dibantu?',
      question: 'Halo {brand}, saya mau tanya-tanya dulu.',
      product: 'Halo {brand}, saya mau pesan {product}. Masih ada stoknya?',
      productRestock: 'Halo {brand}, kapan {product} ready lagi? Saya mau pesan.',
    },
  },
  // TODO: ganti email bisnis
  email: 'halo@cutlesshairstudio.id',
  // TODO: sesuaikan dengan rentang harga asli
  priceRange: 'Rp60.000 - Rp450.000',
  seo: {
    title: 'Cutless Hair Studio Bogor | Barbershop & Hair Studio, Booking via WhatsApp',
    description:
      'Cutless Hair Studio, hair studio di Kota Bogor untuk haircut, fade, pompadour, shaving, hair coloring, perming, dan hair spa. Booking gampang via WhatsApp.',
    // TODO: ganti dengan domain asli (samakan juga di index.html)
    url: 'https://cutlesshairstudio.id/',
    ogImage: '/images/og/og-cutless.jpg',
    locale: 'id_ID',
  },
  ui: {
    skipToContent: 'Langsung ke konten',
    mainNavigation: 'Menu utama',
    openMenu: 'Buka menu',
    closeMenu: 'Tutup menu',
    bookNow: 'Booking Sekarang',
    bookNowShort: 'Booking',
    book: 'Booking',
    bookWithBarber: 'Booking {name}',
    floatingWhatsApp: 'Booking via WhatsApp',
    floatingWhatsAppLabel: 'Booking',
    loading: 'Memuat…',
    empty: 'Konten belum tersedia. Hubungi kami via WhatsApp untuk info terbaru.',
    error: 'Konten gagal dimuat. Coba muat ulang halaman.',
    placeholderBadge: 'Contoh',
    priceFrom: 'mulai',
    previous: 'Sebelumnya',
    next: 'Berikutnya',
    close: 'Tutup',
    counter: '{current} / {total}',
    opensInNewTab: '(membuka tab baru)',
    goToSlide: 'Ke ulasan {{index}}',
    scrollHint: 'Geser untuk melihat lainnya',
    socialLinks: 'Sosial media',
    dismissAnnouncement: 'Tutup pengumuman',
    announcementRegion: 'Pengumuman',
  },
  footer: {
    description: 'Hair studio di Kota Bogor. Goodstyle, goodmood.',
    contactTitle: 'Kontak',
    exploreTitle: 'Jelajahi',
    hoursTitle: 'Jam Buka',
    // TODO: samakan dengan jam buka di locations.ts
    hoursSummary: [
      { label: 'Senin – Kamis', value: '10.00 – 21.00' },
      { label: 'Jumat', value: '13.00 – 21.00' },
      { label: 'Sabtu – Minggu', value: '09.00 – 22.00' },
    ],
    copyright: '© {year} {brand}. Semua hak dilindungi.',
    // Kredit template Colorlib wajib dipertahankan (lisensi CC BY 3.0), kecuali membeli lisensi.
    credit: { prefix: 'Desain dasar dari template', label: 'Colorlib', href: 'https://colorlib.com' },
  },
};

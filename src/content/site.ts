import type { SiteContent } from '@/types';

/**
 * Konfigurasi & teks statis situs.
 * Nilai berikut DITIMPA oleh Pengaturan Situs di Pages CMS (src/content/settings.json):
 *   brandName, logo.stacked (logo footer), whatsapp.number, whatsapp.displayNumber,
 *   whatsapp.templates.general, email, siteUrl, features, footer.description (tagline footer).
 * Kota TIDAK ditulis di sini: {cities} diisi otomatis dari kota cabang aktif (branches.json).
 * Alamat & jam buka kini per cabang (src/content/branches.json).
 * Ubah nilai-nilai itu lewat Pages CMS, bukan di file ini.
 */
export const site: SiteContent = {
  brandName: 'Cutless Hair Studio',
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
    { label: 'Kontak', sectionId: 'kontak' },  ],
  whatsapp: {
    // Diisi dari Pengaturan Situs (settings.json → mainWhatsappNumber = nomor pusat)
    number: '',
    displayNumber: '',
    templates: {
      // Template booking menyebut cabang. general ditimpa "Pesan booking default" di Pengaturan Situs.
      general: 'Halo {brand} cabang {branch}, saya mau booking haircut untuk [hari/jam].',
      service: 'Halo {brand} cabang {branch}, saya mau booking {service} untuk [hari/jam].',
      barber: 'Halo {brand} cabang {branch}, saya mau booking haircut dengan {barber} untuk [hari/jam].',
      branch: 'Halo {brand} cabang {branch}, saya mau booking haircut untuk [hari/jam].',
      package: 'Halo {brand} cabang {branch}, saya mau ambil paket {package}. Bisa dibantu?',
      // Ke nomor pusat (bukan cabang)
      question: 'Halo {brand}, saya mau tanya-tanya dulu.',
      priceQuestion: 'Halo {brand} cabang {branch}, saya mau tanya harga {service}.',
      product: 'Halo {brand} cabang {branch}, saya mau pesan {product} untuk diambil di studio. Masih ada stoknya?',
      productRestock: 'Halo {brand} cabang {branch}, kapan {product} ready lagi? Saya mau pesan.',
    },
  },
  // Diisi dari Pengaturan Situs → Email (kosong = tidak ditampilkan)
  email: '',
  // Diisi dari Pengaturan Situs (siteUrl & toggle section)
  siteUrl: '',
  features: { testimonials: false, products: false, beforeAfter: false },
  intro: { enabled: true },
  // TODO: sesuaikan dengan rentang harga asli
  priceRange: 'Rp60.000 - Rp450.000',
  seo: {
    // {brand} & {cities} diisi otomatis (cities dari daftar cabang, mis. "Bogor & Cibubur")
    title: '{brand} | Barbershop & Hair Studio di {cities}',
    description:
      '{brand}, hair studio di {cities} untuk haircut, fade, pompadour, shaving, hair coloring, perming, dan hair spa. Pilih cabang terdekat & booking via WhatsApp.',
    // Diisi dari Pengaturan Situs → siteUrl
    url: '',
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
    askPrice: 'Tanya harga',
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
    // Bawaan bila Pengaturan Situs → Tagline footer kosong; {cities} = kota cabang aktif
    description: 'Hair studio di {cities}. Goodstyle, goodmood.',
    contactTitle: 'Kontak',
    exploreTitle: 'Jelajahi',
    branchesTitle: 'Cabang',
    copyright: '© {year} {brand}. Semua hak dilindungi.',
    // Kredit template Colorlib wajib dipertahankan (lisensi CC BY 3.0), kecuali membeli lisensi.
    credit: { prefix: 'Desain dasar dari template', label: 'Colorlib', href: 'https://colorlib.com' },
  },
};

import type { ImageAsset } from './common';

export interface NavItem {
  label: string;
  /** id section di halaman utama, tanpa "#" (mis. "harga") */
  sectionId?: string;
  /** Atau: halaman lain, path relatif root situs (mis. "/produk/") */
  href?: string;
  /** false = tidak tampil di navbar desktop (tetap di menu mobile & footer), agar navbar tidak sesak */
  desktop?: boolean;
}

/**
 * Template pesan WhatsApp.
 * Placeholder yang didukung: {brand} {service} {barber} {branch} {package} {product}
 * Template booking sebaiknya memuat {branch}; bila tidak, nama cabang disisipkan otomatis setelah {brand}.
 */
export interface WhatsAppConfig {
  /** Format internasional tanpa +, 0 di depan, spasi, atau strip. Contoh: 6281234567890 */
  number: string;
  /** Nomor yang ditampilkan ke pengunjung. Contoh: 0812-3456-7890 */
  displayNumber: string;
  templates: {
    general: string;
    service: string;
    barber: string;
    branch: string;
    package: string;
    question: string;
    /** Tanya harga layanan yang belum punya harga */
    priceQuestion: string;
    /** Pesan produk */
    product: string;
    /** Tanya produk yang stoknya habis */
    productRestock: string;
  };
}

/** Label UI generik (tombol, aria-label, state kosong) agar komponen bebas teks hardcode. */
export interface UiLabels {
  skipToContent: string;
  mainNavigation: string;
  openMenu: string;
  closeMenu: string;
  bookNow: string;
  bookNowShort: string;
  book: string;
  /** Mendukung placeholder {name} */
  bookWithBarber: string;
  floatingWhatsApp: string;
  floatingWhatsAppLabel: string;
  loading: string;
  empty: string;
  error: string;
  /** Tombol pengganti harga "mulai" bila kategori belum punya harga */
  askPrice: string;
  /** Tautan kartu Layanan ke kategori di Daftar Harga */
  viewPrice: string;
  priceFrom: string;
  previous: string;
  next: string;
  close: string;
  /** Mendukung placeholder {current} dan {total} */
  counter: string;
  opensInNewTab: string;
  /** Pesan aksesibilitas bullet slider. Placeholder Swiper: {{index}} */
  goToSlide: string;
  /** Label wilayah yang bisa di-scroll horizontal (barber di mobile) */
  scrollHint: string;
  socialLinks: string;
  /** aria-label tombol tutup pengumuman */
  dismissAnnouncement: string;
  announcementRegion: string;
}

export interface SeoConfig {
  title: string;
  description: string;
  /** URL kanonis situs */
  url: string;
  ogImage: string;
  locale: string;
}

export interface FooterContent {
  description: string;
  contactTitle: string;
  exploreTitle: string;
  /** Judul kolom daftar cabang di footer */
  branchesTitle: string;
  /** Mendukung placeholder {year} dan {brand} */
  copyright: string;
  /** Kredit template Colorlib (wajib dipertahankan sesuai lisensi CC BY 3.0) */
  credit: { prefix: string; label: string; href: string };
}

export interface SiteContent {
  brandName: string;
  logo: {
    horizontal: ImageAsset;
    stacked: ImageAsset;
    mark: ImageAsset;
  };
  nav: NavItem[];
  whatsapp: WhatsAppConfig;
  /** Kosong = baris email di footer tidak ditampilkan (Pengaturan Situs → Email) */
  email: string;
  /** Domain resmi tanpa garis miring akhir (settings.json → siteUrl) */
  siteUrl: string;
  /** Section yang bisa dimatikan dari Pengaturan Situs */
  features: { testimonials: boolean; products: boolean; beforeAfter: boolean; shoeCare: boolean; tips: boolean; servicePages: boolean };
  /** Preloader (Pengaturan Situs): aktif/tidak + video opsional */
  intro: { enabled: boolean; video?: string };
  priceRange: string;
  seo: SeoConfig;
  ui: UiLabels;
  footer: FooterContent;
}

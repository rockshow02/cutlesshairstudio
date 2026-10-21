import type { IconName, ImageAsset, SectionHeading } from './common';

/** Label UI statis halaman & teaser Cuci Sepatu (src/content/shoeCare.ts) */
export interface ShoeCareCopy {
  /** Kicker hero & judul teaser */
  kicker: string;
  /** Pita kecil di garis batas atas teaser */
  ribbon: string;
  /** "Tersedia di" + nama cabang */
  availableAt: string;
  /** "Layanan cuci sepatu hanya tersedia di cabang" + nama cabang */
  onlyAt: string;
  orderLabel: string;
  mainLabel: string;
  menuLabel: string;
  teaserCta: string;
  /** Pengisi {service} untuk tombol utama (tanpa layanan tertentu); {partner} = nama partner, {branch} = nama cabang */
  genericService: string;
  /** Template bawaan bila "Template pesan WhatsApp" di CMS kosong */
  defaultTemplate: string;
  /** Judul About Us bila kosong; {partner} = nama partner */
  aboutTitleFallback: string;
  aboutKicker: string;
  servicesKicker: string;
  servicesTitle: string;
  galleryKicker: string;
  galleryTitle: string;
  notesTitle: string;
  closingKicker: string;
  closingTitle: string;
  /** {branch} = nama cabang */
  closingText: string;
  locationKicker: string;
  hoursTitle: string;
  closed: string;
  directions: string;
  estimateLabel: string;
  lightbox: { open: string; close: string; prev: string; next: string };
}

export interface ShoeCareService {
  name: string;
  description?: string;
  estimate?: string;
  icon?: IconName;
  image?: ImageAsset;
  /** wa.me dengan {service} = nama layanan */
  href: string;
}

/** Halaman /cuci-sepatu/ & teaser (Pages CMS → Partner Cuci Sepatu). null = halaman mati / belum ada layanan */
export interface ShoeCareContent {
  /** URL halaman, mis. "/cuci-sepatu/" */
  pageUrl: string;
  /** Data demo → badge DEMO (staging/dev) */
  isDemo: boolean;
  /** Kartu teaser di beranda & halaman cabang partner */
  showTeaser: boolean;
  name: string;
  tagline?: string;
  description?: string;
  logo?: ImageAsset;
  /** Foto latar hero (CMS → foto hasil pertama → foto CTA penutup) */
  heroImage: ImageAsset;
  /** Satu-satunya cabang tempat layanan tersedia */
  branch: { slug: string; name: string; pageUrl: string };
  about: { heading: SectionHeading; paragraphs: string[]; image?: ImageAsset };
  advantages: { title: string; description: string; icon: IconName }[];
  services: ShoeCareService[];
  photos: ImageAsset[];
  notes: string[];
  /** Daftar menu & harga partner (tab baru); kosong = tombol tidak tampil */
  menuUrl?: string;
  /** wa.me tombol utama (pesan umum) */
  mainHref: string;
  copy: ShoeCareCopy;
}

import type { IconName, ImageAsset, SectionHeading } from './common';

/** Label UI statis section Cuci Sepatu (src/content/shoeCare.ts) */
export interface ShoeCareCopy {
  kicker: string;
  /** Pita kecil di garis batas atas section */
  ribbon: string;
  /** "Tersedia di" + nama cabang */
  availableAt: string;
  /** "Layanan cuci sepatu hanya tersedia di cabang" + nama cabang */
  onlyAt: string;
  orderLabel: string;
  mainLabel: string;
  fromLabel: string;
  /** Pengisi {service} untuk tombol utama (tanpa layanan tertentu); {partner} = nama partner, {branch} = nama cabang */
  genericService: string;
  /** Template bawaan bila "Template pesan WhatsApp" di CMS kosong */
  defaultTemplate: string;
  servicesTitle: string;
  galleryTitle: string;
  notesTitle: string;
  estimateLabel: string;
  viewBranch: string;
}

export interface ShoeCareService {
  name: string;
  description?: string;
  /** Sudah diformat, mis. "mulai Rp 45.000" */
  price: string;
  estimate?: string;
  /** wa.me dengan {service} = nama layanan */
  href: string;
}

/** Section #cuci-sepatu (Pages CMS → Partner Cuci Sepatu). null = dimatikan / belum ada layanan → tidak dirender */
export interface ShoeCareContent {
  id: string;
  heading: SectionHeading;
  name: string;
  description?: string;
  logo?: ImageAsset;
  /** Satu-satunya cabang tempat layanan tersedia */
  branch: { slug: string; name: string; pageUrl: string };
  advantages: { title: string; description: string; icon: IconName }[];
  services: ShoeCareService[];
  photos: ImageAsset[];
  notes: string[];
  /** wa.me tombol utama (pesan umum) */
  mainHref: string;
  copy: ShoeCareCopy;
}

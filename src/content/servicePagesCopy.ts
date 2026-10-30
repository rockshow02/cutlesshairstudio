/**
 * Teks UI halaman layanan (/layanan/ & /layanan/<slug>/), link "Selengkapnya" di Daftar Harga & Kartu Layanan, dan
 * bagian baru di halaman cabang (fasilitas, area, patokan, layanan, FAQ). Isi halaman layanan ditulis di Pages CMS
 * (src/content/layanan/*.md). Ringkasan statis (scripts/layanan.ts, scripts/vite-content-plugin.ts) memakai teks yang sama.
 */
import type { BranchFacility } from './servicePages';
import type { IconName } from '../types/common';

export const servicePagesCopy = {
  heading: {
    kicker: 'Layanan',
    title: 'Layanan Cutless Hair Studio',
    intro: 'Detail setiap layanan: harga mulai per cabang, cocok untuk siapa, prosesnya, dan cara booking via WhatsApp.',
  },
  /** Grup halaman tanpa item Daftar Harga terkait */
  otherCategory: 'Layanan lainnya',
  labels: {
    breadcrumb: 'Breadcrumb',
    home: 'Beranda',
    priceTitle: 'Harga',
    priceFrom: 'mulai',
    availableAt: 'Tersedia di cabang',
    suitableFor: 'Cocok untuk',
    steps: 'Proses',
    duration: 'Durasi',
    photos: 'Foto',
    faqTitle: 'Tanya jawab',
    relatedTitle: 'Layanan terkait',
    readMore: 'Selengkapnya',
    viewBranch: 'Lihat halaman cabang',
    notFoundTitle: 'Layanan tidak ditemukan',
    notFoundText: 'Halaman layanan ini mungkin sudah dipindah atau belum terbit.',
    backToServices: 'Lihat semua layanan',
  },
  cta: {
    title: 'Booking via WhatsApp',
    text: 'Pilih cabang, lalu kirim pesan yang sudah terisi otomatis ke WhatsApp cabang itu.',
    button: 'Booking {service}',
  },
} as const;

/** Bagian baru halaman cabang (/cabang/<slug>/); kosong di CMS = bagiannya tidak tampil */
export const branchDetailsCopy = {
  kicker: 'Tentang cabang',
  areasTitle: 'Area yang dilayani',
  directionsTitle: 'Patokan & cara menuju',
  facilitiesTitle: 'Fasilitas & pembayaran',
  /** "Setiap hari 09.00–21.00" (semua hari sama) */
  everyDay: 'Setiap hari {open}–{close}',
  openUntil: 'Buka sampai {close}',
  servicesTitle: 'Layanan di cabang ini',
  faqTitle: 'Tanya jawab cabang',
} as const;

/** Ikon tiap fasilitas (src/components/ui/Icon.tsx) */
export const FACILITY_ICONS: Record<BranchFacility, IconName> = {
  'Walk-in diterima': 'walk',
  'Parkir motor': 'motorbike',
  'Parkir mobil': 'car',
  AC: 'snow',
  'Wi-Fi': 'wifi',
  Toilet: 'wash',
  'Ruang tunggu': 'seat',
  Tunai: 'cash',
  QRIS: 'qr',
  'Kartu debit/kredit': 'card',
  'Transfer bank': 'bank',
};

/** "Booking {service}" → "Booking Haircut Pria" */
export const serviceBookLabel = (title: string): string => servicePagesCopy.cta.button.replace('{service}', title);

import type { ShoeCareCopy } from '@/types';

/**
 * Label UI halaman /cuci-sepatu/ & teaser yang tidak diedit admin. Isi partner (nama, layanan, foto, About Us,
 * nomor WhatsApp, link daftar menu) ada di src/content/shoeCare.json (Pages CMS → Partner Cuci Sepatu).
 */
export const shoeCareCopy: ShoeCareCopy = {
  kicker: 'Cuci Sepatu',
  ribbon: 'Partner Cutless',
  availableAt: 'Tersedia di',
  onlyAt: 'Layanan cuci sepatu hanya tersedia di cabang',
  orderLabel: 'Pesan via WhatsApp',
  mainLabel: 'Titip Sepatu via WhatsApp',
  menuLabel: 'Lihat Daftar Menu',
  teaserCta: 'Lihat Layanan',
  genericService: 'layanan cuci sepatu',
  // Sama dengan isi awal shoeCare.json; penanda "(via website Cutless)" untuk melacak pesanan dari website
  defaultTemplate: 'Halo {partner}, saya mau pesan {service} di Cutless Hair Studio cabang {branch}. (via website Cutless)',
  aboutTitleFallback: 'Tentang {partner}',
  aboutKicker: 'About Us',
  servicesKicker: 'Layanan',
  servicesTitle: 'Pilih perawatan sepatumu.',
  galleryKicker: 'Galeri',
  galleryTitle: 'Hasil cuci',
  notesTitle: 'Catatan & ketentuan',
  closingKicker: 'Titip sepatu',
  closingTitle: 'Sepatu bersih, tinggal pakai.',
  closingText: 'Chat partner kami untuk titip sepatu saat kamu datang ke Cutless cabang {branch}.',
  locationKicker: 'Lokasi',
  hoursTitle: 'Jam buka',
  closed: 'Tutup',
  directions: 'Petunjuk Arah',
  estimateLabel: 'Estimasi',
  lightbox: { open: 'Perbesar foto', close: 'Tutup', prev: 'Foto sebelumnya', next: 'Foto berikutnya' },
};

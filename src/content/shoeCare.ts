import type { ShoeCareCopy } from '@/types';

/**
 * Label UI section Cuci Sepatu yang tidak diedit admin. Isi partner (nama, layanan, harga, foto, nomor WhatsApp)
 * ada di src/content/shoeCare.json (Pages CMS → Partner Cuci Sepatu).
 */
export const shoeCareCopy: ShoeCareCopy = {
  kicker: 'Partner Cutless',
  availableAt: 'Tersedia di',
  onlyAt: 'Layanan cuci sepatu hanya tersedia di cabang',
  orderLabel: 'Pesan via WhatsApp',
  mainLabel: 'Titip Sepatu via WhatsApp',
  fromLabel: 'mulai',
  genericService: 'layanan cuci sepatu',
  // Sama dengan isi awal shoeCare.json; penanda "(via website Cutless)" untuk melacak pesanan dari website
  defaultTemplate: 'Halo, saya mau pesan {service} di Cutless Hair Studio cabang {branch}. (via website Cutless)',
  servicesTitle: 'Layanan',
  galleryTitle: 'Hasil cuci',
  notesTitle: 'Catatan',
  estimateLabel: 'Estimasi',
  viewBranch: 'Lihat cabang',
};

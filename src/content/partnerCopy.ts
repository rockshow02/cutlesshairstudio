import type { PartnerCopy } from '@/types';

/**
 * Label UI Halaman Partner yang tidak diedit admin. Semua teks konten (judul, poin, FAQ, dll.) ada di
 * src/content/partner.json (Pages CMS → Halaman Partner).
 */
export const partnerCopy: PartnerCopy = {
  applyLabel: 'Ajukan Kerja Sama',
  investmentLabel: 'Kisaran investasi',
  form: {
    type: 'Jenis kerja sama',
    typePlaceholder: 'Pilih jenis kerja sama',
    name: 'Nama',
    company: 'Nama perusahaan/brand',
    optional: 'opsional',
    city: 'Kota',
    phone: 'Nomor WhatsApp',
    phoneHint: 'Diawali 08 atau 62, mis. 081234567890.',
    message: 'Pesan singkat',
    messagePlaceholder: 'Ceritakan rencana atau kebutuhan Anda.',
    required: 'wajib',
    errorSummary: 'Periksa kembali isian yang ditandai.',
    opened: 'WhatsApp sudah dibuka. Tekan kirim di WhatsApp untuk menyelesaikan pengajuan.',
  },
};

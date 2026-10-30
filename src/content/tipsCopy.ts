/**
 * Teks UI halaman Tips & Trik (/tips/), bagian "Tips Terbaru" di beranda, dan halaman artikel. Artikelnya sendiri
 * ditulis di Pages CMS (src/content/tips/*.md). Ringkasan statis (scripts/tips.ts) memakai teks yang sama.
 */
import type { TipCategory } from './tipsSeo';

export const tipsCopy = {
  heading: {
    kicker: 'Dari kursi barber',
    title: 'Tips & Trik',
    intro: 'Panduan gaya rambut, perawatan, dan grooming dari hairstylist Cutless, ditulis dari pengalaman di kursi barber.',
  },
  /** Halaman /tips/kategori/<slug>/: kicker, lalu nama kategori sebagai judul & deskripsi di bawah ini */
  categoryKicker: 'Tips & Trik',
  categoryIntro: {
    'Hair Style': 'Inspirasi & cara memilih potongan rambut: fade, crop, pompadour, dan gaya lain yang cocok untuk bentuk wajah serta keseharianmu.',
    'Hair Care': 'Cara merawat rambut di rumah: keramas, kulit kepala, rambut rontok, ikal, dan warna, dari pengalaman hairstylist Cutless.',
    Grooming: 'Merawat jenggot, kumis, dan wajah agar tetap rapi di antara jadwal ke barbershop.',
    Produk: 'Memilih & memakai pomade, clay, powder, dan hair tonic sesuai jenis rambut dan gaya yang kamu mau.',
    'Tips Barbershop': 'Supaya kunjungan ke barbershop maksimal: cara menjelaskan potongan, jadwal rapikan, dan etika di kursi barber.',
  } satisfies Record<TipCategory, string>,
  latest: {
    kicker: 'Tips & Trik',
    title: 'Tips Terbaru',
    viewAll: 'Lihat semua tips',
  },
  labels: {
    filterLabel: 'Filter kategori',
    filterAll: 'Semua',
    empty: 'Belum ada artikel di kategori ini.',
    readingTime: '{minutes} menit baca',
    published: 'Terbit',
    updated: 'Diperbarui',
    author: 'Ditulis oleh',
    toc: 'Daftar isi',
    keyPoints: 'Poin penting',
    faqTitle: 'Tanya jawab',
    breadcrumb: 'Breadcrumb',
    home: 'Beranda',
    pagination: 'Halaman artikel',
    previous: 'Sebelumnya',
    next: 'Berikutnya',
    pageOf: 'Halaman {page} dari {pages}',
    relatedTitle: 'Artikel terkait',
    servicesTitle: 'Layanan terkait',
    seePrice: 'Lihat harga',
    readMore: 'Baca artikel',
    notFoundTitle: 'Artikel tidak ditemukan',
    notFoundText: 'Artikel ini mungkin sudah dipindah atau belum terbit.',
    backToTips: 'Kembali ke Tips & Trik',
  },
  share: {
    label: 'Bagikan artikel',
    whatsapp: 'Bagikan ke WhatsApp',
    copy: 'Salin link',
    copied: 'Link disalin',
    /** Clipboard ditolak browser: link ditampilkan & dipilih agar bisa disalin manual */
    manual: 'Salin link ini secara manual:',
  },
  authorBox: {
    title: 'Tentang penulis',
    experience: 'Pengalaman',
    specialties: 'Keahlian',
    profile: 'Lihat kartu kapster',
    book: 'Booking dengan {name}',
  },
  cta: {
    title: 'Konsultasi & booking via WhatsApp',
    text: 'Bingung gaya atau perawatan yang cocok? Ceritakan kondisi rambutmu, hairstylist kami bantu pilihkan.',
    button: 'Konsultasi via WhatsApp',
    /** Pesan otomatis (maks. 500 karakter bersama nama usaha & cabang); {title} = judul artikel */
    message: 'Halo {brand} cabang {branch}, saya baca tips "{title}" di website, mau konsultasi soal rambut saya.',
  },
} as const;

/** "{minutes} menit baca" → "4 menit baca" */
export const readingLabel = (minutes: number): string => tipsCopy.labels.readingTime.replace('{minutes}', String(minutes));

/** Pesan CTA artikel: judul diisi di sini, {brand} & {branch} diisi saat tombol ditekan (cabang dipilih) */
export const tipCtaMessage = (title: string): string => tipsCopy.cta.message.replace('{title}', title.replace(/[{}]/g, ''));

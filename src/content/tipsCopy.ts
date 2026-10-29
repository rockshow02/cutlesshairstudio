/**
 * Teks UI halaman Tips & Trik (/tips/), bagian "Tips Terbaru" di beranda, dan halaman artikel. Artikelnya sendiri
 * ditulis di Pages CMS (src/content/tips/*.md). Ringkasan statis (scripts/tips.ts) memakai teks yang sama.
 */
export const tipsCopy = {
  heading: {
    kicker: 'Tips & Trik',
    title: 'Tips & Trik',
    intro: 'Panduan gaya rambut, perawatan, dan grooming dari hairstylist Cutless, ditulis dari pengalaman di kursi barber.',
  },
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
  cta: {
    title: 'Konsultasi & booking via WhatsApp',
    text: 'Bingung gaya atau perawatan yang cocok? Ceritakan kondisi rambutmu, hairstylist kami bantu pilihkan.',
    button: 'Konsultasi via WhatsApp',
  },
} as const;

/** "{minutes} menit baca" → "4 menit baca" */
export const readingLabel = (minutes: number): string => tipsCopy.labels.readingTime.replace('{minutes}', String(minutes));

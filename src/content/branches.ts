import type { BranchCopy } from '@/types';

/**
 * Teks seputar cabang: section Lokasi, pemilih cabang, status buka, halaman /cabang/.
 * Data cabang sendiri (alamat, WA, jam buka, status) dikelola lewat Pages CMS → src/content/branches.json.
 * Placeholder {x} diisi otomatis.
 */
export const branchesCopy: BranchCopy = {
  heading: { kicker: 'Lokasi & Jam Buka', title: 'Mampir ke cabang terdekat.' },
  indexHeading: {
    kicker: 'Cabang',
    title: 'Semua cabang Cutless.',
    intro: 'Pilih cabang terdekat untuk lihat jam buka, harga, hairstylist, dan booking langsung via WhatsApp.',
  },
  labels: {
    hoursCaption: 'Jam operasional',
    today: 'Hari ini',
    closed: 'Tutup',
    directions: 'Petunjuk Arah',
    book: 'Booking cabang ini',
    branchTabs: 'Pilih cabang',
    selectThis: 'Jadikan cabang saya',
    selected: 'Cabang pilihanmu',
    viewPage: 'Lihat halaman cabang',
    allBranches: 'Semua cabang',
    statusBadge: {
      Aktif: 'Buka',
      'Segera Dibuka': 'Segera dibuka',
      'Tutup Sementara': 'Tutup sementara',
    },
    openNow: 'Buka hari ini {open} – {close}',
    opensLaterToday: 'Buka hari ini {open} – {close}',
    closedToday: 'Tutup hari ini',
    opensTomorrow: 'Buka besok {open}',
    opensOn: 'Buka {day} {open}',
    specialHours: 'Jam khusus: {message}',
    comingSoonNote: 'Segera dibuka. Booking belum tersedia.',
    temporarilyClosedNote: 'Sedang tutup sementara. Booking belum tersedia.',
    summary: '{count} cabang · {cities}',
    pickBranch: 'Pilih Cabang',
    changeBranch: 'Ganti',
    yourBranch: 'Cabang {branch}',
    priceFor: 'Harga untuk cabang {branch}.',
    priceVaries: 'Harga bisa berbeda per cabang. Pilih cabang untuk melihat harga pastinya.',
    barbersFor: 'Hairstylist di cabang {branch}.',
    noBarbers: 'Belum ada data hairstylist untuk cabang ini.',
    promoFor: 'Berlaku di cabang {branches}',
    notFoundTitle: 'Cabang tidak ditemukan',
    notFoundText: 'Halaman cabang ini tidak ada atau sudah dipindah.',
    backToBranches: 'Lihat semua cabang',
  },
  picker: {
    title: 'Pilih cabang',
    subtitle: 'Booking & harga akan menyesuaikan cabang yang kamu pilih.',
    chooseCity: 'Pilih kota',
    chooseBranch: 'Pilih cabang',
    nearest: 'Cabang terdekat',
    nearestLoading: 'Mencari lokasimu…',
    nearestDenied: 'Izin lokasi tidak diberikan. Pilih cabang secara manual.',
    nearestUnavailable: 'Lokasi tidak bisa dideteksi. Pilih cabang secara manual.',
    nearestFound: 'Terdekat: {branch} (±{distance} km)',
    back: 'Kembali',
    close: 'Tutup',
    unavailableBadge: 'Belum bisa booking',
  },
};

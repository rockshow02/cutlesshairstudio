/**
 * Pusat pengaturan animasi (durasi, easing, stagger, jarak, intensitas parallax).
 * Ubah nilai di sini untuk menyetel "rasa" animasi seluruh situs tanpa menyentuh komponen.
 * Semua animasi hanya memakai transform & opacity.
 */

/** Easing (cubic-bezier) */
export const EASE = {
  /** Keluar halus, sedikit "premium" (sama dengan --ease di tokens.css) */
  out: [0.22, 0.61, 0.36, 1] as const,
  /** Lebih tegas untuk mask/teks naik */
  expo: [0.16, 1, 0.3, 1] as const,
  /** Masuk-keluar untuk tirai */
  inOut: [0.76, 0, 0.24, 1] as const,
};

/** Durasi dalam detik */
export const DURATION = {
  fast: 0.2,
  base: 0.45,
  slow: 0.8,
  /** Teks naik dari balik garis (per baris) */
  textLine: 0.9,
  /** Zoom-out foto hero 1.1 → 1 */
  heroZoom: 1.6,
  /** Ganti panel cabang */
  swap: 0.35,
};

/** Jeda antar-elemen berurutan (detik) */
export const STAGGER = {
  /** Kartu dalam grid */
  item: 0.07,
  /** Baris judul hero */
  line: 0.12,
  /** Batas maksimum total jeda agar elemen ke-20 tidak menunggu terlalu lama */
  max: 0.35,
};

/** Jarak geser saat muncul (px) */
export const DISTANCE = {
  reveal: 24,
  swap: 20,
};

/** Preloader: total maks. 1,5 detik (termasuk tirai membuka) */
export const PRELOADER = {
  /** Lama penghitung 0 → 100% */
  count: 0.95,
  /** Tirai membuka */
  exit: 0.45,
  /** Batas keras (ms): apa pun yang terjadi, preloader selesai */
  maxMs: 1500,
  sessionKey: 'cutless:preloaded',
};

/** Transisi antarhalaman: tutup + buka ≤ 400 ms */
export const PAGE_TRANSITION = {
  cover: 0.2,
  reveal: 0.2,
  sessionKey: 'cutless:page-transition',
};

/**
 * Parallax: fraksi pergeseran terhadap tinggi elemen.
 * Mobile (≤ 767px) memakai nilai lebih kecil agar ringan & tidak memusingkan.
 */
export const PARALLAX = {
  heroMedia: { desktop: 0.18, mobile: 0.08 },
  editorialTitle: { desktop: -0.22, mobile: -0.08 },
  editorialPhoto: { desktop: 0.12, mobile: 0.05 },
};

/** Kartu yang membesar (scroll-linked) */
export const EXPAND = {
  /** Skala awal kartu (1 = lebar penuh) */
  startScale: { desktop: 0.78, mobile: 0.9 },
};

/** Kecepatan marquee foto hairstylist (detik per putaran) */
export const MARQUEE = {
  vertical: 38,
  horizontal: 30,
};

/** Hitung naik statistik */
export const COUNT_UP = {
  duration: 1.6,
};

/** Delay berurutan yang dibatasi STAGGER.max */
export const stagger = (index: number, step: number = STAGGER.item) => Math.min(index * step, STAGGER.max);

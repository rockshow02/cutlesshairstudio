import type { ImageAsset } from './common';

/** Satu partner di pita logo beranda (src/content/partners.json → Pages CMS "Logo Partner") */
export interface PartnerLogo {
  name: string;
  /** null = nama partner tampil sebagai teks outline */
  logo: ImageAsset | null;
  /** null = tidak bisa diklik */
  url: string | null;
  /** Data demo → badge DEMO (staging/dev) */
  isDemo: boolean;
}

export interface PartnerLogosContent {
  /** Teks kecil di atas pita (null = tidak tampil) */
  label: string | null;
  /** aria-label pita, mis. "Partner Cutless Hair Studio" */
  ariaLabel: string;
  items: PartnerLogo[];
  /** false = 1–2 logo: deret statis di tengah tanpa animasi */
  animated: boolean;
}

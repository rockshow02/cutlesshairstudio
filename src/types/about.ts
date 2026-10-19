import type { ImageAsset, SectionHeading } from './common';

export interface AboutValue {
  title: string;
  description: string;
}

export interface AboutStat {
  /** Nilai angka; dianimasikan & diformat id-ID bila `animate` true */
  value: number;
  /** Teks tampil apa adanya (mis. tahun "2021" atau rating "4,9"). Dipakai bila `animate` false. */
  display?: string;
  prefix?: string;
  suffix?: string;
  animate?: boolean;
  label: string;
}

/** Label statistik section Tentang (teks lain dari src/content/about.json, dikelola Pages CMS) */
export interface AboutCopy {
  statLabels: {
    branches: string;
    barbers: string;
    customers: string;
    foundedYear: string;
    rating: string;
    reviewCount: string;
  };
}

/** Satu foto slideshow Tentang Kami. focus = posisi potong (object-position vertikal) */
export interface AboutSlide {
  image: ImageAsset;
  focus: 'top' | 'center' | 'bottom';
}

export interface AboutContent {
  heading: SectionHeading;
  lead: string;
  body: string[];
  /** Minimal 1, maksimal 8. Satu foto = tampil statis */
  slides: AboutSlide[];
  /** Detik per foto */
  slideInterval: number;
  transition: 'crossfade' | 'ken-burns';
  imageCaption: string;
  values: AboutValue[];
  stats: AboutStat[];
}

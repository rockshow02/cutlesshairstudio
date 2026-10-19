import type { Cta, ImageAsset } from './common';

/** Bagian hero yang tidak dikelola CMS (teks & foto ada di src/content/hero.json) */
export interface HeroExtras {
  /** Opsional: video latar (mp4/webm, tanpa suara) */
  video?: { src: string; type: string };
  /** Tujuan tombol kedua */
  secondaryHref: string;
  scrollHint: string;
}

export interface HeroContent {
  kicker: string;
  /** Tiap item = satu baris judul */
  titleLines: string[];
  subtitle: string;
  /** Gambar latar; juga dipakai sebagai poster bila `video` diisi */
  image: ImageAsset;
  /** Opsional: video latar (mp4/webm, tanpa suara) */
  video?: { src: string; type: string };
  primaryCta: Cta;
  secondaryCta: Cta;
  /** Kata-kata untuk strip teks berjalan di bawah hero */
  marquee: string[];
  /** Label indikator scroll di bawah hero */
  scrollHint: string;
}

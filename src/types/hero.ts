import type { Cta, IconName, ImageAsset } from './common';

export interface HeroHighlight {
  icon: IconName;
  text: string;
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
  highlights: HeroHighlight[];
  /** Kata-kata untuk strip teks berjalan di bawah hero */
  marquee: string[];
}

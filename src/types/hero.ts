import type { Cta, ImageAsset } from './common';

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

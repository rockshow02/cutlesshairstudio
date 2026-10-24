import type { ImageAsset } from './common';

/** Kartu foto studio yang membesar saat di-scroll + tagline yang berganti (foto & tagline: src/content/studio.json) */
export interface ShowcaseCopy {
  /** Judul section (hanya untuk screen reader) */
  heading: string;
  /** Foto cadangan bila belum ada cabang yang punya foto */
  fallbackImage: ImageAsset;
}

export interface ShowcaseContent {
  heading: string;
  image: ImageAsset;
  taglines: string[];
}

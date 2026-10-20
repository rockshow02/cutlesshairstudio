import type { Cta, ImageAsset } from './common';

/** Bagian statis CTA penutup (teks & foto di src/content/cta.json) */
export interface CtaBannerCopy {
  /** Foto latar cadangan bila foto di CMS kosong */
  fallbackImage: ImageAsset;
}

export interface CtaBannerContent {
  kicker: string;
  title: string;
  description: string;
  cta: Cta;
  backgroundImage: ImageAsset;
}

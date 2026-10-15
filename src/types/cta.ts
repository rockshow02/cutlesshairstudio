import type { Cta, ImageAsset } from './common';

export interface CtaBannerContent {
  kicker: string;
  title: string;
  description: string;
  cta: Cta;
  backgroundImage: ImageAsset;
}

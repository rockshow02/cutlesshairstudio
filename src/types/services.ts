import type { IconName, ImageAsset, SectionHeading } from './common';

export interface Service {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  /** Opsional: foto layanan; bila diisi, tampil di atas kartu */
  image?: ImageAsset;
  /** Harga mulai, Rupiah (angka bulat). Contoh: 75000 */
  startingPrice?: number;
}

export interface ServicesContent {
  heading: SectionHeading;
  items: Service[];
}

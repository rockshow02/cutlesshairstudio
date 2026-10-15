import type { IconName, ImageAsset, SectionHeading } from './common';
import type { PriceCategoryKey } from './pricing';

export interface Service {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  /** Opsional: foto layanan; bila diisi, tampil di atas kartu */
  image?: ImageAsset;
  /** Kategori Daftar Harga sumber "mulai Rp..." (harga terendah item aktif di kategori ini) */
  pricingCategory?: Exclude<PriceCategoryKey, 'Paket'>;
  /** Dihitung otomatis dari Daftar Harga (cabang terpilih, atau terendah semua cabang). Kosong → "Tanya harga" */
  startingPrice?: number;
}

export interface ServicesContent {
  heading: SectionHeading;
  items: Service[];
}

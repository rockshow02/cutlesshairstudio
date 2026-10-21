import type { IconName, ImageAsset, SectionHeading } from './common';
import type { PriceCategoryKey } from './pricing';

export interface Service {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  /** Opsional: foto layanan; bila diisi, tampil di atas kartu */
  image?: ImageAsset;
  /** Tautan "Lihat harga" ke kategori di Daftar Harga (#harga-…); kosong = tanpa tautan. Kartu tidak menampilkan harga */
  priceHref?: string;
  /** Kategori harga terkait (untuk memilih tab kategori di HP) */
  pricingCategory?: Exclude<PriceCategoryKey, 'Paket'>;
}

/** Bagian statis section Layanan (src/content/services.ts); kartu dari Pages CMS → Kartu Layanan */
export interface ServicesCopy {
  heading: SectionHeading;
}

export interface ServicesContent {
  heading: SectionHeading;
  items: Service[];
}

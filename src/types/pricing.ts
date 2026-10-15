import type { SectionHeading } from './common';

/** Kategori harga. Sama persis dengan enum `category` di CMS (Pricing Item). */
export type PriceCategoryKey = 'Haircut' | 'Shaving' | 'Coloring' | 'Treatment' | 'Kids' | 'Paket';

/** Badge opsional. Sama dengan enum `badge` di CMS. */
export type PriceBadge = 'Best Seller' | 'Baru' | 'Promo';

export interface PriceItem {
  id: string;
  name: string;
  description?: string;
  /** Rupiah, angka bulat. Contoh: 75000 */
  price: number;
  /** true = tampil "mulai Rp..." */
  priceFrom?: boolean;
  badge?: PriceBadge;
  /** true bila belum memilih cabang dan harga berbeda antar cabang (tampil "mulai" harga terendah) */
  varies?: boolean;
}

export interface PriceCategory {
  /** Kunci kategori (semua kecuali 'Paket', yang tampil sebagai kartu paket) */
  id: Exclude<PriceCategoryKey, 'Paket'>;
  name: string;
  items: PriceItem[];
}

export interface PricePackage {
  id: string;
  name: string;
  tag: string;
  /** Rupiah, angka bulat */
  price: number;
  /** Contoh: "/ 4x haircut" */
  unit?: string;
  features: string[];
  featured?: boolean;
  badge?: PriceBadge;
  ctaLabel: string;
}

export interface PricingContent {
  heading: SectionHeading;
  /** Cabang yang harganya ditampilkan (kosong = harga dasar/terendah) */
  branchSlug?: string;
  branchName?: string;
  /** Ada item dengan harga khusus cabang */
  hasBranchPrices: boolean;
  categories: PriceCategory[];
  packagesTitle: string;
  packages: PricePackage[];
}

/** Teks statis section Harga (item harga sendiri dikelola di src/content/pricing.json) */
export interface PricingCopy {
  heading: SectionHeading;
  /** Label kategori yang tampil di website, per kunci kategori */
  categoryLabels: Record<Exclude<PriceCategoryKey, 'Paket'>, string>;
  packagesTitle: string;
  packageCtaLabel: string;
  /** Tag kartu paket bila entri tidak punya badge */
  packageDefaultTag: string;
}

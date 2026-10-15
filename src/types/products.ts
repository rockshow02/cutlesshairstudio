import type { ImageAsset, SectionHeading } from './common';
import type { PriceBadge } from './pricing';

/** Kategori produk. Sama dengan enum `category` di src/content/schema.ts & .pages.yml */
export type ProductCategory =
  | 'Pomade'
  | 'Hair Clay'
  | 'Hair Powder'
  | 'Hair Tonic'
  | 'Hair Spray'
  | 'Shampoo & Conditioner'
  | 'Beard Care'
  | 'Aksesoris'
  | 'Lainnya';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  /** Rupiah, angka bulat */
  price: number;
  /** Harga sebelum diskon (dicoret) */
  compareAtPrice?: number;
  size?: string;
  description?: string;
  /** Kosong → tampil gambar placeholder bermerek */
  image?: ImageAsset;
  badge?: PriceBadge;
  inStock: boolean;
  shopeeUrl?: string;
  tokopediaUrl?: string;
}

export interface ProductsCopy {
  heading: SectionHeading;
  /** Judul & teks section ringkas di halaman utama */
  teaserHeading: SectionHeading;
  labels: {
    filterLabel: string;
    filterAll: string;
    order: string;
    /** Versi pendek tombol pesan untuk kartu sempit (mobile) */
    orderShort: string;
    askRestock: string;
    outOfStock: string;
    normalPrice: string;
    alsoAt: string;
    viewAll: string;
    empty: string;
  };
  howToOrder: {
    title: string;
    steps: { title: string; description: string }[];
  };
}

export interface ProductsContent extends ProductsCopy {
  /** Kategori yang punya produk aktif, urut sesuai daftar kategori */
  categories: ProductCategory[];
  items: Product[];
}

import type { ImageAsset, SectionHeading } from './common';

/** square = 1x1 sel, tall = 1 kolom x 2 baris, wide = 2 kolom x 1 baris */
export type GalleryLayout = 'square' | 'tall' | 'wide';

/** Kategori gaya. Sama dengan enum `styleCategory` di CMS. */
export type GalleryStyle = 'Fade' | 'Pompadour' | 'Crop' | 'Coloring' | 'Perming' | 'Lainnya';

export interface GalleryItem {
  id: string;
  image: ImageAsset;
  /** Opsional: versi besar untuk lightbox; bila kosong pakai image.src */
  fullSrc?: string;
  /** Opsional; bila kosong dipakai alt text gambar */
  caption?: string;
  layout: GalleryLayout;
  styleCategory?: GalleryStyle;
}

export interface BeforeAfter {
  id: string;
  kicker: string;
  title: string;
  description: string;
  /** Foto sebelum & sesudah harus berukuran dan bersudut kamera sama */
  before: ImageAsset;
  after: ImageAsset;
  beforeLabel: string;
  afterLabel: string;
  sliderLabel: string;
}

export interface GalleryContent {
  heading: SectionHeading;
  items: GalleryItem[];
  beforeAfter: BeforeAfter[];
}

/** Teks statis section Galeri + before/after (foto galeri di src/content/gallery.json) */
export type GalleryCopy = Omit<GalleryContent, 'items'>;

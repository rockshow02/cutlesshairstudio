/**
 * Data Kabar, Promo & Acara di browser (tanpa server): ringkasan item terbit dari modul virtual:kabar (dibangkitkan saat
 * build oleh scripts/vite-content-plugin.ts, termasuk yang sudah berakhir; kosong bila Tampilkan Kabar mati), dan item
 * yang sedang dibuka dari <script id="kabar-item"> di HTML halaman detail.
 */
import kabar from 'virtual:kabar';
import { responsiveImage } from '@/lib/contentTransforms';
import type { KabarArticle, KabarSummary } from '@/content/kabarSeo';
import type { ImageAsset } from '@/types';

/** Item terbit, terbaru dulu (status berlangsung/berakhir dihitung dari jam pengunjung, lihat groupKabar) */
export const getKabar = (): KabarSummary[] => kabar;

/** Item halaman ini (/kabar/<slug>/); undefined di halaman daftar */
export function getCurrentKabar(): KabarArticle | undefined {
  const el = typeof document === 'undefined' ? null : document.getElementById('kabar-item');
  if (!el?.textContent) return undefined;
  try {
    return JSON.parse(el.textContent) as KabarArticle;
  } catch {
    return undefined;
  }
}

/** Gambar item (opsional): ukuran asli dari virtual:image-meta, srcset otomatis dari versi kecil */
export const kabarImage = (k: KabarSummary, sizes: string): ImageAsset | undefined =>
  k.image ? responsiveImage(k.image, k.imageAlt ?? '', sizes, { width: 1600, height: 900 }) : undefined;

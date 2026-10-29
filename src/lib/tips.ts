/**
 * Data Tips & Trik di browser (tanpa server): ringkasan artikel terbit dari modul virtual:tips (dibangkitkan saat
 * build oleh scripts/vite-content-plugin.ts, kosong bila Tampilkan Tips & Trik mati), dan isi artikel yang sedang
 * dibuka dari <script id="tip-article"> di HTML halaman itu (diprerender, jadi isi artikel tidak ikut di setiap bundle).
 */
import tips from 'virtual:tips';
import { responsiveImage } from '@/lib/contentTransforms';
import { categorySlug, TIP_CATEGORIES, type TipArticle, type TipSummary } from '@/content/tipsSeo';
import type { ImageAsset } from '@/types';

/** Artikel terbit, terbaru dulu */
export const getTips = (): TipSummary[] => tips;

/** Artikel halaman ini (/tips/<slug>/); undefined di halaman daftar / slug tidak dikenal */
export function getCurrentTip(): TipArticle | undefined {
  const el = typeof document === 'undefined' ? null : document.getElementById('tip-article');
  if (!el?.textContent) return undefined;
  try {
    return JSON.parse(el.textContent) as TipArticle;
  } catch {
    return undefined;
  }
}

/** Slug artikel dari URL, mis. /tips/cara-merawat-rambut/ → "cara-merawat-rambut" (bukan /tips/halaman/2/) */
export function tipSlugFromPath(pathname: string): string | undefined {
  const m = pathname.match(/\/tips\/([a-z0-9-]+)\/?$/);
  return m && m[1] !== 'halaman' ? m[1] : undefined;
}

/** Nomor halaman daftar dari URL: /tips/halaman/2/ → 2, selain itu 1 */
export const tipsPageFromPath = (pathname: string): number => Number(pathname.match(/\/tips\/halaman\/(\d+)\/?$/)?.[1] ?? 1);

/** ?kategori=hair-care → "Hair Care" (tidak dikenal → undefined = semua) */
export const categoryFromQuery = (search: string) => {
  const value = new URLSearchParams(search).get('kategori');
  return TIP_CATEGORIES.find((c) => categorySlug(c) === value);
};

/** Foto sampul (ukuran asli dari virtual:image-meta, srcset otomatis dari versi kecil) */
export const tipCover = (t: Pick<TipSummary, 'cover' | 'coverAlt'>, sizes: string): ImageAsset => responsiveImage(t.cover, t.coverAlt, sizes, { width: 1600, height: 900 });

/**
 * Data Tips & Trik di browser (tanpa server): ringkasan artikel terbit dari modul virtual:tips (dibangkitkan saat
 * build oleh scripts/vite-content-plugin.ts, kosong bila Tampilkan Tips & Trik mati), dan isi artikel yang sedang
 * dibuka dari <script id="tip-article"> di HTML halaman itu (diprerender, jadi isi artikel tidak ikut di setiap bundle).
 */
import tips from 'virtual:tips';
import { responsiveImage } from '@/lib/contentTransforms';
import type { TipArticle, TipSummary } from '@/content/tipsSeo';
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

/** Link "Bagikan ke WhatsApp" (tanpa nomor: pengunjung memilih kontak di WhatsApp) */
export const whatsappShareUrl = (title: string, url: string): string => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;

/**
 * Salin teks ke clipboard. Clipboard API ditolak/tidak ada (mis. bukan HTTPS, izin ditolak) → cara lama
 * (textarea + execCommand). Keduanya gagal → false: tampilkan link agar disalin manual.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* lanjut ke cara lama */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Foto sampul (ukuran asli dari virtual:image-meta, srcset otomatis dari versi kecil) */
export const tipCover = (t: Pick<TipSummary, 'cover' | 'coverAlt'>, sizes: string): ImageAsset => responsiveImage(t.cover, t.coverAlt, sizes, { width: 1600, height: 900 });

/**
 * Link Reel/postingan Instagram untuk bagian Video (Pages CMS → Video). Tanpa import runtime: dipakai skema Zod,
 * tampilan, dan plugin build.
 */

/** Link yang diterima setelah dirapikan: https://www.instagram.com/reel/<kode>/ atau /p/<kode>/ */
export const INSTAGRAM_POST_URL = /^https:\/\/www\.instagram\.com\/(?:reel|p)\/[A-Za-z0-9_-]+\/$/;

export const INSTAGRAM_URL_MESSAGE =
  'link harus link Reel atau postingan Instagram, mis. https://www.instagram.com/reel/ABC123xyz/ (di Instagram: ••• / Bagikan → Salin tautan)';

/** Buang parameter (?igsh=..., ?utm_source=...) & #..., tambahkan "/" di akhir. Link lain dibiarkan (ditolak validasi). */
export function normalizeInstagramUrl(value: string): string {
  const trimmed = value.trim();
  const base = trimmed.split(/[?#]/)[0];
  const withSlash = base.endsWith('/') ? base : `${base}/`;
  return INSTAGRAM_POST_URL.test(withSlash) ? withSlash : trimmed;
}

interface VideoEntryLike {
  enabled?: boolean | null;
  items?: { url: string; image: string; caption?: string | null; isActive?: boolean | null; order?: number | null }[] | null;
}

export interface VideoItem {
  url: string;
  image: string;
  caption?: string;
}

/** Video yang tampil: Tampilkan bagian Video aktif, item aktif; urut "Urutan". Kosong = bagian tidak dirender. */
export function activeVideoItems(v: VideoEntryLike | null | undefined): VideoItem[] {
  if (!v?.enabled) return [];
  return (v.items ?? [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.isActive !== false)
    .sort((a, b) => (a.item.order ?? 0) - (b.item.order ?? 0) || a.index - b.index)
    .map(({ item }) => ({ url: normalizeInstagramUrl(item.url), image: item.image, ...(item.caption?.trim() ? { caption: item.caption.trim() } : {}) }));
}

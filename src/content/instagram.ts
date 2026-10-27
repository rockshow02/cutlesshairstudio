/**
 * Link Reel/postingan Instagram untuk bagian Video (Pages CMS → Video). Tanpa import runtime: dipakai skema Zod,
 * tampilan, dan plugin build.
 */

/** Link yang disimpan setelah dirapikan: https://www.instagram.com/reel/<kode>/ atau /p/<kode>/ */
export const INSTAGRAM_POST_URL = /^https:\/\/www\.instagram\.com\/(?:reel|p)\/[A-Za-z0-9_-]+\/$/;

/**
 * Bentuk link yang diterima & dirapikan: https:// + instagram.com / www. / m. + (opsional /<akun>) + /reel/, /reels/,
 * atau /p/ + kode, dengan/tanpa "/" di akhir, ?parameter, dan #...
 */
const ACCEPTED = /^https:\/\/(?:www\.|m\.)?instagram\.com\/(?:[A-Za-z0-9._]+\/)?(reels?|p)\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/i;

export const INSTAGRAM_URL_MESSAGE =
  'link harus link Reel atau postingan Instagram, mis. https://www.instagram.com/reel/ABC123xyz/ (di Instagram: ••• / Bagikan → Salin tautan)';

/** Dirapikan ke https://www.instagram.com/reel/<kode>/ atau /p/<kode>/. Link lain dibiarkan (ditolak validasi). */
export function normalizeInstagramUrl(value: string): string {
  const trimmed = value.trim();
  const m = ACCEPTED.exec(trimmed);
  if (!m) return trimmed;
  return `https://www.instagram.com/${m[1].toLowerCase() === 'p' ? 'p' : 'reel'}/${m[2]}/`;
}

/** Pesan yang menjelaskan kenapa link ditolak (profil, Story, situs lain, ...) */
export function instagramUrlProblem(value: string): string {
  const v = value.trim();
  const host = /^https?:\/\/([^/?#]+)/i.exec(v)?.[1]?.toLowerCase();
  if (!host) return `${INSTAGRAM_URL_MESSAGE}; link harus diawali https://`;
  if (!/^(?:www\.|m\.)?instagram\.com$/.test(host)) {
    return host === 'instagr.am' ? `link pendek instagr.am tidak diterima: buka di Instagram lalu salin link lengkapnya. ${INSTAGRAM_URL_MESSAGE}` : `bukan link Instagram (${host}). ${INSTAGRAM_URL_MESSAGE}`;
  }
  if (!/^https:/i.test(v)) return `${INSTAGRAM_URL_MESSAGE}; link harus diawali https://`;
  const path = v.replace(/^https:\/\/[^/]+/i, '').split(/[?#]/)[0];
  if (/^\/(?:stories|s)\//i.test(path)) return `link Story/Highlight tidak bisa ditampilkan. ${INSTAGRAM_URL_MESSAGE}`;
  if (/^\/[A-Za-z0-9._]+\/?$/.test(path)) return `ini link profil, bukan Reel/postingan. ${INSTAGRAM_URL_MESSAGE}`;
  return INSTAGRAM_URL_MESSAGE;
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

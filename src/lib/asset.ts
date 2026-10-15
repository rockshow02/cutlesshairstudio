/**
 * Resolusi path gambar dari data konten.
 * - URL absolut (https://, data:) dari CMS/CDN dikembalikan apa adanya.
 * - Path lokal (/images/...) diberi prefix BASE_URL Vite agar tetap jalan bila situs di-deploy di sub-folder.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function asset(path: string): string {
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return `${BASE}/${path.replace(/^\//, '')}`;
}

/** Terapkan asset() ke setiap kandidat dalam srcset. */
export function assetSrcSet(srcSet?: string): string | undefined {
  if (!srcSet) return undefined;
  return srcSet
    .split(',')
    .map((part) => {
      const [url, descriptor] = part.trim().split(/\s+/);
      return descriptor ? `${asset(url)} ${descriptor}` : asset(url);
    })
    .join(', ');
}

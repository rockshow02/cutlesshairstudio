/**
 * srcset otomatis dari versi kecil sebuah gambar: file sefolder dengan awalan nama yang sama dan akhiran lebar,
 * mis. /uploads/about/kursi.webp + kursi-600.webp, atau /images/hero/hero-1920.jpg + hero-1280.jpg.
 * Versi kecil dibuat scripts/optimize-images.mjs; ukuran dibaca dari virtual:image-meta (public/uploads & public/images).
 * Tanpa alias "@/": dipakai juga oleh plugin Vite (scripts/vite-content-plugin.ts).
 */
export type ImageMeta = Record<string, { width: number; height: number }>;

const SIZED = /-(\d+)\.(webp|jpe?g|png|avif)$/i;

/** Semua versi (termasuk aslinya) yang terdaftar di meta, urut dari yang terkecil */
export function imageVariants(src: string, meta: ImageMeta): { src: string; width: number }[] {
  const slash = src.lastIndexOf('/');
  const dir = src.slice(0, slash + 1);
  const stem = src.slice(slash + 1).replace(/\.[a-z0-9]+$/i, '');
  // hero-1920.jpg → keluarga "hero-"; kursi-2.webp (nama unik, bukan lebar) → keluarga "kursi-2-"
  const sized = stem.match(/-(\d+)$/);
  const base = sized && meta[src]?.width === Number(sized[1]) ? stem.slice(0, -sized[0].length) : stem;
  const prefix = `${dir}${base}-`;
  const found = new Map<number, string>();
  if (meta[src]) found.set(meta[src].width, src);
  for (const [key, size] of Object.entries(meta)) {
    const m = key.startsWith(prefix) ? key.slice(prefix.length - 1).match(SIZED) : null;
    // Hanya file yang akhirannya benar-benar lebarnya (bukan nama biasa seperti foto-2.webp)
    if (m && key.slice(prefix.length).match(/^\d+\./) && Number(m[1]) === size.width && !found.has(size.width)) found.set(size.width, key);
  }
  return [...found].map(([width, file]) => ({ src: file, width })).sort((a, b) => a.width - b.width);
}

/** "a-600.webp 600w, a.webp 1200w" bila ada lebih dari satu versi, selain itu undefined */
export function srcSetOf(src: string, meta: ImageMeta): string | undefined {
  const v = imageVariants(src, meta);
  return v.length > 1 ? v.map((x) => `${x.src} ${x.width}w`).join(', ') : undefined;
}

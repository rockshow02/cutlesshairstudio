/** Galeri: foto untuk kolom foto berjalan (section Lokasi): toggle, titik fokus, srcset versi kecil. */
import { describe, expect, it } from 'vitest';
import { galleryCopy } from '../src/content/gallery';
import { galleryItemSchema } from '../src/content/schema';
import { buildGallery } from '../src/lib/contentTransforms';
import type { GalleryEntry } from '../src/content/schema';

// Data uji (bukan gallery.json asli: jumlah & isi foto diubah admin kapan saja)
const raw = [1, 2, 3, 4, 5].map((n) =>
  galleryItemSchema.parse({ image: `/uploads/gallery/foto-${n}.webp`, altText: `Foto galeri ${n}`, focalPoint: 'atas', showInMarquee: true, order: n * 10 }),
) as GalleryEntry[];

describe('galeri untuk kolom foto berjalan', () => {
  it('bawaan: ikut berjalan & fokus atas (isian lama tanpa kedua field)', () => {
    const parsed = galleryItemSchema.parse({ image: '/uploads/gallery/a.webp', altText: 'Fade' });
    expect(parsed).toMatchObject({ showInMarquee: true, focalPoint: 'atas' });
  });

  it('toggle & titik fokus diteruskan; item nonaktif tidak ikut; urutan sesuai order', () => {
    const entries = raw.map((g, i) => ({ ...g, showInMarquee: i !== 1, focalPoint: i === 2 ? 'bawah' : g.focalPoint, isActive: i !== 3 })) as GalleryEntry[];
    const items = buildGallery(entries, galleryCopy, false).items;
    expect(items).toHaveLength(raw.length - 1);
    expect(items[1].showInMarquee).toBe(false);
    expect(items[2].focus).toBe('bottom');
    expect(items[0].focus).toBe('top');
    const orders = entries.filter((e) => e.isActive !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((e) => e.altText);
    expect(items.map((i) => i.thumb.alt)).toEqual(orders);
  });

  it('kartu memakai alt text item galeri dan ukuran kecil (sizes) untuk kartu', () => {
    const [first] = buildGallery(raw, galleryCopy, false).items;
    expect(first.thumb.alt).toBe(raw.find((g) => g.isActive !== false)!.altText);
    expect(first.image.srcSet).toBeUndefined(); // section Galeri tetap memakai gambar besar
  });
});

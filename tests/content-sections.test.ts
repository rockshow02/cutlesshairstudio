/** Hero, Tentang Kami (slideshow), Kartu Studio: skema Pages CMS & srcset otomatis dari versi kecil. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aboutSchema, heroSchema, studioSchema } from '../src/content/schema';
import { imageVariants, srcSetOf } from '../src/lib/responsiveImage';
import { rawFixture } from './helpers/contentFixture';

const json = (file: string) => JSON.parse(readFileSync(`src/content/${file}`, 'utf8'));
const photo = (n: number) => ({ src: `/uploads/about/foto-${n}.webp`, alt: `Foto ${n}` });

describe('skema konten', () => {
  it('file hero.json, about.json, studio.json yang ada valid', () => {
    expect(heroSchema.safeParse(json('hero.json')).success).toBe(true);
    expect(aboutSchema.safeParse(json('about.json')).success).toBe(true);
    expect(studioSchema.safeParse(json('studio.json')).success).toBe(true);
  });

  it('slideshow: 1–8 foto, alt wajib, titik fokus atas/tengah/bawah, default jeda 5 detik & crossfade', () => {
    // Data uji sebagai dasar (about.json asli hanya diperiksa lolos skema di atas)
    const base: Record<string, unknown> = { ...rawFixture.about, slideInterval: 6, transition: 'ken-burns' };
    const parse = (images: unknown[], extra: Record<string, unknown> = {}) => aboutSchema.safeParse({ ...base, images, ...extra });
    expect(parse([]).success).toBe(false);
    expect(parse(Array.from({ length: 9 }, (_, i) => photo(i))).success).toBe(false);
    expect(parse(Array.from({ length: 8 }, (_, i) => photo(i))).success).toBe(true);
    expect(parse([{ src: '/uploads/about/a.webp', alt: '' }]).success).toBe(false);
    expect(parse([{ ...photo(1), focalPoint: 'kiri' }]).success).toBe(false);
    expect(parse([{ ...photo(1), focalPoint: 'atas' }]).success).toBe(true);
    // Tautan langsung ke Google Drive ditolak (harus di-upload ke /uploads/about)
    expect(parse([{ src: 'https://drive.google.com/uc?id=abc', alt: 'x' }]).success).toBe(false);
    const { slideInterval: _i, transition: _t, ...noSettings } = base;
    const d = aboutSchema.parse({ ...noSettings, images: [photo(1)] });
    expect(d).toMatchObject({ slideInterval: 5, transition: 'crossfade' });
    expect(parse([photo(1)], { transition: 'zoom' }).success).toBe(false);
    expect(parse([photo(1)], { slideInterval: 1 }).success).toBe(false);
  });

  it('kartu studio: foto opsional, tetapi deskripsi wajib bila foto diisi', () => {
    expect(studioSchema.safeParse({ image: '', imageAlt: '', taglines: ['On point, always.'] }).success).toBe(true);
    expect(studioSchema.safeParse({ image: '/uploads/studio/a.webp', imageAlt: '', taglines: ['x'] }).success).toBe(false);
    expect(studioSchema.safeParse({ image: '/uploads/studio/a.webp', imageAlt: 'Studio', taglines: [] }).success).toBe(false);
  });
});

describe('srcset otomatis', () => {
  const meta = {
    '/uploads/about/kursi.webp': { width: 1200, height: 1500 },
    '/uploads/about/kursi-600.webp': { width: 600, height: 750 },
    '/uploads/about/kursi-2.webp': { width: 1200, height: 1500 },
    '/images/hero/hero-1920.jpg': { width: 1920, height: 1000 },
    '/images/hero/hero-1280.jpg': { width: 1280, height: 667 },
    '/images/hero/hero-mobile.jpg': { width: 750, height: 1334 },
  };

  it('foto + versi kecilnya, urut dari terkecil', () => {
    expect(srcSetOf('/uploads/about/kursi.webp', meta)).toBe('/uploads/about/kursi-600.webp 600w, /uploads/about/kursi.webp 1200w');
    expect(srcSetOf('/images/hero/hero-1920.jpg', meta)).toBe('/images/hero/hero-1280.jpg 1280w, /images/hero/hero-1920.jpg 1920w');
  });

  it('nama unik (kursi-2) bukan versi kecil foto lain; foto tanpa versi kecil → tanpa srcset', () => {
    expect(imageVariants('/uploads/about/kursi-2.webp', meta).map((v) => v.src)).toEqual(['/uploads/about/kursi-2.webp']);
    expect(srcSetOf('/uploads/about/kursi-2.webp', meta)).toBeUndefined();
    expect(srcSetOf('/images/hero/hero-mobile.jpg', meta)).toBeUndefined();
  });
});

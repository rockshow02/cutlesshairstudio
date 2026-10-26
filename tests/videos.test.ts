/**
 * Bagian Video (Pages CMS → Video): validasi link Instagram (parameter dibuang otomatis), skema, item tampil, form CMS,
 * pemeriksaan launch, tampilan facade (tanpa skrip Instagram), dan HTML statis beranda.
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { crossCheck, videosSchema, type ContentBundle, type VideosEntry } from '../src/content/schema';
import { activeVideoItems, normalizeInstagramUrl } from '../src/content/instagram';
import { videosCopy } from '../src/content/videos';
import { buildVideos } from '../src/lib/contentTransforms';
import { VideosView } from '../src/components/sections/Videos';
import { homeBody } from '../scripts/vite-content-plugin';
import { setMedia, validateCmsContent, type CmsField, type CmsMedia } from './helpers/pagesCms';

const REEL = 'https://www.instagram.com/reel/ABC123xyz/';
const POST = 'https://www.instagram.com/p/Xy_9-z/';
const item = (extra: Record<string, unknown> = {}) => ({ url: REEL, image: '/uploads/video-covers/sampul.webp', caption: 'Proses skin fade', ...extra });
const videos = (extra: Partial<Record<keyof VideosEntry, unknown>> = {}): VideosEntry =>
  videosSchema.parse({
    enabled: true,
    title: 'Video uji',
    items: [item({ url: POST, caption: 'Kedua', order: 20 }), item({ caption: 'Pertama', order: 10 }), item({ url: 'https://www.instagram.com/reel/Mati/', caption: 'Nonaktif', isActive: false, order: 30 })],
    ...extra,
  });

describe('Video: link Instagram', () => {
  it('parameter & #... dibuang, "/" ditambahkan; link lain tidak diubah', () => {
    expect(normalizeInstagramUrl('https://www.instagram.com/reel/ABC123xyz/?igsh=MWx2c3Q0&utm_source=ig_web_copy_link')).toBe(REEL);
    expect(normalizeInstagramUrl(' https://www.instagram.com/p/Xy_9-z?img_index=1#komentar ')).toBe(POST);
    expect(normalizeInstagramUrl(REEL)).toBe(REEL);
    expect(normalizeInstagramUrl('https://www.instagram.com/cutlesshairstudio/?hl=id')).toBe('https://www.instagram.com/cutlesshairstudio/?hl=id');
  });

  it('hanya https://www.instagram.com/reel/... atau /p/... yang diterima (pesan error menjelaskan format)', () => {
    const urlOf = (url: string) => videosSchema.safeParse({ title: 'X', items: [item({ url })] });
    expect(urlOf(`${REEL}?igsh=abc`).data?.items[0].url).toBe(REEL);
    expect(urlOf(POST).success).toBe(true);
    for (const bad of [
      'https://www.instagram.com/cutlesshairstudio/',
      'https://www.instagram.com/stories/cutlesshairstudio/123/',
      'https://instagram.com/reel/ABC123xyz/',
      'http://www.instagram.com/reel/ABC123xyz/',
      'https://www.instagram.com/reels/ABC123xyz/',
      'https://www.instagram.com/reel/ABC123xyz/lainnya/',
      'https://www.tiktok.com/@cutless/video/1',
      '',
    ]) {
      const r = urlOf(bad);
      expect(r.success, bad).toBe(false);
      expect(r.error?.issues[0].message, bad).toMatch(bad ? /link Reel atau postingan Instagram, mis\. https:\/\/www\.instagram\.com\/reel\// : /wajib diisi/);
    }
  });
});

describe('Video: skema & item tampil', () => {
  it('default mati; judul ≤ 80, teks kecil ≤ 40, keterangan ≤ 120, maks. 6 video, foto sampul wajib JPG/PNG/WebP', () => {
    expect(videosSchema.parse({ title: 'X' })).toMatchObject({ enabled: false, items: [] });
    expect(videosSchema.safeParse({ title: '' }).success).toBe(false);
    expect(videosSchema.safeParse({ title: 'x'.repeat(81) }).success).toBe(false);
    expect(videosSchema.safeParse({ title: 'X', kicker: 'x'.repeat(41) }).success).toBe(false);
    expect(videosSchema.safeParse({ title: 'X', items: [item({ caption: 'x'.repeat(120) })] }).success).toBe(true);
    expect(videosSchema.safeParse({ title: 'X', items: [item({ caption: 'x'.repeat(121) })] }).success).toBe(false);
    expect(videosSchema.safeParse({ title: 'X', items: Array.from({ length: 6 }, () => item()) }).success).toBe(true);
    expect(videosSchema.safeParse({ title: 'X', items: Array.from({ length: 7 }, () => item()) }).error?.issues[0].message).toBe('maksimal 6 video');
    expect(videosSchema.safeParse({ title: 'X', items: [item({ image: undefined })] }).success).toBe(false);
    expect(videosSchema.safeParse({ title: 'X', items: [item({ image: '/uploads/video-covers/a.gif' })] }).success).toBe(false);
    expect(videosSchema.safeParse({ title: 'X', items: [item({ image: '/uploads/video-covers/A.JPG' })] }).success).toBe(true);
  });

  it('tampil: bagian aktif & item aktif, urut Urutan; mati / kosong → bagian tidak dirender', () => {
    expect(activeVideoItems(videos()).map((v) => v.caption)).toEqual(['Pertama', 'Kedua']);
    expect(activeVideoItems(videos({ enabled: false }))).toEqual([]);
    expect(buildVideos(videos({ enabled: false }), videosCopy)).toBeNull();
    expect(buildVideos(videos({ items: [] }), videosCopy)).toBeNull();
    const data = buildVideos(videos(), videosCopy)!;
    expect(data.heading).toEqual({ kicker: 'Video', title: 'Video uji' });
    expect(data.items.map((v) => [v.url, v.image.alt])).toEqual([
      [REEL, 'Pertama'],
      [POST, 'Kedua'],
    ]);
    // Tanpa keterangan: label "video 1" untuk pembaca layar
    expect(buildVideos(videos({ items: [item({ caption: '' })] }), videosCopy)!.items[0].image.alt).toBe('video 1');
  });

  it('tampilan awal = facade: foto sampul + tombol putar berlabel + link cadangan, tanpa skrip/iframe Instagram', () => {
    const html = renderToStaticMarkup(createElement(VideosView, { data: buildVideos(videos(), videosCopy)! }));
    expect(html).toContain('id="video"');
    expect(html.match(/<button type="button"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Putar video: Pertama"');
    expect(html).toMatch(new RegExp(`<a class="[^"]*watch[^"]*" href="${REEL}" target="_blank" rel="noopener noreferrer">`));
    expect(html).toContain('Tonton di Instagram');
    expect(html).not.toMatch(/embed\.js|<iframe|instagram-media/);
    expect(html).not.toContain('Nonaktif');
  });
});

describe('Video: Pages CMS & build', () => {
  const config = parse(readFileSync('.pages.yml', 'utf8')) as { media: CmsMedia[]; content: { name: string; path: string; fields: CmsField[] }[] };
  setMedia(config.media);
  const entry = config.content.find((c) => c.name === 'videos')!;
  const form = (items: Record<string, unknown>[]) => validateCmsContent(entry, { enabled: true, title: 'Video', items });

  it('form CMS: link dengan ?igsh=... bisa disimpan; link profil, folder lain, keterangan kepanjangan, > 6 video ditolak', () => {
    expect(form([item({ url: `${REEL}?igsh=MWx2c3Q0` }), item({ url: POST, caption: '' })])).toEqual([]);
    expect(form([item({ url: 'https://www.instagram.com/cutlesshairstudio/' })])[0]).toMatch(/url: tidak cocok pola/);
    expect(form([item({ image: '/uploads/gallery/a.webp' })])[0]).toMatch(/folder media \/uploads\/video-covers/);
    expect(form([item({ image: '/uploads/video-covers/a.mp4' })])[0]).toMatch(/ekstensi \.mp4/);
    expect(form([item({ image: '' })])[0]).toMatch(/image: wajib diisi/);
    expect(form([item({ caption: 'x'.repeat(121) })])[0]).toMatch(/lebih dari 120 karakter/);
    expect(form(Array.from({ length: 7 }, () => item())).join()).toMatch(/maksimal 6 isian/);
  });

  it('pemeriksaan launch: bagian aktif tanpa video aktif ditandai; mati tidak', () => {
    const launch = (v: VideosEntry) => crossCheck({ ...minimalBundle(), videos: v } as unknown as ContentBundle).launch.filter((i) => i.file === 'videos.json');
    expect(launch(videos({ items: [item({ isActive: false })] })).map((i) => i.where)).toEqual(['Tampilkan bagian Video']);
    expect(launch(videos())).toEqual([]);
    expect(launch(videos({ enabled: false, items: [] }))).toEqual([]);
  });

  it('HTML statis beranda: judul, keterangan & link video hanya bila bagian Video tampil', () => {
    const on = homeBody({ ...minimalBundle(), videos: videos() } as unknown as ContentBundle);
    expect(on).toContain(`<p>Video</p><h2>Video uji</h2><ul><li><p>Pertama</p><a href="${REEL}">Tonton di Instagram</a></li><li><p>Kedua</p><a href="${POST}">Tonton di Instagram</a></li></ul>`);
    expect(on).not.toContain('Nonaktif');
    for (const off of [videos({ enabled: false }), videos({ items: [] })]) {
      const html = homeBody({ ...minimalBundle(), videos: off } as unknown as ContentBundle);
      expect(html).not.toContain('Video uji');
      expect(html).not.toContain('instagram.com/reel');
    }
  });
});

/** Bundle minimal untuk crossCheck & homeBody */
function minimalBundle() {
  const everyDay = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((day) => ({ day, openTime: '09:00', closeTime: '21:00', isClosed: false }));
  return {
    settings: { siteUrl: 'https://cutlesshairstudio.com', siteName: 'Cutless Uji', mainWhatsappNumber: '6281100000909', email: '', stats: {}, showProducts: false },
    branches: [{ slug: 'bogor', name: 'Bogor', city: 'Bogor', province: 'Jawa Barat', whatsappNumber: '6281100000101', openingHours: everyDay, status: 'Aktif', order: 0 }],
    pricing: [],
    barbers: [],
    gallery: [],
    promos: [],
    announcements: [],
    testimonials: [],
    products: [],
    partners: { enabled: false, logos: [] },
    services: [],
    hero: { titleLines: ['Cut Less.'] },
    about: {},
    studio: {},
    cta: {},
    shoeCare: { enabled: false, branchSlug: 'bogor', services: [] },
    faq: { enabled: false, title: 'FAQ', items: [] },
  };
}

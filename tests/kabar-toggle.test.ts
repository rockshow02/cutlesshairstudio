/**
 * Toggle Tampilkan Kabar di build (scripts/vite-content-plugin.ts): mati → tidak ada di sitemap, llms.txt, menu,
 * daftar halaman klik WA, & /kabar(/*) 301 ke beranda; aktif → /kabar/ & detail ikut. Kotak "Promo & acara" di
 * ringkasan statis halaman cabang. Data uji saja (contentFixture + item ditulis di sini), bukan isi CMS.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { branchBody, homeBody, llmsTxt, sitemap, waClickAllowlist, withDisabledRedirects } from '../scripts/vite-content-plugin';
import { kabarRedirects, type KabarSummary } from '../src/content/kabarSeo';
import { settingsSchema } from '../src/content/schema';
import { site as baseSite } from '../src/content/site';
import { buildSite } from '../src/lib/contentTransforms';
import { contentFixture, rawFixture } from './helpers/contentFixture';

const NOW = Date.parse('2026-11-06T10:00:00+07:00');
const SITE_URL = 'https://cutlesshairstudio.com';

const item = (o: Partial<KabarSummary> & Pick<KabarSummary, 'slug' | 'kind' | 'branches'>): KabarSummary => ({
  title: `Judul ${o.slug}`,
  summary: `Ringkasan ${o.slug}.`,
  publishedAt: '2026-11-01',
  ...o,
});

const PROMO_CIBUBUR = item({ slug: 'promo-cibubur', kind: 'Promo', branches: ['cibubur'], validUntil: '2026-12-31' });
const PROMO_SEMUA = item({ slug: 'promo-semua', kind: 'Promo', branches: ['semua'], validUntil: '2026-11-30' });
const PROMO_BOGOR = item({ slug: 'promo-bogor', kind: 'Promo', branches: ['bogor-bantarjati'], validUntil: '2026-12-31' });
const PROMO_LEWAT = item({ slug: 'promo-lewat', kind: 'Promo', branches: ['cibubur'], validUntil: '2026-10-01' });
const KABAR_CIBUBUR = item({ slug: 'kabar-cibubur', kind: 'Kabar', branches: ['cibubur'] });

const bundleWith = (showKabar: boolean, showKabarBanner = false) => contentFixture({ settings: { ...contentFixture().settings, showKabar, showKabarBanner } });
const cibubur = contentFixture().branches.find((b) => b.slug === 'cibubur')!;

describe('Kabar mati (default)', () => {
  const bundle = bundleWith(false);
  const items = [PROMO_CIBUBUR, PROMO_LEWAT];

  it('tidak ada di sitemap, llms.txt, & daftar halaman klik WA', () => {
    expect(contentFixture().settings.showKabar).toBe(false);
    expect(sitemap(bundle, [], [], items)).not.toContain('/kabar');
    expect(llmsTxt(bundle, [], [], items, NOW)).not.toContain('/kabar');
    expect(waClickAllowlist(bundle, [], [], items).pages.some((p) => p.startsWith('/kabar'))).toBe(false);
  });

  it('menu tanpa Kabar', () => {
    const settings = settingsSchema.parse({ ...rawFixture.settings, showKabar: false });
    expect(buildSite(settings, baseSite, []).nav.some((n) => n.href?.startsWith('/kabar'))).toBe(false);
  });

  it('_redirects memuat /kabar & /kabar/* 301 ke beranda', () => {
    const out = withDisabledRedirects('/booking  /  301\n', bundle);
    for (const rule of kabarRedirects(false)) expect(out).toContain(rule);
    expect(out.startsWith('/booking  /  301\n')).toBe(true);
    // Idempoten: build kedua tidak menggandakan aturan
    expect(withDisabledRedirects(out, bundle)).toBe(out);
  });
});

describe('Kabar aktif', () => {
  const bundle = bundleWith(true);
  const items = [PROMO_CIBUBUR, PROMO_LEWAT];

  it('sitemap memuat /kabar/ & kedua detail (termasuk yang sudah berakhir)', () => {
    const xml = sitemap(bundle, [], [], items);
    expect(xml).toContain(`<loc>${SITE_URL}/kabar/</loc>`);
    expect(xml).toContain(`<loc>${SITE_URL}/kabar/promo-cibubur/</loc><lastmod>2026-11-01</lastmod>`);
    expect(xml).toContain(`<loc>${SITE_URL}/kabar/promo-lewat/</loc>`);
    expect(waClickAllowlist(bundle, [], [], items).pages).toEqual(expect.arrayContaining(['/kabar/', '/kabar/promo-cibubur/', '/kabar/promo-lewat/']));
  });

  it('koleksi kosong: /kabar/ tetap di sitemap & llms.txt', () => {
    expect(sitemap(bundle, [], [], [])).toContain(`<loc>${SITE_URL}/kabar/</loc>`);
    expect(llmsTxt(bundle, [], [], [], NOW)).toContain(`- [Kabar, Promo & Acara](${SITE_URL}/kabar/)`);
  });

  it('llms.txt memuat link /kabar/ & promo aktif saja', () => {
    const llms = llmsTxt(bundle, [], [], items, NOW);
    expect(llms).toContain(`- [Kabar, Promo & Acara](${SITE_URL}/kabar/)`);
    expect(llms).toContain(`- [Judul promo-cibubur](${SITE_URL}/kabar/promo-cibubur/): Ringkasan promo-cibubur.`);
    expect(llms).not.toContain('promo-lewat');
  });

  it('menu memuat Kabar → /kabar/', () => {
    const settings = settingsSchema.parse({ ...rawFixture.settings, showKabar: true });
    expect(buildSite(settings, baseSite, []).nav).toContainEqual(expect.objectContaining({ label: 'Kabar', href: '/kabar/' }));
  });

  it('_redirects tanpa aturan /kabar', () => {
    expect(withDisabledRedirects('', bundle)).not.toContain('/kabar');
  });
});

describe('kotak "Promo & acara" di ringkasan statis halaman cabang', () => {
  const bundle = bundleWith(true);

  it('hanya promo/acara aktif untuk cabang itu atau semua cabang', () => {
    const html = branchBody(cibubur, bundle, [], [PROMO_CIBUBUR, PROMO_SEMUA, PROMO_BOGOR, PROMO_LEWAT, KABAR_CIBUBUR], NOW);
    expect(html).toContain('Promo &amp; acara');
    expect(html).toContain('data-kabar-box');
    expect(html).toContain('/kabar/promo-cibubur/');
    expect(html).toContain('/kabar/promo-semua/');
    expect(html).not.toContain('promo-bogor');
    expect(html).not.toContain('promo-lewat');
    expect(html).not.toContain('kabar-cibubur');
  });

  it('tidak ada item aktif → tanpa kotak; tanpa argumen kabar sama dengan sebelumnya', () => {
    expect(branchBody(cibubur, bundle, [], [PROMO_BOGOR, PROMO_LEWAT], NOW)).not.toContain('data-kabar-box');
    expect(branchBody(cibubur, bundle, [], [], NOW)).toBe(branchBody(cibubur, bundle));
    expect(branchBody(cibubur, bundle, [], [PROMO_BOGOR, PROMO_LEWAT], NOW)).not.toContain('<script>');
  });

  it('saringan pra-paint tidak di ringkasan statis (ada di <head>, lihat kabarPrepaintTag)', () => {
    const html = branchBody(cibubur, bundle, [], [PROMO_CIBUBUR], NOW);
    expect(html).toContain('data-kabar-box');
    expect(html).not.toContain('<script>');
  });
});

describe('banner beranda di ringkasan statis (Tampilkan Kabar + Tampilkan banner)', () => {
  const items = [PROMO_BOGOR, PROMO_LEWAT];

  it('Kabar mati atau banner mati → tidak ada markup banner sama sekali', () => {
    for (const bundle of [bundleWith(false, true), bundleWith(true, false), bundleWith(false, false)]) {
      const html = homeBody(bundle, items, NOW);
      expect(html).not.toContain('data-kabar');
      expect(html).not.toContain('<script>');
      expect(html).toBe(homeBody(bundle));
    }
  });

  it('banner aktif tetapi tidak ada promo/acara aktif → tidak ada apa-apa', () => {
    const bundle = bundleWith(true, true);
    expect(homeBody(bundle, [PROMO_LEWAT, KABAR_CIBUBUR], NOW)).toBe(homeBody(bundle));
  });

  it('banner aktif: satu banner (item aktif pertama, tanpa saringan cabang), sesudah hero', () => {
    const bundle = bundleWith(true, true);
    const html = homeBody(bundle, items, NOW);
    expect(html).toContain('data-kabar-banner');
    expect(html).toContain('href="/kabar/promo-bogor/"');
    expect(html).not.toContain('promo-lewat');
    expect(html.match(/data-kabar-banner/g)).toHaveLength(1);
    expect(html).toMatch(/<\/h1>(<p>[^<]*<\/p>)?<p data-kabar-banner[^>]*>.*?<\/p>/);
  });

  it('saringan pra-paint: placeholder di <head> beranda & halaman cabang, sebelum stylesheet/skrip yang disuntik Vite', () => {
    for (const file of ['index.html', 'cabang/index.html']) {
      const html = readFileSync(file, 'utf8');
      const at = html.indexOf('<!--cutless:kabar-prepaint-->');
      expect(at, file).toBeGreaterThan(0);
      expect(at, file).toBeLessThan(html.indexOf('</head>'));
    }
  });
});

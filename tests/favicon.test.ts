/**
 * Favicon & logo untuk Google: file ada dengan ukuran benar (ICO 16/32/48, PNG kelipatan 48, ikon manifest),
 * tag <link> di semua halaman prerender, URL stabil tanpa hash, robots produksi tidak memblokir, JSON-LD Organization.
 */
import { existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { icoFromPngs } from '../scripts/make-favicons.mjs';
import { ORG_LOGO, organizationJsonLd, robots } from '../scripts/vite-content-plugin';
import type { ContentBundle } from '../src/content/schema';

const PAGES = ['index.html', 'cabang/index.html', 'cuci-sepatu/index.html', 'produk/index.html', 'public/404.html'];
const PNGS: [string, number][] = [
  ['favicon-48x48.png', 48],
  ['favicon-96x96.png', 96],
  ['favicon-192x192.png', 192],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
];

/** Ukuran & format gambar di dalam ICO (header 6 byte + entri 16 byte per gambar) */
function icoImages(buf: Buffer) {
  const count = buf.readUInt16LE(4);
  return Array.from({ length: count }, (_, i) => {
    const e = 6 + 16 * i;
    const offset = buf.readUInt32LE(e + 12);
    return { size: buf.readUInt8(e) || 256, png: buf.subarray(offset, offset + 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) };
  });
}

describe('file favicon', () => {
  it('favicon.ico berisi 16, 32, 48 px (PNG)', () => {
    const buf = readFileSync('public/favicon.ico');
    expect(buf.readUInt16LE(2)).toBe(1);
    expect(icoImages(buf)).toEqual([16, 32, 48].map((size) => ({ size, png: true })));
  });

  it.each(PNGS)('%s persegi %i px, berlatar (tanpa transparansi di sudut)', async (file, size) => {
    const meta = await sharp(`public/${file}`).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['png', size, size]);
    const { data } = await sharp(`public/${file}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(255); // piksel pojok: latar brand pekat, bukan transparan
  });

  it('site.webmanifest: ikon 192 & 512 (any + maskable) yang benar-benar ada', () => {
    const manifest = JSON.parse(readFileSync('public/site.webmanifest', 'utf8'));
    const icons = manifest.icons as { src: string; sizes: string; type: string; purpose: string }[];
    expect(icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
    for (const i of icons) expect(existsSync(`public${i.src}`), i.src).toBe(true);
  });

  it('pembuat ICO menulis header & offset yang valid', async () => {
    const png = await sharp({ create: { width: 16, height: 16, channels: 4, background: '#000' } }).png().toBuffer();
    const ico = icoFromPngs([{ size: 16, data: png }]);
    expect(icoImages(ico)).toEqual([{ size: 16, png: true }]);
    expect(ico.length).toBe(6 + 16 + png.length);
  });
});

describe('tag <head> & SEO', () => {
  it.each(PAGES)('%s: tag favicon lengkap, URL tetap tanpa hash', (page) => {
    const html = readFileSync(page, 'utf8');
    expect(html).toContain('<link rel="icon" href="/favicon.ico" sizes="48x48" />');
    expect(html).toContain('<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    for (const href of html.match(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g) ?? []) {
      const url = href.match(/href="([^"]+)"/)![1];
      expect(existsSync(`public${url}`), url).toBe(true);
      expect(url).toMatch(/^\/[\w-]+\.(ico|png)$/);
    }
  });

  it('robots.txt produksi tidak memblokir favicon (Allow: /); non-produksi tetap Disallow', () => {
    const bundle = { settings: { siteUrl: 'https://cutlesshairstudio.com' } } as unknown as ContentBundle;
    expect(robots(bundle, true)).toMatch(/^User-agent: \*\nAllow: \/\n/);
    expect(robots(bundle, true)).not.toMatch(/Disallow/);
    expect(robots(bundle, false)).toContain('Disallow: /');
  });

  it('JSON-LD Organization beranda: logo URL absolut yang ada, kontak, akun sosial', () => {
    const org = organizationJsonLd({
      siteUrl: 'https://cutlesshairstudio.com',
      siteName: 'Cutless Hair Studio',
      email: 'cutlesshairstudio@gmail.com',
      instagramUrl: 'https://www.instagram.com/cutlesshairstudio/',
      tiktokUrl: '',
      mainWhatsappNumber: '6281100000101',
    });
    expect(org).toMatchObject({
      '@type': 'Organization',
      '@id': 'https://cutlesshairstudio.com/#organization',
      logo: { url: 'https://cutlesshairstudio.com/icon-512.png', width: 512, height: 512 },
      contactPoint: { telephone: '+6281100000101' },
      sameAs: ['https://www.instagram.com/cutlesshairstudio/'],
    });
    expect(existsSync(`public${ORG_LOGO}`)).toBe(true);
    expect(readFileSync('index.html', 'utf8')).toContain('<!--cutless:org-jsonld-->');
  });
});

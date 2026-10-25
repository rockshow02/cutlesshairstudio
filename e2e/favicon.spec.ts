import { expect } from '@playwright/test';
import { test } from './helpers';

/**
 * Favicon disajikan Worker (wrangler dev, build E2E): status 200 + content-type benar, URL tetap, dan tag <link>
 * ada di HTML statis semua halaman prerender (termasuk 404) tanpa menunggu JavaScript.
 */
const FILES: [string, RegExp][] = [
  ['/favicon.ico', /^image\/(vnd\.microsoft\.icon|x-icon)/],
  ['/favicon-48x48.png', /^image\/png/],
  ['/favicon-96x96.png', /^image\/png/],
  ['/favicon-192x192.png', /^image\/png/],
  ['/apple-touch-icon.png', /^image\/png/],
  ['/icon-192.png', /^image\/png/],
  ['/icon-512.png', /^image\/png/],
  ['/site.webmanifest', /^application\/(manifest\+)?json/],
];

test('file favicon: 200 & content-type benar', async ({ request, isMobile }) => {
  test.skip(isMobile, 'tidak bergantung ukuran layar');
  for (const [path, type] of FILES) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(200);
    expect(res.headers()['content-type'], path).toMatch(type);
    expect((await res.body()).length, path).toBeGreaterThan(100);
  }
});

test('tag favicon di HTML statis semua halaman prerender & 404', async ({ request, isMobile }) => {
  test.skip(isMobile, 'tidak bergantung ukuran layar');
  for (const [path, status] of [['/', 200], ['/cabang/', 200], ['/cabang/bogor-bantarjati/', 200], ['/cuci-sepatu/', 200], ['/halaman-tidak-ada-uji', 404]] as const) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(status);
    const html = await res.text();
    expect(html, path).toContain('<link rel="icon" href="/favicon.ico" sizes="48x48" />');
    expect(html, path).toContain('<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />');
    expect(html, path).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
  }
  // Beranda: JSON-LD Organization dengan logo absolut
  const home = await (await request.get('/')).text();
  const org = [...home.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]))
    .find((d) => !Array.isArray(d) && d['@type'] === 'Organization');
  expect(org?.logo?.url).toMatch(/^https?:\/\/[^/]+\/icon-512\.png$/);
});

import { expect } from '@playwright/test';
import { E2E_PRODUCTS } from './fixtures/content';
import { test } from './helpers';

/**
 * Halaman /produk/ mengikuti Tampilkan Produk saat build (data uji e2e/fixtures/content.ts):
 * - build bawaan (Worker, wrangler dev): Tampilkan Produk mati → /produk & /produk/ 301 ke beranda, tidak di sitemap;
 * - varian uniform (:8788): Tampilkan Produk aktif → /produk/ tampil dengan produk uji & masuk sitemap.
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const UNIFORM_URL = 'http://localhost:8788';

test('Tampilkan Produk mati: /produk & /produk/ dialihkan 301 ke beranda, tidak di sitemap & menu', async ({ request, page, isMobile }) => {
  test.skip(isMobile, 'pemeriksaan server');
  for (const path of ['/produk', '/produk/', '/produk/pomade-uji']) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(301);
    expect(new URL(res.headers()['location'], 'http://x').pathname, path).toBe('/');
  }
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/produk');
  await page.goto('/produk/', { waitUntil: 'domcontentloaded' });
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(page.locator('header').getByRole('link', { name: 'Produk', exact: true })).toHaveCount(0);
});

test('Tampilkan Produk aktif: /produk/ tampil dengan produk & masuk sitemap', async ({ request, page }) => {
  const res = await request.get(`${UNIFORM_URL}/produk/`, { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect(await (await request.get(`${UNIFORM_URL}/sitemap.xml`)).text()).toMatch(/<loc>[^<]*\/produk\/<\/loc>/);
  await page.goto(`${UNIFORM_URL}/produk/`, { waitUntil: 'domcontentloaded' });
  expect(new URL(page.url()).pathname).toBe('/produk/');
  for (const p of E2E_PRODUCTS) await expect(page.getByText(p.name).first()).toBeVisible({ timeout: 20_000 });
});

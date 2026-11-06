import { expect } from '@playwright/test';
import { clsOf, expectNoHorizontalScroll, test } from './helpers';

/**
 * /kebijakan-privasi/: halaman statis yang selalu ada. Prerender terbaca tanpa JavaScript, satu <main>, tanpa scroll
 * horizontal di 360 px & desktop, CLS < 0,005, tertaut di footer semua halaman, masuk sitemap, tidak 404.
 * (Ringkasan statis = teks terlihat: e2e/static-content.spec.ts.)
 */
const PATH = '/kebijakan-privasi/';

test('tidak 404, terprerender (terbaca tanpa JavaScript), dan masuk sitemap', async ({ page }) => {
  const res = await page.request.get(PATH);
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('<div class="prerender">');
  expect(html).toContain('<h1>Kebijakan Privasi</h1>');
  expect(html).toContain('Cloudflare Web Analytics');
  expect(html).toContain('<link rel="canonical" href="');
  expect(html).not.toContain('%PRIVACY_');
  // Tanpa slash akhir pun terbuka (bukan 404)
  expect((await page.request.get('/kebijakan-privasi')).status()).toBe(200);
  const sitemap = await (await page.request.get('/sitemap.xml')).text();
  expect(sitemap).toContain(`${PATH}</loc>`);
});

test('tampil rapi: satu <main>, satu h1, tanpa scroll horizontal, CLS < 0,005', async ({ page }) => {
  await page.goto(PATH, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.prerender')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kebijakan Privasi');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('main').getByRole('heading', { level: 2 })).toHaveCount(5);
  await expectNoHorizontalScroll(page);
  expect(await clsOf(page)).toBeLessThan(0.005);
});

test('isi memuat kontak situs', async ({ page }) => {
  await page.goto(PATH, { waitUntil: 'domcontentloaded' });
  const article = page.locator('main article');
  await expect(article).toContainText('0813-2220-932', { timeout: 20_000 });
  await expect(article).toContainText('Berlaku sejak 6 November 2026');
});

for (const path of ['/', '/cabang/', '/cuci-sepatu/', PATH]) {
  test(`link Kebijakan Privasi di footer: ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const link = page.locator('footer').getByRole('link', { name: 'Kebijakan Privasi' });
    await expect(link).toBeAttached({ timeout: 20_000 });
    await expect(link).toHaveAttribute('href', PATH);
  });
}

test('footer → halaman kebijakan', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const link = page.locator('footer').getByRole('link', { name: 'Kebijakan Privasi' });
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await expect(page).toHaveURL(/\/kebijakan-privasi\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kebijakan Privasi');
});

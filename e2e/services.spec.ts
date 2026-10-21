import { expect } from '@playwright/test';
import { expectNoHorizontalScroll, test } from './helpers';

/**
 * Kartu Layanan sinkron dengan Daftar Harga (360 px & desktop). Hanya memeriksa sifat yang selalu benar, bukan isi
 * CMS: setiap kartu tampil punya "mulai Rp…", daftar layanan di Lokasi = kartu Layanan, meta description ≤ 160.
 */
test('section Layanan: setiap kartu punya "mulai Rp…", sama dengan daftar layanan di Lokasi', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const section = page.locator('#layanan');
  const cards = section.locator('article');
  await expect(cards.first()).toBeAttached({ timeout: 20_000 });
  const names = await cards.locator('h3').allTextContents();
  expect(names.length).toBeGreaterThan(0);
  expect(new Set(names).size).toBe(names.length); // satu kartu per kategori
  for (let i = 0; i < names.length; i++) await expect(cards.nth(i)).toContainText(/mulai Rp\s?[\d.]+/);
  await expect(section.getByText('Tanya harga')).toHaveCount(0);

  // Lokasi: daftar layanan cabang = kartu Layanan (sumber sama)
  await expect(page.locator('#lokasi li', { hasText: 'mulai Rp' }).first()).toBeAttached({ timeout: 20_000 });
  const listed = await page.locator('#lokasi li').evaluateAll((lis) =>
    lis.filter((li) => li.querySelectorAll('span').length >= 1 && /mulai Rp/.test(li.textContent ?? '')).map((li) => li.querySelector('span')!.textContent!.trim()),
  );
  expect(listed).toEqual(names);
  await expectNoHorizontalScroll(page);
});

test('meta description beranda & cabang dari kategori layanan aktif, ≤ 160 karakter', async ({ page, request }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#layanan article').first()).toBeAttached({ timeout: 20_000 });
  const cardNames = await page.locator('#layanan article h3').allTextContents();
  const meta = async (path: string) => {
    const html = await (await request.get(path)).text();
    return (html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '').replace(/&amp;/g, '&');
  };
  const home = await meta('/');
  expect(home.length).toBeLessThanOrEqual(160);
  expect(home).toContain(cardNames[0]);
  const branchPaths = await page.locator('a[href*="/cabang/"]').evaluateAll((as) =>
    [...new Set(as.map((a) => new URL((a as HTMLAnchorElement).href).pathname).filter((p) => /^\/cabang\/[a-z0-9-]+\/$/.test(p)))],
  );
  for (const path of branchPaths) expect((await meta(path)).length, path).toBeLessThanOrEqual(160);
});

import { expect } from '@playwright/test';
import { expectNoHorizontalScroll, test } from './helpers';

/**
 * Kartu Layanan tanpa harga (360 px & desktop). Hanya sifat yang selalu benar, bukan isi CMS: kartu tanpa harga,
 * daftar layanan di Lokasi = kartu Layanan (tanpa harga), "Lihat harga" ke kategori di Daftar Harga, meta ≤ 160.
 */
test('section Layanan: kartu tanpa harga, "Lihat harga" ke kategori Daftar Harga, sama dengan daftar di Lokasi', async ({ page, isMobile }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const section = page.locator('#layanan');
  const cards = section.locator('article');
  await expect(cards.first()).toBeAttached({ timeout: 20_000 });
  const names = await cards.locator('h3').allTextContents();
  expect(names.length).toBeGreaterThan(0);
  await expect(section).not.toContainText(/mulai Rp|Tanya harga|Rp\s?\d/);

  // Lokasi: nama layanan saja, sama dengan kartu
  await expect(page.locator('#lokasi li', { hasText: names[0] }).first()).toBeAttached({ timeout: 20_000 });
  const list = await page.locator('#lokasi li').evaluateAll((lis, n) => lis.map((li) => li.textContent?.trim() ?? '').filter((t) => n.includes(t)), names);
  expect(list).toEqual(names);
  await expect(page.locator('#lokasi')).not.toContainText(/mulai Rp/);

  // "Lihat harga" → kategori di Daftar Harga (HP: tab kategori itu terpilih)
  const link = section.getByRole('link', { name: /^Lihat harga/ }).first();
  if (await link.count()) {
    const href = (await link.getAttribute('href'))!;
    await link.scrollIntoViewIfNeeded();
    await link.click();
    if (isMobile) {
      const tab = page.locator('#harga [role="tab"][aria-selected="true"]');
      await expect(tab).toBeVisible();
      const tabName = (await tab.evaluate((t) => t.childNodes[0].textContent ?? '')).trim();
      expect(href).toBe(`#harga-${tabName.toLowerCase().replace(/&/g, 'dan').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`);
    } else {
      await expect(page.locator(href)).toBeInViewport({ timeout: 5_000 });
    }
  }
  await expectNoHorizontalScroll(page);
});

test('meta description beranda & cabang dari kategori aktif, ≤ 160 karakter', async ({ page, request }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const meta = async (path: string) => {
    const html = await (await request.get(path)).text();
    return (html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '').replace(/&amp;/g, '&');
  };
  const first = page.locator('#harga h3, #harga [role="tab"]').first();
  await expect(first).toBeAttached({ timeout: 20_000 });
  const category = (await first.evaluate((el) => el.childNodes[0].textContent ?? '')).trim();
  const home = await meta('/');
  expect(home.length).toBeLessThanOrEqual(160);
  expect(home).toContain(category);
  const branchPaths = await page.locator('a[href*="/cabang/"]').evaluateAll((as) =>
    [...new Set(as.map((a) => new URL((a as HTMLAnchorElement).href).pathname).filter((p) => /^\/cabang\/[a-z0-9-]+\/$/.test(p)))],
  );
  for (const path of branchPaths) expect((await meta(path)).length, path).toBeLessThanOrEqual(160);
});

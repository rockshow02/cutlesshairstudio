import { expect } from '@playwright/test';
import { E2E_BRANCHES, E2E_TIPS } from './fixtures/content';
import { test } from './helpers';

/**
 * Satu <main> setiap saat, sejak HTML statis sampai React selesai memuat data: MutationObserver dipasang sebelum skrip
 * situs berjalan dan mencatat jumlah <main> terbanyak yang pernah ada di dokumen. Mencegah terulangnya placeholder
 * loading halaman yang merender <main> kedua di dalam <main id="main"> milik SiteShell (dulu /cuci-sepatu/:
 * locator('main') "resolved to 2 elements"). CPU dilambatkan 4× agar jendela loading cukup lebar untuk tertangkap.
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const UNIFORM_URL = 'http://localhost:8788';
const PAGES = [
  '/',
  '/cabang/',
  `/cabang/${E2E_BRANCHES.bogor.slug}/`,
  '/cuci-sepatu/',
  '/halaman-tidak-ada-uji',
  `${UNIFORM_URL}/produk/`,
  `${UNIFORM_URL}/tips/`,
  `${UNIFORM_URL}/tips/${E2E_TIPS.withToc.slug}/`,
];

for (const url of PAGES) {
  test(`satu <main> sepanjang pemuatan: ${url.replace(UNIFORM_URL, '[uniform]')}`, async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript(() => {
      const w = window as unknown as { __maxMain: number };
      w.__maxMain = 0;
      const count = () => {
        w.__maxMain = Math.max(w.__maxMain, document.getElementsByTagName('main').length);
      };
      new MutationObserver(count).observe(document, { childList: true, subtree: true });
      document.addEventListener('DOMContentLoaded', count);
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    // Judul halaman tampil di <main> → data halaman selesai dimuat (Cuci Sepatu: judul baru ada setelah data partner siap)
    await expect(page.locator('main h1').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('main')).toHaveCount(1);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as unknown as { __maxMain: number }).__maxMain)).toBe(1);
  });
}

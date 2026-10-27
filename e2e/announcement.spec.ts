import { expect, type Page } from '@playwright/test';
import { E2E_ANNOUNCEMENTS } from './fixtures/content';
import { test } from './helpers';

/**
 * Bar pengumuman (varian uniform: 1 pengumuman khusus Cibubur + 1 untuk semua cabang), 360 px & desktop.
 * - Bar ikut render pertama bersama navbar & hero: tidak ada pergeseran vertikal yang terlihat pada header atau judul
 *   halaman saat dimuat (dulu bar muncul sesudah hero → hero turun 26 px, navbar 52 px).
 * - Cabang halaman/pilihan menentukan pengumuman yang tampil; Tutup → bar hilang, navbar naik, tetap hilang setelah muat ulang.
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const UNIFORM_URL = 'http://localhost:8788';
const [CIBUBUR_ONLY, ALL_BRANCHES] = E2E_ANNOUNCEMENTS;

/**
 * Pergeseran VERTIKAL yang terlihat (Layout Instability API, frame yang benar-benar tergambar) pada header, judul
 * halaman, atau kontainer judul, sejak halaman mulai dimuat. Pergeseran mendatar (pergantian font) tidak dihitung.
 */
async function verticalShifts(page: Page, path: string) {
  await page.addInitScript(() => {
    const w = window as unknown as { __shifts: string[] };
    w.__shifts = [];
    type Source = { node?: Node; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { hadRecentInput: boolean; sources: Source[] }[]) {
        if (e.hadRecentInput) continue;
        const h1 = document.querySelector('main h1');
        for (const s of e.sources) {
          const el = s.node instanceof Element ? s.node : s.node?.parentElement;
          if (!el || Math.round(s.previousRect.y) === Math.round(s.currentRect.y)) continue;
          if (el.closest('header') || (h1 && (el === h1 || el.contains(h1)))) w.__shifts.push(`${el.tagName}.${el.className} y${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)}`);
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(`${UNIFORM_URL}${path}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('region', { name: 'Pengumuman' })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  return page.evaluate(() => ({
    shifts: (window as unknown as { __shifts: string[] }).__shifts,
    header: Math.round(document.querySelector('header')!.getBoundingClientRect().top),
    bar: Math.round(document.querySelector('[role="region"][aria-label="Pengumuman"]')!.getBoundingClientRect().height),
  }));
}

for (const path of ['/', '/cabang/', '/cabang/cibubur/', '/cuci-sepatu/']) {
  test(`${path}: bar pengumuman ada sejak render pertama, header & judul tidak turun saat dimuat`, async ({ page }) => {
    const r = await verticalShifts(page, path);
    expect(r.bar).toBeGreaterThan(0);
    // Navbar tepat di bawah bar
    expect(r.header).toBe(r.bar);
    expect(r.shifts, 'header/judul bergeser vertikal setelah tergambar').toEqual([]);
  });
}

test('pengumuman sesuai cabang halaman; Tutup → bar hilang & navbar naik, tetap hilang setelah muat ulang', async ({ page }) => {
  const bar = page.getByRole('region', { name: 'Pengumuman' });
  // Halaman Bogor: pengumuman khusus Cibubur tidak tampil
  await page.goto(`${UNIFORM_URL}/cabang/bogor-bantarjati/`, { waitUntil: 'domcontentloaded' });
  await expect(bar).toContainText(ALL_BRANCHES.message, { timeout: 20_000 });
  await expect(bar).not.toContainText(CIBUBUR_ONLY.message);
  // Halaman Cibubur: pengumuman khusus Cibubur (urutan pertama)
  await page.goto(`${UNIFORM_URL}/cabang/cibubur/`, { waitUntil: 'domcontentloaded' });
  await expect(bar).toContainText(CIBUBUR_ONLY.message, { timeout: 20_000 });

  await bar.getByRole('button', { name: 'Tutup pengumuman' }).click();
  // Pengumuman berikutnya yang berlaku (semua cabang) menggantikannya
  await expect(bar).toContainText(ALL_BRANCHES.message);
  await bar.getByRole('button', { name: 'Tutup pengumuman' }).click();
  await expect(bar).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Math.round(document.querySelector('header')!.getBoundingClientRect().top))).toBe(0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('main h1')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(500);
  await expect(bar).toHaveCount(0);
});

import { expect, type Page } from '@playwright/test';
import { E2E_BRANCHES, E2E_SERVICE_PAGES, E2E_TIPS } from './fixtures/content';
import { test } from './helpers';

/**
 * Ringkasan statis (.prerender di HTML awal, terbaca tanpa JavaScript) tidak boleh berisi teks khusus mesin pencari/AI:
 * setiap node teksnya harus juga ada di halaman setelah React merender (teks terlihat + isi akordeon FAQ yang tertutup).
 * Desktop saja: di HP Daftar Harga memakai tab kategori (kategori lain tampil setelah tab dipilih). Build bawaan (FAQ
 * aktif, produk mati) & varian uniform (harga sama di semua cabang, FAQ mati).
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const UNIFORM_URL = 'http://localhost:8788';
const PAGES = ['/', '/cabang/', ...Object.values(E2E_BRANCHES).map((b) => `/cabang/${b.slug}/`), '/cuci-sepatu/'];
/** Tips & Trik hanya aktif di varian uniform (build bawaan: 301 ke beranda) */
/** Halaman layanan hanya aktif di varian uniform */
const SERVICE_PAGES = ['/layanan/', ...[E2E_SERVICE_PAGES.haircut, E2E_SERVICE_PAGES.coloring, E2E_SERVICE_PAGES.kids].map((p) => `/layanan/${p.slug}/`)];
const TIPS_PAGES = ['/tips/', '/tips/halaman/2/', '/tips/kategori/grooming/', '/tips/kategori/grooming/halaman/2/', `/tips/${E2E_TIPS.withToc.slug}/`, `/tips/${E2E_TIPS.noToc.slug}/`];

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

async function staticVsRendered(page: Page, url: string) {
  const html = await (await page.request.get(url)).text();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.prerender')).toHaveCount(0, { timeout: 20_000 });
  // Gulir sampai bawah agar section lazy & animasi reveal ikut dirender
  for (let y = 0; y < (await page.evaluate(() => document.documentElement.scrollHeight)); y += 600) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(500);
  return page.evaluate((source) => {
    const block = new DOMParser().parseFromString(source, 'text/html').querySelector('.prerender');
    const texts: string[] = [];
    if (block) {
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent?.trim()) texts.push(n.textContent);
    }
    const rendered = [document.body.innerText, ...[...document.querySelectorAll('details')].map((d) => d.textContent ?? '')].join('\n');
    return { texts, rendered };
  }, html);
}

for (const [variant, base] of [
  ['bawaan', ''],
  ['uniform', UNIFORM_URL],
] as const) {
  for (const path of variant === 'uniform' ? [...PAGES, ...TIPS_PAGES, ...SERVICE_PAGES] : PAGES) {
    test(`ringkasan statis ${path} (${variant}) = teks yang terlihat`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'desktop saja');
      const { texts, rendered } = await staticVsRendered(page, `${base}${path}`);
      test.skip(texts.length === 0, 'halaman tanpa ringkasan statis (mis. dialihkan)');
      const all = norm(rendered);
      expect(texts.map(norm).filter((t) => !all.includes(t))).toEqual([]);
    });
  }
}

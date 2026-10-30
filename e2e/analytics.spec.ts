import { expect } from '@playwright/test';
import { E2E_BRANCHES } from './fixtures/content';
import { test } from './helpers';

/**
 * Cloudflare Web Analytics hanya di build produksi: build E2E (environment staging) tidak memuat beacon di HTML
 * halaman mana pun (termasuk 404) dan browser tidak menghubungi cloudflareinsights.com.
 * Build produksi (dengan/tanpa token) dicek CI lewat scripts/check-analytics.mjs; aturannya diuji di tests/analytics.test.ts.
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const PAGES = [['/', 200], ['/cabang/', 200], [`/cabang/${E2E_BRANCHES.bogor.slug}/`, 200], ['/cuci-sepatu/', 200], ['/halaman-tidak-ada-uji', 404]] as const;

test('build E2E/staging: tanpa beacon Web Analytics di HTML statis', async ({ request, isMobile }) => {
  test.skip(isMobile, 'tidak bergantung ukuran layar');
  for (const [path, status] of PAGES) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(status);
    expect(await res.text(), path).not.toContain('cloudflareinsights');
  }
});

test('build E2E/staging: browser tidak menghubungi cloudflareinsights.com', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('cloudflareinsights.com')) calls.push(r.url());
  });
  for (const [path] of PAGES) await page.goto(path, { waitUntil: 'load' });
  expect(calls).toEqual([]);
});

import { expect, type Page } from '@playwright/test';
import { E2E_BRANCHES, E2E_TIPS } from './fixtures/content';
import { clsOf, expectNoHorizontalScroll, parseWa, test } from './helpers';

/**
 * Tips & Trik mengikuti Tampilkan Tips & Trik saat build (artikel uji e2e/fixtures/content.ts → E2E_TIPS):
 * - build bawaan (Worker, :8787): mati → /tips* 301 ke beranda, tidak di menu/sitemap/llms.txt/beranda;
 * - varian uniform (:8788): aktif → 13 artikel Terbit (paginasi), 1 Draf tersembunyi.
 * Dijalankan di HP 360 px & desktop.
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const UNIFORM_URL = 'http://localhost:8788';
const { withToc, noToc, draft } = E2E_TIPS;
const cards = (page: Page) => page.locator('main').getByRole('listitem').filter({ has: page.locator('a[href^="/tips/"] h2, a[href^="/tips/"] h3') });

/** Link menu "Tips": navbar desktop, atau menu HP (navbar bersembunyi saat digulir ke bawah → kembali ke atas dulu) */
async function tipsNavLink(page: Page, isMobile: boolean) {
  await page.evaluate(() => window.scrollTo(0, 0));
  if (isMobile) await page.getByRole('button', { name: 'Buka menu' }).click();
  return page.getByRole('navigation', { name: 'Menu utama' }).getByRole('link', { name: 'Tips', exact: true });
}

test('Tampilkan Tips & Trik mati: /tips* 301 ke beranda, tidak di sitemap, llms.txt, menu, & beranda', async ({ request, page, isMobile }) => {
  for (const path of ['/tips', '/tips/', `/tips/${withToc.slug}/`, '/tips/halaman/2/']) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(301);
    expect(new URL(res.headers()['location'], 'http://x').pathname, path).toBe('/');
  }
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/tips');
  expect(await (await request.get('/llms.txt')).text()).not.toContain('Tips');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
  if (!isMobile) await expect(page.locator('header').getByRole('link', { name: 'Tips', exact: true })).toHaveCount(0);
  await expect(page.locator('footer').getByRole('link', { name: 'Tips', exact: true })).toHaveCount(0);
  await expect(page.locator('#tips-terbaru')).toHaveCount(0);
});

test('aktif: /tips/ & artikel di sitemap dan llms.txt; Draf tidak di-build', async ({ request, isMobile }) => {
  test.skip(isMobile, 'pemeriksaan server');
  expect((await request.get(`${UNIFORM_URL}/tips/`, { maxRedirects: 0 })).status()).toBe(200);
  const sitemap = await (await request.get(`${UNIFORM_URL}/sitemap.xml`)).text();
  expect(sitemap).toMatch(/<loc>[^<]*\/tips\/<\/loc>/);
  expect(sitemap).toMatch(new RegExp(`<loc>[^<]*/tips/${withToc.slug}/</loc><lastmod>2026-10-25</lastmod>`));
  expect(sitemap).not.toContain(draft.slug);
  const llms = await (await request.get(`${UNIFORM_URL}/llms.txt`)).text();
  expect(llms).toContain(`[${withToc.title}](${UNIFORM_URL}/tips/${withToc.slug}/): ${withToc.summary}`);
  expect(llms).not.toContain(draft.title);
  // Tidak ada halaman artikel Draf (Worker: 404; vite preview varian uniform menjawab halaman lain)
  expect(await (await request.get(`${UNIFORM_URL}/tips/${draft.slug}/`)).text()).not.toContain(draft.title);
});

test('daftar /tips/: 12 kartu, paginasi ke halaman 2, menu Tips & Tips Terbaru di beranda', async ({ page, isMobile }) => {
  await page.goto(`${UNIFORM_URL}/`, { waitUntil: 'domcontentloaded' });
  const latest = page.locator('#tips-terbaru');
  await latest.scrollIntoViewIfNeeded({ timeout: 20_000 }).catch(() => undefined);
  await expect(latest.getByRole('heading', { name: 'Tips Terbaru' })).toBeVisible({ timeout: 20_000 });
  await expect(latest.getByRole('listitem')).toHaveCount(3);
  await (await tipsNavLink(page, isMobile)).click();
  await expect(page).toHaveURL(/\/tips\/$/);

  await expect(page.getByRole('heading', { level: 1, name: 'Tips & Trik' })).toBeVisible({ timeout: 20_000 });
  await expect(cards(page)).toHaveCount(12);
  await expect(page.getByText(draft.title)).toHaveCount(0);
  // Terbaru dulu; kartu: kategori, judul, ringkasan, tanggal, waktu baca
  const first = cards(page).first();
  await expect(first.getByRole('heading')).toHaveText(noToc.title);
  await expect(first).toContainText(noToc.category);
  await expect(first).toContainText(noToc.summary);
  await expect(first).toContainText('21 Oktober 2026');
  await expect(first).toContainText('1 menit baca');
  // Gambar kartu lazy & berukuran (tanpa layout shift)
  const img = first.locator('img');
  await expect(img).toHaveAttribute('loading', 'lazy');
  await expect(img).toHaveAttribute('width', /\d+/);
  expect(await clsOf(page), 'CLS /tips/').toBeLessThan(0.005);
  await expectNoHorizontalScroll(page);

  await expect(page.getByText('Halaman 1 dari 2')).toBeVisible();
  await page.getByRole('link', { name: 'Berikutnya' }).click();
  await expect(page).toHaveURL(/\/tips\/halaman\/2\/$/);
  await expect(cards(page)).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByText('Halaman 2 dari 2')).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${UNIFORM_URL}/tips/halaman/2/`);
});

test('filter kategori: hanya kategori itu, URL ?kategori=…, tetap setelah reload; Semua mengembalikan', async ({ page }) => {
  await page.goto(`${UNIFORM_URL}/tips/`, { waitUntil: 'domcontentloaded' });
  const filters = page.getByRole('group', { name: 'Filter kategori' });
  await expect(filters).toBeVisible({ timeout: 20_000 });
  await filters.getByRole('button', { name: 'Hair Care' }).click();
  await expect(filters.getByRole('button', { name: 'Hair Care' })).toHaveAttribute('aria-pressed', 'true');
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first().getByRole('heading')).toHaveText(withToc.title);
  await expect(page).toHaveURL(/\/tips\/\?kategori=hair-care$/);
  await expect(page.getByText(/Halaman \d dari/)).toHaveCount(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(cards(page)).toHaveCount(1, { timeout: 20_000 });
  await filters.getByRole('button', { name: 'Semua' }).click();
  await expect(cards(page)).toHaveCount(12);
  await expect(page).toHaveURL(/\/tips\/$/);
  await expectNoHorizontalScroll(page);
});

test('daftar /tips/ tanpa JavaScript: judul, kategori, & semua kartu halaman ini terbaca', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${UNIFORM_URL}/tips/`);
  await expect(page.getByRole('heading', { level: 1, name: 'Tips & Trik' })).toBeVisible();
  for (const name of ['Semua', 'Hair Care', 'Hair Style', 'Grooming']) await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
  await expect(page.locator('.prerender h2')).toHaveCount(12);
  await context.close();
});

test('artikel: breadcrumb, H1, tanggal, penulis, waktu baca, sampul, daftar isi, CTA WA, layanan, terkait', async ({ page, context }) => {
  await page.goto(`${UNIFORM_URL}/tips/${withToc.slug}/`, { waitUntil: 'domcontentloaded' });
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toHaveText(withToc.title, { timeout: 20_000 });
  await expect(page.locator('.prerender')).toHaveCount(0);

  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs.getByRole('link', { name: 'Beranda' })).toHaveAttribute('href', '/');
  await expect(crumbs.getByRole('link', { name: 'Tips & Trik' })).toHaveAttribute('href', '/tips/');
  await expect(crumbs.getByText(withToc.title)).toHaveAttribute('aria-current', 'page');

  const main = page.locator('main');
  await expect(main.getByText('20 Oktober 2026')).toBeVisible();
  await expect(main.getByText('25 Oktober 2026')).toBeVisible();
  await expect(main.getByText(/^\d+ menit baca$/).first()).toBeVisible();
  await expect(main.getByRole('link', { name: withToc.author })).toHaveAttribute('href', '/#hairstylist');
  // Sampul: eager (LCP) & berukuran; gambar di isi artikel lazy
  const cover = main.locator('article img').first();
  await expect(cover).toHaveAttribute('loading', 'eager');
  await expect(main.locator('article [class*="prose"] img')).toHaveAttribute('loading', 'lazy');

  // HTML mentah di isi artikel tidak dieksekusi (tampil sebagai teks)
  expect(await page.evaluate(() => (window as unknown as { __tipXss?: boolean }).__tipXss)).toBeUndefined();
  await expect(main.getByText('<script>window.__tipXss = true</script>')).toBeVisible();

  // Daftar isi (3 H2) → klik → subjudul tampil di layar
  const toc = page.getByRole('navigation', { name: 'Daftar isi' });
  await expect(toc.getByRole('link')).toHaveText([...withToc.headings]);
  await toc.getByRole('link', { name: withToc.headings[2] }).click();
  await expect(page).toHaveURL(/#langkah-uji-ketiga$/);
  await expect(page.getByRole('heading', { level: 2, name: withToc.headings[2] })).toBeInViewport();

  // Layanan terkait → Daftar Harga kategori itu
  const services = page.getByRole('region', { name: 'Layanan terkait' }).or(page.locator('section[aria-labelledby="tips-services"]'));
  await expect(services.getByText(withToc.service, { exact: true })).toBeVisible();
  await expect(services.getByRole('link', { name: 'Lihat harga' })).toHaveAttribute('href', '/#harga-haircut');

  // 3 artikel terkait, tanpa artikel ini
  const related = page.locator('section[aria-labelledby="tips-related"]');
  await expect(related.getByRole('listitem')).toHaveCount(3);
  await expect(related.getByText(withToc.title)).toHaveCount(0);

  expect(await clsOf(page), 'CLS artikel').toBeLessThan(0.005);
  await expectNoHorizontalScroll(page);

  // CTA: pemilih cabang → WhatsApp cabang itu
  await page.getByRole('link', { name: 'Konsultasi via WhatsApp' }).click();
  const picker = page.getByRole('dialog', { name: 'Pilih cabang' });
  await picker.getByRole('button', { name: /Cibubur/ }).click();
  const popup = context.waitForEvent('page');
  await picker.getByRole('button', { name: /^Cibubur/ }).last().click();
  const wa = parseWa((await popup).url());
  expect(wa.number).toBe(E2E_BRANCHES.cibubur.whatsappNumber);
  expect(wa.text).toContain(`cabang ${E2E_BRANCHES.cibubur.name}`);
});

test('artikel dengan < 3 subjudul: tanpa daftar isi, tanpa penulis; SEO: title, canonical, og, JSON-LD', async ({ page }) => {
  await page.goto(`${UNIFORM_URL}/tips/${noToc.slug}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(noToc.title, { timeout: 20_000 });
  await expect(page.getByRole('navigation', { name: 'Daftar isi' })).toHaveCount(0);
  await expect(page.getByText('Ditulis oleh')).toHaveCount(0);
  await expect(page).toHaveTitle(`[STAGING] ${noToc.title} | Cutless Hair Studio`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${UNIFORM_URL}/tips/${noToc.slug}/`);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${UNIFORM_URL}/uploads/tips/sampul-uji.webp`);
  const types = await page.locator('script[type="application/ld+json"]').evaluateAll((els) => els.map((e) => JSON.parse(e.textContent ?? '{}')['@type']));
  expect(types).toEqual(expect.arrayContaining(['BlogPosting', 'BreadcrumbList']));
  await expectNoHorizontalScroll(page);
});

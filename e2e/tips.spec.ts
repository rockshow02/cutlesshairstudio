import { expect, type Page } from '@playwright/test';
import { E2E_BRANCHES, E2E_TIPS } from './fixtures/content';
import { clsOf, expectNoHorizontalScroll, parseWa, test } from './helpers';

/**
 * Tips & Trik mengikuti Tampilkan Tips & Trik saat build (artikel uji e2e/fixtures/content.ts → E2E_TIPS):
 * - build bawaan (Worker, :8787): mati → /tips* 301 ke beranda, tidak di menu/sitemap/llms.txt/beranda;
 * - varian uniform (:8788): aktif → 15 artikel Terbit (paginasi; 13 Grooming → halaman kategori berpaginasi),
 *   1 Draf tersembunyi.
 * Dijalankan di HP 360 px & desktop.
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const UNIFORM_URL = 'http://localhost:8788';
const { withToc, noToc, draft } = E2E_TIPS;
const barber = 'Barber Uji Satu';
const cards = (page: Page) => page.locator('main').getByRole('listitem').filter({ has: page.locator('a[href^="/tips/"] h2, a[href^="/tips/"] h3') });
const chips = (page: Page) => page.getByRole('navigation', { name: 'Filter kategori' });

/** Link menu "Tips": navbar desktop, atau menu HP (navbar bersembunyi saat digulir ke bawah → kembali ke atas dulu) */
async function tipsNavLink(page: Page, isMobile: boolean) {
  await page.evaluate(() => window.scrollTo(0, 0));
  if (isMobile) await page.getByRole('button', { name: 'Buka menu' }).click();
  return page.getByRole('navigation', { name: 'Menu utama' }).getByRole('link', { name: 'Tips', exact: true });
}

test('Tampilkan Tips & Trik mati: /tips* 301 ke beranda, tidak di sitemap, llms.txt, menu, & beranda', async ({ request, page, isMobile }) => {
  for (const path of ['/tips', '/tips/', `/tips/${withToc.slug}/`, '/tips/halaman/2/', '/tips/kategori/grooming/']) {
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

test('aktif: /tips/, kategori & artikel di sitemap dan llms.txt; Draf & kategori tanpa artikel tidak di-build', async ({ request, isMobile }) => {
  test.skip(isMobile, 'pemeriksaan server');
  expect((await request.get(`${UNIFORM_URL}/tips/`, { maxRedirects: 0 })).status()).toBe(200);
  const sitemap = await (await request.get(`${UNIFORM_URL}/sitemap.xml`)).text();
  expect(sitemap).toMatch(/<loc>[^<]*\/tips\/<\/loc>/);
  expect(sitemap).toMatch(new RegExp(`<loc>[^<]*/tips/${withToc.slug}/</loc><lastmod>2026-10-25</lastmod>`));
  expect(sitemap).toMatch(/<loc>[^<]*\/tips\/kategori\/grooming\/halaman\/2\/<\/loc>/);
  expect(sitemap).toMatch(/<loc>[^<]*\/tips\/kategori\/hair-care\/<\/loc><lastmod>2026-10-25<\/lastmod>/);
  expect(sitemap).not.toContain('/tips/kategori/produk/');
  expect(sitemap).not.toContain(draft.slug);
  const llms = await (await request.get(`${UNIFORM_URL}/llms.txt`)).text();
  expect(llms).toContain(`[${withToc.title}](${UNIFORM_URL}/tips/${withToc.slug}/): ${withToc.summary}`);
  expect(llms).not.toContain(draft.title);
  // Tidak ada halaman artikel Draf / kategori kosong (Worker: 404; vite preview varian uniform menjawab halaman lain)
  expect(await (await request.get(`${UNIFORM_URL}/tips/${draft.slug}/`)).text()).not.toContain(draft.title);
  expect(await (await request.get(`${UNIFORM_URL}/tips/kategori/produk/`)).text()).not.toContain('<h1>Produk</h1>');
});

test('daftar /tips/: eyebrow ≠ judul, 12 kartu, paginasi, menu Tips & Tips Terbaru di beranda (tombol rata kanan)', async ({ page, isMobile }) => {
  await page.goto(`${UNIFORM_URL}/`, { waitUntil: 'domcontentloaded' });
  const latest = page.locator('#tips-terbaru');
  await latest.scrollIntoViewIfNeeded({ timeout: 20_000 }).catch(() => undefined);
  await expect(latest.getByRole('heading', { name: 'Tips Terbaru' })).toBeVisible({ timeout: 20_000 });
  await expect(latest.getByRole('listitem')).toHaveCount(3);
  if (!isMobile) {
    // Tombol "Lihat semua tips" rata kanan dengan tepi grid kartu (±2 px)
    const button = (await latest.getByRole('link', { name: /Lihat semua tips/i }).boundingBox())!;
    const grid = (await latest.locator('ul').first().boundingBox())!;
    expect(Math.abs(button.x + button.width - (grid.x + grid.width))).toBeLessThanOrEqual(2);
  }
  await (await tipsNavLink(page, isMobile)).click();
  await expect(page).toHaveURL(/\/tips\/$/);

  await expect(page.getByRole('heading', { level: 1, name: 'Tips & Trik' })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('main').getByText('Dari kursi barber', { exact: true })).toBeVisible();
  await expect(cards(page)).toHaveCount(12);
  await expect(page.getByText(draft.title)).toHaveCount(0);
  // Terbaru dulu; kartu: kategori, judul, tanggal (+ ringkasan & waktu baca di layar lebar)
  const first = cards(page).first();
  await expect(first.getByRole('heading')).toHaveText(noToc.title);
  await expect(first).toContainText(noToc.category);
  await expect(first).toContainText('21 Oktober 2026');
  const img = first.locator('img');
  await expect(img).toHaveAttribute('loading', 'lazy');
  await expect(img).toHaveAttribute('width', /\d+/);
  if (isMobile) {
    // Kartu ringkas: thumbnail ±96 px di kiri, teks di kanan, ringkasan disembunyikan
    const imgBox = (await img.boundingBox())!;
    const titleBox = (await first.getByRole('heading').boundingBox())!;
    expect(imgBox.width).toBeGreaterThanOrEqual(90);
    expect(imgBox.width).toBeLessThanOrEqual(100);
    expect(titleBox.x).toBeGreaterThan(imgBox.x + imgBox.width);
    await expect(first.getByText(noToc.summary)).toBeHidden();
  } else {
    await expect(first.getByText(noToc.summary)).toBeVisible();
    await expect(first).toContainText('1 menit baca');
  }
  expect(await clsOf(page), 'CLS /tips/').toBeLessThan(0.005);
  await expectNoHorizontalScroll(page);

  await expect(page.getByText('Halaman 1 dari 2')).toBeVisible();
  await page.getByRole('link', { name: 'Berikutnya' }).click();
  await expect(page).toHaveURL(/\/tips\/halaman\/2\/$/);
  await expect(cards(page)).toHaveCount(3, { timeout: 20_000 });
  await expect(page.getByText('Halaman 2 dari 2')).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${UNIFORM_URL}/tips/halaman/2/`);
});

test('chip kategori → halaman kategori statis: judul & deskripsi sendiri, paginasi, aria-current; HP: satu baris digeser', async ({ page, isMobile }) => {
  await page.goto(`${UNIFORM_URL}/tips/`, { waitUntil: 'domcontentloaded' });
  await expect(chips(page)).toBeVisible({ timeout: 20_000 });
  await expect(chips(page).getByRole('link')).toHaveText(['Semua', 'Hair Style', 'Hair Care', 'Grooming']);
  await expect(chips(page).getByRole('link', { name: 'Semua' })).toHaveAttribute('aria-current', 'page');
  if (isMobile) {
    const list = chips(page).locator('ul');
    const tops = await chips(page).getByRole('link').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size, 'chip satu baris').toBe(1);
    expect(await list.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');
  }
  await expectNoHorizontalScroll(page);

  await chips(page).getByRole('link', { name: 'Hair Care' }).click();
  await expect(page).toHaveURL(/\/tips\/kategori\/hair-care\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hair Care', { timeout: 20_000 });
  await expect(page).toHaveTitle(/Hair Care: Tips & Trik/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${UNIFORM_URL}/tips/kategori/hair-care/`);
  await expect(chips(page).getByRole('link', { name: 'Hair Care' })).toHaveAttribute('aria-current', 'page');
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first().getByRole('heading')).toHaveText(withToc.title);
  const types = await page.locator('script[type="application/ld+json"]').evaluateAll((els) => els.map((e) => JSON.parse(e.textContent ?? '{}')['@type']));
  expect(types).toEqual(expect.arrayContaining(['CollectionPage', 'BreadcrumbList']));

  await chips(page).getByRole('link', { name: 'Grooming' }).click();
  await expect(page).toHaveURL(/\/tips\/kategori\/grooming\/$/);
  await expect(cards(page)).toHaveCount(12, { timeout: 20_000 });
  expect(await clsOf(page), 'CLS halaman kategori').toBeLessThan(0.005);
  await page.getByRole('link', { name: 'Berikutnya' }).click();
  await expect(page).toHaveURL(/\/tips\/kategori\/grooming\/halaman\/2\/$/);
  await expect(cards(page)).toHaveCount(E2E_TIPS.groomingCount - 12, { timeout: 20_000 });
  await chips(page).getByRole('link', { name: 'Semua' }).click();
  await expect(page).toHaveURL(/\/tips\/$/);
});

test('tanpa JavaScript: daftar & chip kategori tetap jalan (link ke halaman kategori statis)', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${UNIFORM_URL}/tips/`);
  await expect(page.getByRole('heading', { level: 1, name: 'Tips & Trik' })).toBeVisible();
  await expect(page.locator('.prerender h2')).toHaveCount(12);
  await page.getByRole('link', { name: 'Hair Style', exact: true }).click();
  await expect(page).toHaveURL(/\/tips\/kategori\/hair-style\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Hair Style' })).toBeVisible();
  await expect(page.locator('.prerender h2')).toHaveText([noToc.title]);
  await context.close();
});

test('artikel: breadcrumb, meta, sampul, poin penting, daftar isi, FAQ, kotak penulis, bagikan, CTA WA, layanan, terkait', async ({ page, context, isMobile }) => {
  await page.goto(`${UNIFORM_URL}/tips/${withToc.slug}/`, { waitUntil: 'domcontentloaded' });
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toHaveText(withToc.title, { timeout: 20_000 });
  await expect(page.locator('.prerender')).toHaveCount(0);

  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs.getByRole('link', { name: 'Beranda' })).toHaveAttribute('href', '/');
  await expect(crumbs.getByRole('link', { name: 'Tips & Trik' })).toHaveAttribute('href', '/tips/');
  const last = crumbs.getByText(withToc.title);
  await expect(last).toHaveAttribute('aria-current', 'page');
  if (isMobile) {
    // Satu baris; judul (item terakhir) dipotong dengan ellipsis
    expect(await last.evaluate((el) => getComputedStyle(el).textOverflow)).toBe('ellipsis');
    const heights = await crumbs.getByRole('listitem').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(heights).size, 'breadcrumb satu baris').toBe(1);
  }

  const main = page.locator('main');
  await expect(main.getByText('20 Oktober 2026')).toBeVisible();
  await expect(main.getByText('25 Oktober 2026')).toBeVisible();
  await expect(main.getByText(/^\d+ menit baca$/).first()).toBeVisible();
  const cover = main.locator('article img').first();
  await expect(cover).toHaveAttribute('loading', 'eager');
  await expect(main.locator('article [class*="prose"] img')).toHaveAttribute('loading', 'lazy');

  // Poin penting: di bawah sampul, sebelum isi artikel
  const keyPoints = page.getByRole('region', { name: 'Poin penting' });
  await expect(keyPoints.getByRole('listitem')).toHaveText([...withToc.keyPoints]);
  const order = await page.evaluate(() => {
    const [img, box, prose] = [document.querySelector('article img'), document.querySelector('#tips-key-points'), document.querySelector('article [class*="prose"]')];
    return Boolean(img && box && prose && img.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING && box.compareDocumentPosition(prose) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order, 'sampul → poin penting → isi').toBe(true);

  // HTML mentah di isi artikel tidak dieksekusi (tampil sebagai teks)
  expect(await page.evaluate(() => (window as unknown as { __tipXss?: boolean }).__tipXss)).toBeUndefined();

  const toc = page.getByRole('navigation', { name: 'Daftar isi' });
  await expect(toc.getByRole('link')).toHaveText([...withToc.headings]);
  await toc.getByRole('link', { name: withToc.headings[2] }).click();
  await expect(page).toHaveURL(/#langkah-uji-ketiga$/);
  await expect(page.getByRole('heading', { level: 2, name: withToc.headings[2] })).toBeInViewport();

  // FAQ artikel: akordeon tertutup → dibuka
  const faq = page.getByRole('region', { name: 'Tanya jawab' });
  const q = faq.getByText(withToc.faq[0].question);
  await expect(faq.getByText(withToc.faq[0].answer)).toBeHidden();
  await q.click();
  await expect(faq.getByText(withToc.faq[0].answer)).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').evaluateAll((els) => els.map((e) => JSON.parse(e.textContent ?? '{}')));
  const faqLd = ld.find((x) => x['@type'] === 'FAQPage');
  expect(faqLd.mainEntity.map((m: { name: string }) => m.name)).toEqual(withToc.faq.map((x) => x.question));
  expect(ld.find((x) => x['@type'] === 'BlogPosting').author).toMatchObject({ '@type': 'Person', name: barber, jobTitle: 'Hairstylist', description: 'Bio singkat barber uji satu.' });

  // Kotak penulis: foto, nama → kartu kapster, pengalaman, keahlian, bio, booking kapster itu
  const author = page.getByRole('region', { name: 'Tentang penulis' });
  await expect(author.locator('img')).toBeVisible();
  await expect(author.getByRole('link', { name: barber, exact: true })).toHaveAttribute('href', '/#hairstylist');
  await expect(author).toContainText('8 tahun uji');
  await expect(author.getByRole('listitem')).toHaveText(['Fade uji', 'Crop uji']);
  await expect(author).toContainText('Bio singkat barber uji satu.');
  const bookBarber = author.getByRole('link', { name: `Booking dengan ${barber}` });
  const barberWa = parseWa((await bookBarber.getAttribute('href'))!);
  expect(barberWa.number).toBe('6281100000303');
  expect(barberWa.text).toContain(`Kapster Pilihan: ${barber}`);

  // Bagikan ke WhatsApp: judul + link artikel
  const share = page.getByRole('group', { name: 'Bagikan artikel' });
  const shareHref = new URL((await share.getByRole('link', { name: 'Bagikan ke WhatsApp' }).getAttribute('href'))!);
  expect(`${shareHref.origin}${shareHref.pathname}`).toBe('https://wa.me/');
  expect(shareHref.searchParams.get('text')).toBe(`${withToc.title} ${UNIFORM_URL}/tips/${withToc.slug}/`);

  const services = page.locator('section[aria-labelledby="tips-services"]');
  await expect(services.getByText(withToc.service, { exact: true })).toBeVisible();
  await expect(services.getByRole('link', { name: 'Lihat harga' })).toHaveAttribute('href', '/#harga-haircut');
  const related = page.locator('section[aria-labelledby="tips-related"]');
  await expect(related.getByRole('listitem')).toHaveCount(3);
  await expect(related.getByText(withToc.title)).toHaveCount(0);

  expect(await clsOf(page), 'CLS artikel').toBeLessThan(0.005);
  await expectNoHorizontalScroll(page);

  // CTA: pemilih cabang → WhatsApp cabang itu, pesan menyebut judul artikel
  await page.getByRole('link', { name: 'Konsultasi via WhatsApp' }).click();
  const picker = page.getByRole('dialog', { name: 'Pilih cabang' });
  await picker.getByRole('button', { name: /Cibubur/ }).click();
  const popup = context.waitForEvent('page');
  await picker.getByRole('button', { name: /^Cibubur/ }).last().click();
  const wa = parseWa((await popup).url());
  expect(wa.number).toBe(E2E_BRANCHES.cibubur.whatsappNumber);
  expect(wa.text).toContain(`cabang ${E2E_BRANCHES.cibubur.name}`);
  expect(wa.text).toContain(`saya baca tips "${withToc.title}" di website`);
  expect(wa.text.length).toBeLessThanOrEqual(500);
});

test('salin link: clipboard berhasil → "Link disalin"; clipboard ditolak → link ditampilkan untuk disalin manual', async ({ browser, isMobile }) => {
  test.skip(isMobile, 'cukup sekali (desktop)');
  const url = `${UNIFORM_URL}/tips/${withToc.slug}/`;
  const ok = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ok.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Salin link' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Link disalin' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  await ok.close();

  const denied = await browser.newContext();
  const page2 = await denied.newPage();
  await page2.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('ditolak')) } });
    document.execCommand = () => false;
  });
  await page2.goto(url, { waitUntil: 'domcontentloaded' });
  await page2.getByRole('button', { name: 'Salin link' }).click();
  const manual = page2.getByLabel('Salin link ini secara manual:');
  await expect(manual).toHaveValue(url);
  await expect(manual).toBeFocused();
  await denied.close();
});

test('artikel tanpa penulis, < 3 subjudul, tanpa poin penting & FAQ; SEO: title, canonical, og, JSON-LD', async ({ page }) => {
  await page.goto(`${UNIFORM_URL}/tips/${noToc.slug}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(noToc.title, { timeout: 20_000 });
  for (const name of ['Daftar isi']) await expect(page.getByRole('navigation', { name })).toHaveCount(0);
  for (const name of ['Poin penting', 'Tanya jawab', 'Tentang penulis']) await expect(page.getByRole('region', { name })).toHaveCount(0);
  await expect(page.getByText('Ditulis oleh')).toHaveCount(0);
  await expect(page).toHaveTitle(`[STAGING] ${noToc.title} | Cutless Hair Studio`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${UNIFORM_URL}/tips/${noToc.slug}/`);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${UNIFORM_URL}/uploads/tips/sampul-uji.webp`);
  const types = await page.locator('script[type="application/ld+json"]').evaluateAll((els) => els.map((e) => JSON.parse(e.textContent ?? '{}')['@type']));
  expect(types).toEqual(expect.arrayContaining(['BlogPosting', 'BreadcrumbList']));
  expect(types).not.toContain('FAQPage');
  await expectNoHorizontalScroll(page);
});

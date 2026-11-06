import { expect, type Page } from '@playwright/test';
import { E2E_BRANCH_DETAILS, E2E_BRANCHES, E2E_PRICING, E2E_SERVICE_PAGES } from './fixtures/content';
import { clsOf, expectNoHorizontalScroll, parseWa, test } from './helpers';

/**
 * Halaman layanan mengikuti Tampilkan halaman layanan saat build (halaman uji e2e/fixtures/content.ts →
 * E2E_SERVICE_PAGES); bagian baru halaman cabang selalu tampil (E2E_BRANCH_DETAILS: Bogor terisi, Cibubur kosong):
 * - build bawaan (Worker, :8787): mati → /layanan* 301 ke beranda, tidak di menu/sitemap/llms.txt, tanpa "Selengkapnya";
 * - varian uniform (:8788, harga sama di semua cabang): aktif → 3 halaman Terbit, 1 Draf tersembunyi.
 * Harga BERBEDA per cabang diuji di tests/service-pages.test.ts (varian uniform sengaja berharga sama).
 * Dijalankan di HP 360 px & desktop.
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const UNIFORM_URL = 'http://localhost:8788';
const { haircut, coloring, kids, draft } = E2E_SERVICE_PAGES;
const priceOf = (name: string) => E2E_PRICING.find((p) => p.name === name)!.price;
const k = (n: number) => `${n / 1000}K`;

/** JSON-LD halaman (semua blok) */
const jsonLd = async (page: Page) =>
  (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap((t) => {
    const v = JSON.parse(t);
    return Array.isArray(v) ? v : [v];
  });

/** Menu utama: navbar desktop, atau menu HP (dibuka dulu) */
async function mainNav(page: Page, isMobile: boolean) {
  await page.evaluate(() => window.scrollTo(0, 0));
  if (isMobile) await page.getByRole('button', { name: 'Buka menu' }).click();
  return page.getByRole('navigation', { name: 'Menu utama' });
}

test('mati: /layanan* 301 ke beranda, tidak di sitemap/llms.txt, menu Layanan ke #layanan, tanpa "Selengkapnya"', async ({ request, page, isMobile }) => {
  for (const path of ['/layanan', '/layanan/', `/layanan/${haircut.slug}/`]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(301);
    expect(new URL(res.headers()['location'], 'http://x').pathname, path).toBe('/');
  }
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/layanan');
  expect(await (await request.get('/llms.txt')).text()).not.toContain('/layanan');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
  await expect((await mainNav(page, isMobile)).getByRole('link', { name: 'Layanan', exact: true })).toHaveAttribute('href', '#layanan');
  await page.locator('#harga').scrollIntoViewIfNeeded({ timeout: 20_000 });
  await expect(page.locator('#harga')).toBeVisible();
  await expect(page.locator('a[href^="/layanan/"]')).toHaveCount(0);
});

test('halaman cabang: deskripsi, area, patokan, fasilitas (ikon), "Buka sampai 21.00", FAQ cabang; kosong = tidak tampil', async ({ page, request }) => {
  const d = E2E_BRANCH_DETAILS.bogor;
  await page.goto(`/cabang/${E2E_BRANCHES.bogor.slug}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('main').getByText('Buka sampai 21.00')).toBeVisible();
  await expect(page.locator('main').getByText('Setiap hari 09.00–21.00')).toBeVisible();
  const about = page.locator('#tentang-cabang');
  await about.scrollIntoViewIfNeeded({ timeout: 20_000 });
  await expect(about.getByText(d.description)).toBeVisible();
  await expect(about.getByRole('heading', { name: 'Area yang dilayani' })).toBeVisible();
  for (const a of d.serviceAreas) await expect(about.getByText(a, { exact: true })).toBeVisible();
  await expect(about.getByText(d.directions)).toBeVisible();
  // Fasilitas urut daftar CMS (bukan urutan isian), masing-masing dengan ikon
  const facilities = about.getByRole('heading', { name: 'Fasilitas & pembayaran' }).locator('xpath=following-sibling::ul[1]').getByRole('listitem');
  await expect(facilities).toHaveText(['Walk-in diterima', 'Parkir motor', 'Tunai', 'QRIS']);
  await expect(facilities.locator('svg')).toHaveCount(4);
  // Halaman layanan mati: daftar "Layanan di cabang ini" tidak ada
  await expect(about.getByRole('heading', { name: 'Layanan di cabang ini' })).toHaveCount(0);
  const faq = page.locator('#faq-cabang');
  await faq.scrollIntoViewIfNeeded({ timeout: 20_000 });
  await faq.getByText(d.faq[0].question).click();
  await expect(faq.getByText(d.faq[0].answer)).toBeVisible();
  await expectNoHorizontalScroll(page);

  // JSON-LD HairSalon: areaServed, amenityFeature, paymentAccepted, hasOfferCatalog (IDR); FAQPage cabang
  const ld = await jsonLd(page);
  const salon = ld.find((x) => x['@type'] === 'HairSalon');
  expect(salon.description).toBe(d.description);
  expect(salon.areaServed.map((a: { name: string }) => a.name)).toEqual([E2E_BRANCHES.bogor.city, ...d.serviceAreas]);
  expect(salon.amenityFeature.map((a: { name: string }) => a.name)).toEqual(['Walk-in diterima', 'Parkir motor']);
  expect(salon.paymentAccepted).toBe('Tunai, QRIS');
  expect(salon.hasOfferCatalog.itemListElement.every((o: { priceCurrency: string }) => o.priceCurrency === 'IDR')).toBe(true);
  expect(ld.find((x) => x['@type'] === 'FAQPage').mainEntity[0].name).toBe(d.faq[0].question);
  expect(await (await request.get('/llms.txt')).text()).toContain(`- Area sekitar: ${d.serviceAreas.join(', ')}`);

  // Cibubur: semua field baru kosong → bagian tidak tampil
  await page.goto(`/cabang/${E2E_BRANCHES.cibubur.slug}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
  await page.locator('#harga').scrollIntoViewIfNeeded({ timeout: 20_000 });
  await expect(page.locator('#tentang-cabang')).toHaveCount(0);
  await expect(page.locator('#faq-cabang')).toHaveCount(0);
  expect((await jsonLd(page)).some((x) => x['@type'] === 'FAQPage')).toBe(false);
});

test('aktif: /layanan/ & halaman di sitemap (lastmod) dan llms.txt (harga mulai per cabang); Draf tidak di-build', async ({ request, isMobile }) => {
  test.skip(isMobile, 'pemeriksaan server');
  expect((await request.get(`${UNIFORM_URL}/layanan/`, { maxRedirects: 0 })).status()).toBe(200);
  const sitemap = await (await request.get(`${UNIFORM_URL}/sitemap.xml`)).text();
  expect(sitemap).toMatch(/<loc>[^<]*\/layanan\/<\/loc>/);
  expect(sitemap).toMatch(new RegExp(`<loc>[^<]*/layanan/${haircut.slug}/</loc><lastmod>${haircut.updatedAt}</lastmod>`));
  expect(sitemap).not.toContain(draft.slug);
  const llms = await (await request.get(`${UNIFORM_URL}/llms.txt`)).text();
  const from = k(priceOf('White Grooming Uji'));
  expect(llms).toContain(`- [${haircut.title}](${UNIFORM_URL}/layanan/${haircut.slug}/): ${haircut.summary} Harga mulai: ${E2E_BRANCHES.bogor.name} ${from}, ${E2E_BRANCHES.cibubur.name} ${from}.`);
  expect(llms).toContain(`- [${kids.title}](${UNIFORM_URL}/layanan/${kids.slug}/): ${kids.summary} ${kids.priceNote}`);
  expect(llms).not.toContain(draft.title);
  expect(await (await request.get(`${UNIFORM_URL}/layanan/${draft.slug}/`)).text()).not.toContain(draft.title);
});

test('/layanan/: menu Layanan, grup per kategori Daftar Harga, harga mulai per cabang; CollectionPage', async ({ page, isMobile }) => {
  await page.goto(`${UNIFORM_URL}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
  await (await mainNav(page, isMobile)).getByRole('link', { name: 'Layanan', exact: true }).click();
  await expect(page).toHaveURL(/\/layanan\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Layanan Cutless Hair Studio' })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#layanan h2')).toHaveText(['Haircut', 'Special Treatment', 'Layanan lainnya']);
  const card = page.locator('main li', { has: page.getByRole('link', { name: haircut.title }) }).first();
  await expect(card).toContainText(haircut.summary);
  await expect(card).toContainText(`${E2E_BRANCHES.bogor.name} mulai ${k(priceOf('White Grooming Uji'))}`);
  await expect(page.locator('main li', { has: page.getByRole('link', { name: kids.title }) }).first()).toContainText(kids.priceNote);
  await expect(page.getByText(draft.title)).toHaveCount(0);
  expect(await clsOf(page), 'CLS /layanan/').toBeLessThan(0.005);
  await expectNoHorizontalScroll(page);
  const ld = await jsonLd(page);
  expect(ld.find((x) => x['@type'] === 'CollectionPage').mainEntity.itemListElement.map((i: { name: string }) => i.name)).toEqual([haircut.title, coloring.title, kids.title]);
});

test('halaman layanan: breadcrumb, harga per cabang dari Daftar Harga, cabang, isi, FAQ, booking WA lewat pemilih cabang, JSON-LD', async ({ page, context }) => {
  await page.goto(`${UNIFORM_URL}/layanan/${haircut.slug}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(haircut.title, { timeout: 20_000 });
  await expect(page.locator('.prerender')).toHaveCount(0);
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs.getByRole('link', { name: 'Layanan' })).toHaveAttribute('href', '/layanan/');
  await expect(crumbs.getByText(haircut.title)).toHaveAttribute('aria-current', 'page');

  // Harga: satu kartu per cabang, harga = Daftar Harga uji (format K), "mulai" = termurah
  const prices = page.getByRole('region', { name: 'Harga' });
  for (const b of Object.values(E2E_BRANCHES)) {
    const branchCard = prices.locator('li', { has: page.getByRole('heading', { name: b.name }) });
    await expect(branchCard).toContainText(`mulai ${k(priceOf('White Grooming Uji'))}`);
    for (const item of haircut.pricingItems) await expect(branchCard.locator('li', { hasText: item })).toContainText(k(priceOf(item)));
  }
  const branches = page.getByRole('region', { name: 'Tersedia di cabang' });
  await expect(branches.getByRole('link')).toHaveText(Object.values(E2E_BRANCHES).map((b) => b.name));
  await expect(branches.getByRole('link', { name: E2E_BRANCHES.cibubur.name })).toHaveAttribute('href', `/cabang/${E2E_BRANCHES.cibubur.slug}/`);
  await expect(page.getByRole('region', { name: 'Cocok untuk' }).getByRole('listitem')).toHaveText([...haircut.suitableFor]);
  await expect(page.getByRole('region', { name: 'Proses' }).getByRole('listitem')).toHaveText([...haircut.steps]);
  await expect(page.getByText(haircut.duration)).toBeVisible();
  const photo = page.getByRole('list', { name: 'Foto' }).locator('img');
  await expect(photo).toHaveAttribute('loading', 'lazy');
  await expect(photo).toHaveAttribute('width', /\d+/);
  await expect(page.getByRole('heading', { level: 2, name: haircut.heading })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __serviceXss?: boolean }).__serviceXss)).toBeUndefined();
  const faq = page.getByRole('region', { name: 'Tanya jawab' });
  await faq.getByText(haircut.faq[0].question).click();
  await expect(faq.getByText(haircut.faq[0].answer)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Layanan terkait' }).getByRole('link', { name: coloring.title })).toBeVisible();
  expect(await clsOf(page), 'CLS halaman layanan').toBeLessThan(0.005);
  await expectNoHorizontalScroll(page);

  // JSON-LD: Service (provider HairSalon cabang, offers per cabang IDR), FAQPage, BreadcrumbList
  const ld = await jsonLd(page);
  const service = ld.find((x) => x['@type'] === 'Service');
  expect(service.provider.map((p: { '@id': string }) => p['@id'])).toEqual(Object.values(E2E_BRANCHES).map((b) => `${UNIFORM_URL}/cabang/${b.slug}/#salon`));
  expect(service.offers.map((o: { price: number; priceCurrency: string }) => [o.price, o.priceCurrency])).toEqual([
    [priceOf('White Grooming Uji'), 'IDR'],
    [priceOf('White Grooming Uji'), 'IDR'],
  ]);
  expect(ld.find((x) => x['@type'] === 'FAQPage').mainEntity).toHaveLength(haircut.faq.length);
  expect(ld.find((x) => x['@type'] === 'BreadcrumbList').itemListElement).toHaveLength(3);

  // Booking: pemilih cabang → WhatsApp cabang itu, pesan menyebut nama layanan
  await page.getByRole('link', { name: `Booking ${haircut.title}` }).click();
  const picker = page.getByRole('dialog', { name: 'Pilih cabang' });
  await picker.getByRole('button', { name: /Cibubur/ }).click();
  const popup = context.waitForEvent('page');
  await picker.getByRole('button', { name: /^Cibubur/ }).last().click();
  const wa = parseWa((await popup).url());
  expect(wa.number).toBe(E2E_BRANCHES.cibubur.whatsappNumber);
  expect(wa.text).toContain(`cabang ${E2E_BRANCHES.cibubur.name}`);
  expect(wa.text).toContain(haircut.title);
});

test('link internal: Daftar Harga & Kartu Layanan "Selengkapnya", layanan di halaman cabang', async ({ page }) => {
  await page.goto(`${UNIFORM_URL}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
  const services = page.locator('#layanan');
  await services.scrollIntoViewIfNeeded({ timeout: 20_000 });
  await expect(services.getByRole('link', { name: `Selengkapnya ${haircut.serviceCard}` })).toHaveAttribute('href', `/layanan/${haircut.slug}/`);
  // Kartu tanpa halaman: tanpa "Selengkapnya"
  await expect(services.getByRole('link', { name: /^Selengkapnya/ })).toHaveCount(1);
  const pricing = page.locator('#harga');
  await pricing.scrollIntoViewIfNeeded({ timeout: 20_000 });
  await expect(pricing.getByRole('link', { name: 'Selengkapnya White Grooming Uji' })).toHaveAttribute('href', `/layanan/${haircut.slug}/`);
  await expect(pricing.getByRole('link', { name: 'Selengkapnya Woman Haircut Uji' })).toHaveCount(0);

  await page.goto(`${UNIFORM_URL}/cabang/${E2E_BRANCHES.cibubur.slug}/`, { waitUntil: 'domcontentloaded' });
  const about = page.locator('#tentang-cabang');
  await about.scrollIntoViewIfNeeded({ timeout: 20_000 });
  const list = about.getByRole('heading', { name: 'Layanan di cabang ini' }).locator('xpath=following-sibling::ul[1]');
  await expect(list.getByRole('link')).toHaveText([haircut.title, coloring.title, kids.title]);
  await expect(list.getByRole('listitem').first()).toContainText(`mulai ${k(priceOf('White Grooming Uji'))}`);
  await list.getByRole('link', { name: kids.title }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(kids.title, { timeout: 20_000 });
  // Tanpa item Daftar Harga: catatan harga, tanpa offers
  await expect(page.getByRole('region', { name: 'Harga' })).toContainText(kids.priceNote);
  expect((await jsonLd(page)).find((x) => x['@type'] === 'Service').offers).toBeUndefined();
});

import { expect, type Page } from '@playwright/test';
import { E2E_BRANCHES, E2E_KABAR } from './fixtures/content';
import { clsOf, parseWa, test } from './helpers';
import { requiredEventProps } from '../tests/helpers/eventJsonLd';

/**
 * Kabar, Promo & Acara mengikuti Tampilkan Kabar & Tampilkan banner saat build (item uji e2e/fixtures/content.ts →
 * E2E_KABAR, tanggal tetap: 2020 = berakhir, 2099 = aktif/akan datang):
 * - build bawaan (Worker, :8787): mati → /kabar* 301 ke beranda, tidak di menu/sitemap/llms.txt, tanpa kotak & banner;
 * - varian uniform (:8788): aktif → daftar tiga grup, detail per jenis, tombol WhatsApp, kotak di halaman cabang, banner.
 * Kedaluwarsa di browser diuji dengan jam browser 1 Januari 2100 (semua item 2099 sudah berakhir) walau HTML statis
 * hasil build masih memuatnya. Dijalankan di HP 360 px & desktop.
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const UNIFORM_URL = 'http://localhost:8788';
const K = E2E_KABAR;
type Item = (typeof K)[keyof typeof K];
const detail = (k: Item) => `/kabar/${k.slug}/`;
const PUBLISHED = Object.values(K).filter((k) => k !== K.draf);
/** Semua item 2099 sudah berakhir; build (dan HTML statis) dibuat dengan jam sekarang */
const AFTER_ALL = new Date('2100-01-01T00:00:00+07:00');

const ACTIVE = [K.acaraCabang, K.acaraTempatLain, K.promoDua, K.promoAkanDatang, K.promoCibubur];
const NEWS = [K.kabarGambar, K.kabar];
const ENDED = [K.acaraLewat, K.promoLewat];
const GROUPS = { active: 'Sedang berlangsung & akan datang', news: 'Kabar terbaru', ended: 'Sudah berakhir' };

const titles = (k: Item[]) => k.map((x) => x.title);
const group = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
/** Judul kartu yang terlihat di dalam wadah */
const visibleTitles = (page: Page, scope: string) =>
  page.locator(`${scope} li h3`).evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.textContent?.trim()));
const boxOf = (page: Page) => page.getByRole('region', { name: 'Promo & acara', exact: true });
const bannerOf = (page: Page) => page.getByRole('complementary', { name: 'Kabar, Promo & Acara' });

async function open(page: Page, path: string, base = UNIFORM_URL) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.prerender')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('main h1').first()).toBeVisible();
}

/** Tidak ada scroll horizontal (scrollingElement, sesuai permintaan pemilik) */
async function expectNoScrollX(page: Page) {
  const r = await page.evaluate(() => ({ scroll: document.scrollingElement!.scrollWidth, inner: window.innerWidth }));
  expect(r.scroll, `scrollWidth ${r.scroll} > innerWidth ${r.inner}`).toBeLessThanOrEqual(r.inner);
}

/** JSON-LD dari HTML hasil build (tanpa JavaScript) */
async function jsonLdOf(page: Page, path: string): Promise<Record<string, unknown>[]> {
  const html = await (await page.request.get(`${UNIFORM_URL}${path}`)).text();
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}

/* ---------- Toggle mati (build bawaan) ---------- */

test('Tampilkan Kabar mati: /kabar* 301 ke beranda, tanpa menu, sitemap, llms.txt, kotak cabang, & banner', async ({ request, page, isMobile }) => {
  for (const path of ['/kabar', '/kabar/', detail(K.promoCibubur)]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(301);
    expect(new URL(res.headers()['location'], 'http://x').pathname, path).toBe('/');
  }
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/kabar');
  expect(await (await request.get('/llms.txt')).text()).not.toMatch(/kabar/i);
  for (const b of Object.values(E2E_BRANCHES)) expect(await (await request.get(`/cabang/${b.slug}/`)).text(), b.slug).not.toContain('data-kabar');
  expect(await (await request.get('/')).text()).not.toContain('data-kabar');

  await open(page, '/', '');
  await expect(bannerOf(page)).toHaveCount(0);
  await expect(page.locator('footer').getByRole('link', { name: 'Kabar', exact: true })).toHaveCount(0);
  if (isMobile) {
    // Wadah yang sama dengan tes toggle-aktif; harus terbuka dulu supaya pemeriksaan tidak lolos hampa
    await page.getByRole('button', { name: 'Buka menu' }).click();
    await expect(page.locator('#mobile-menu')).toBeVisible();
    await expect(page.locator('#mobile-menu').getByRole('link', { name: 'Kabar', exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole('navigation', { name: 'Menu utama' }).getByRole('link', { name: 'Kabar', exact: true })).toHaveCount(0);

  await open(page, `/cabang/${E2E_BRANCHES.cibubur.slug}/`, '');
  await expect(boxOf(page)).toHaveCount(0);
});

/* ---------- /kabar/ ---------- */

test('/kabar/: tiga grup berurutan, acara terdekat di atas, Draf tidak ada, "Mulai …" pada promo akan datang', async ({ page }) => {
  await open(page, '/kabar/');
  await expect(page.getByRole('heading', { level: 1, name: 'Kabar, Promo & Acara' })).toBeVisible();
  expect(await page.locator('#kabar section h2').allTextContents()).toEqual([GROUPS.active, GROUPS.news, GROUPS.ended]);
  expect(await group(page, GROUPS.active).locator('li h3').allTextContents()).toEqual(titles(ACTIVE));
  expect(await group(page, GROUPS.news).locator('li h3').allTextContents()).toEqual(titles(NEWS));
  expect(await group(page, GROUPS.ended).locator('li h3').allTextContents()).toEqual(titles(ENDED));
  await expect(page.getByText(K.draf.title)).toHaveCount(0);

  const upcoming = group(page, GROUPS.active).getByRole('listitem').filter({ hasText: K.promoAkanDatang.title });
  await expect(upcoming).toContainText('Mulai 1 Januari 2099');
  const ended = group(page, GROUPS.ended);
  await expect(ended.getByRole('listitem').filter({ hasText: K.promoLewat.title })).toContainText('Promo telah berakhir');
  await expect(ended.getByRole('listitem').filter({ hasText: K.acaraLewat.title })).toContainText('Acara telah selesai');
  // Kartu bergambar: alt dari CMS
  await expect(page.getByRole('img', { name: K.kabarGambar.imageAlt })).toBeVisible();
  await expect(page.locator('main')).toHaveCount(1);
  await expectNoScrollX(page);
});

test('/kabar/ tanpa JavaScript: semua item terbit ada di HTML statis, Draf tidak; halaman detail 200', async ({ request, isMobile }) => {
  test.skip(isMobile, 'pemeriksaan server');
  const html = await (await request.get(`${UNIFORM_URL}/kabar/`)).text();
  for (const k of PUBLISHED) {
    expect(html, k.slug).toContain(`<a href="${detail(k)}">${k.title}</a>`);
    expect((await request.get(`${UNIFORM_URL}${detail(k)}`)).status(), k.slug).toBe(200);
  }
  expect(html).not.toContain(K.draf.title);
  expect(html).not.toContain(K.draf.slug);
  const sitemap = await (await request.get(`${UNIFORM_URL}/sitemap.xml`)).text();
  expect(sitemap).toContain('/kabar/</loc>');
  for (const k of PUBLISHED) expect(sitemap).toContain(`/kabar/${k.slug}/</loc><lastmod>${k.publishedAt}</lastmod>`);
  expect(sitemap).not.toContain(K.draf.slug);
  const llms = await (await request.get(`${UNIFORM_URL}/llms.txt`)).text();
  for (const k of ACTIVE) expect(llms).toContain(`[${k.title}](${UNIFORM_URL}${detail(k)}): ${k.summary}`);
  for (const k of [...ENDED, ...NEWS, K.draf]) expect(llms).not.toContain(k.title);
});

test('/kabar/: saring cabang & jenis', async ({ page }) => {
  await open(page, '/kabar/');
  const select = page.locator('main select');
  await select.selectOption(E2E_BRANCHES.cibubur.slug);
  // Cibubur: item Bogor saja (acara di cabang Bogor, acara lewat Bogor) tersembunyi; "semua" & Cibubur tetap
  expect(await visibleTitles(page, 'main')).toEqual(titles([K.acaraTempatLain, K.promoDua, K.promoAkanDatang, K.promoCibubur, ...NEWS, K.promoLewat]));
  await select.selectOption(E2E_BRANCHES.bogor.slug);
  expect(await visibleTitles(page, 'main')).toEqual(titles([K.acaraCabang, K.acaraTempatLain, K.promoDua, K.promoAkanDatang, ...NEWS, ...ENDED]));

  await select.selectOption('');
  const kinds = page.getByRole('group', { name: 'Jenis' });
  await kinds.getByRole('button', { name: 'Acara', exact: true }).click();
  await expect(kinds.getByRole('button', { name: 'Acara', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await visibleTitles(page, 'main')).toEqual(titles([K.acaraCabang, K.acaraTempatLain, K.acaraLewat]));
  // Grup tanpa item terlihat ikut tersembunyi
  await expect(group(page, GROUPS.news)).toBeHidden();
  await kinds.getByRole('button', { name: 'Promo', exact: true }).click();
  expect(await visibleTitles(page, 'main')).toEqual(titles([K.promoDua, K.promoAkanDatang, K.promoCibubur, K.promoLewat]));
  await kinds.getByRole('button', { name: 'Semua', exact: true }).click();
  expect(await visibleTitles(page, 'main')).toEqual(titles([...ACTIVE, ...NEWS, ...ENDED]));
});

/* ---------- Detail ---------- */

test('detail Kabar (gambar + alt) & Promo periode dengan dua tombol WhatsApp (satu per cabang)', async ({ page }) => {
  await open(page, detail(K.kabarGambar));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(K.kabarGambar.title);
  await expect(page.locator('main').getByText('Kabar', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: K.kabarGambar.imageAlt })).toBeVisible();
  await expect(page.locator('main').getByText('Periode')).toHaveCount(0);
  // Isi Markdown: HTML mentah tampil sebagai teks, tidak dieksekusi
  expect(await page.evaluate(() => (window as unknown as { __kabarXss?: boolean }).__kabarXss)).toBeUndefined();
  await expectNoScrollX(page);

  await open(page, detail(K.promoDua));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(K.promoDua.title);
  await expect(page.locator('main')).toContainText('Periode Berlaku 1 Oktober 2026 – 30 Juni 2099');
  for (const b of [E2E_BRANCHES.bogor, E2E_BRANCHES.cibubur]) {
    const wa = parseWa((await page.getByRole('link', { name: `Booking di ${b.name}` }).getAttribute('href'))!);
    expect(wa.number, b.name).toBe(b.whatsappNumber);
    expect(wa.text).toBe(`Halo Kak! Saya tertarik dengan "${K.promoDua.title}" di Cutless Hair Studio cabang ${b.name}.`);
  }
  await expect(page.locator('main').getByRole('link', { name: /Booking/ })).toHaveCount(2);
  await expectNoScrollX(page);
});

test('detail Promo satu cabang: satu tombol ke WhatsApp cabang itu, judul di pesan', async ({ page }) => {
  await open(page, detail(K.promoCibubur));
  await expect(page.locator('main')).toContainText('Berlaku sampai 31 Desember 2099');
  const buttons = page.locator('main').getByRole('link', { name: /Booking/ });
  await expect(buttons).toHaveCount(1);
  await expect(buttons).toHaveText('Booking via WhatsApp');
  await expect(buttons).toHaveAttribute('target', '_blank');
  const wa = parseWa((await buttons.getAttribute('href'))!);
  expect(wa.number).toBe(E2E_BRANCHES.cibubur.whatsappNumber);
  expect(wa.text).toContain(`"${K.promoCibubur.title}"`);
  expect(wa.text).toContain(`cabang ${E2E_BRANCHES.cibubur.name}`);
  await expectNoScrollX(page);
});

test('detail Acara "Di cabang": waktu, lokasi = cabang + alamat cabang', async ({ page }) => {
  await open(page, detail(K.acaraCabang));
  const main = page.locator('main');
  await expect(main).toContainText('Mulai 20 Desember 2099, 10.00 WIB');
  await expect(main).toContainText('Waktu 20 Desember 2099, 10.00 WIB – 20 Desember 2099, 15.00 WIB');
  await expect(main).toContainText(`Lokasi ${E2E_BRANCHES.bogor.name}`);
  await expect(main).toContainText(E2E_BRANCHES.bogor.address);
  await expect(main).not.toContainText(E2E_BRANCHES.cibubur.address);
  const wa = parseWa((await main.getByRole('link', { name: 'Booking via WhatsApp' }).getAttribute('href'))!);
  expect(wa.number).toBe(E2E_BRANCHES.bogor.whatsappNumber);
  await expectNoScrollX(page);
});

test('detail Acara "Tempat lain": tempat, tautan peta, tombol pendaftaran https; semua cabang → pemilih cabang', async ({ page, context }) => {
  const a = K.acaraTempatLain;
  await open(page, detail(a));
  const main = page.locator('main');
  await expect(main).toContainText(`Lokasi ${a.venueName}, ${a.venueAddress}`);
  const map = main.getByRole('link', { name: 'Lihat di peta' });
  await expect(map).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\//);
  expect(decodeURIComponent((await map.getAttribute('href'))!)).toContain(`${a.venueName} ${a.venueAddress}`);
  await expect(map).toHaveAttribute('target', '_blank');
  await expect(map).toHaveAttribute('rel', /noopener/);
  const reg = main.getByRole('link', { name: 'Buka tautan acara' });
  await expect(reg).toHaveAttribute('href', a.linkUrl);
  await expect(reg).toHaveAttribute('target', '_blank');
  await expect(reg).toHaveAttribute('rel', /noopener/);
  await expectNoScrollX(page);

  await main.getByRole('link', { name: 'Booking via WhatsApp' }).click();
  const picker = page.getByRole('dialog', { name: 'Pilih cabang' });
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: /Cibubur/ }).click();
  const popup = context.waitForEvent('page');
  await picker.getByRole('button', { name: /^Cibubur/ }).last().click();
  const wa = parseWa((await popup).url());
  expect(wa.number).toBe(E2E_BRANCHES.cibubur.whatsappNumber);
  expect(wa.text).toContain(`"${a.title}"`);
});

test('detail yang sudah berakhir: 200, label berakhir, tanpa tombol WhatsApp', async ({ page }) => {
  for (const [k, label] of [
    [K.promoLewat, 'Promo telah berakhir'],
    [K.acaraLewat, 'Acara telah selesai'],
  ] as const) {
    const res = await page.goto(`${UNIFORM_URL}${detail(k)}`, { waitUntil: 'domcontentloaded' });
    expect(res?.status(), k.slug).toBe(200);
    await expect(page.locator('.prerender')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(k.title);
    await expect(page.locator('main')).toContainText(label);
    await expect(page.locator('main').getByRole('link', { name: /Booking/ })).toHaveCount(0);
    await expectNoScrollX(page);
  }
});

/* ---------- Kotak cabang & banner ---------- */

test('kotak "Promo & acara" di halaman cabang: aktif & akan datang untuk cabang itu atau semua, tanpa yang berakhir', async ({ page }) => {
  await open(page, `/cabang/${E2E_BRANCHES.cibubur.slug}/`);
  await expect(boxOf(page)).toBeVisible();
  expect(await boxOf(page).locator('li h3').allTextContents()).toEqual(titles([K.acaraTempatLain, K.promoDua, K.promoAkanDatang, K.promoCibubur]));
  await expect(boxOf(page).getByRole('listitem').filter({ hasText: K.promoAkanDatang.title })).toContainText('Mulai 1 Januari 2099');
  await expect(boxOf(page).getByRole('link', { name: new RegExp(K.promoCibubur.title) })).toHaveAttribute('href', detail(K.promoCibubur));

  await open(page, `/cabang/${E2E_BRANCHES.bogor.slug}/`);
  expect(await boxOf(page).locator('li h3').allTextContents()).toEqual(titles([K.acaraCabang, K.acaraTempatLain, K.promoDua, K.promoAkanDatang]));
  await expect(boxOf(page)).not.toContainText(K.promoCibubur.title);
  await expect(boxOf(page)).not.toContainText(K.draf.title);
  await expect(page.locator('main')).toHaveCount(1);
});

test('banner beranda menaut ke item aktif terdekat (acara)', async ({ page }) => {
  await open(page, '/');
  const banner = bannerOf(page);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(K.acaraCabang.title);
  await expect(banner).toContainText('Mulai 20 Desember 2099, 10.00 WIB');
  await expect(banner.getByRole('link')).toHaveAttribute('href', detail(K.acaraCabang));
  await expect(page.locator('main')).toHaveCount(1);
  await banner.getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`${detail(K.acaraCabang)}$`));
});

/* ---------- Kedaluwarsa di browser (jam pengunjung) ---------- */

test('jam 2100: kotak cabang & banner hilang walau HTML statis memuatnya; /kabar/ memindahkan item ke "Sudah berakhir"', async ({ page }) => {
  await page.clock.setFixedTime(AFTER_ALL);
  const cibubur = `/cabang/${E2E_BRANCHES.cibubur.slug}/`;
  expect(await (await page.request.get(`${UNIFORM_URL}${cibubur}`)).text()).toContain('data-kabar-box');
  expect(await (await page.request.get(`${UNIFORM_URL}/`)).text()).toContain('data-kabar-banner');

  await open(page, cibubur);
  await expect(page.locator('#promo-acara, [data-kabar-box]')).toHaveCount(0);
  await open(page, `/cabang/${E2E_BRANCHES.bogor.slug}/`);
  await expect(page.locator('#promo-acara, [data-kabar-box]')).toHaveCount(0);
  await open(page, '/');
  await expect(bannerOf(page)).toHaveCount(0);
  await expect(page.locator('[data-kabar-banner]')).toHaveCount(0);

  await open(page, '/kabar/');
  await expect(group(page, GROUPS.active)).toHaveCount(0);
  const ended = await group(page, GROUPS.ended).locator('li h3').allTextContents();
  expect([...ended].sort()).toEqual(titles([...ACTIVE, ...ENDED]).sort());
  // Promo/acara yang baru berakhir: label berakhir, bukan "Mulai …"
  await expect(group(page, GROUPS.ended).getByRole('listitem').filter({ hasText: K.promoAkanDatang.title })).toContainText('Promo telah berakhir');
  await expect(group(page, GROUPS.ended).getByRole('listitem').filter({ hasText: K.acaraCabang.title })).toContainText('Acara telah selesai');
  // Detail item yang baru berakhir: tanpa tombol WhatsApp
  await open(page, detail(K.promoCibubur));
  await expect(page.locator('main')).toContainText('Promo telah berakhir');
  await expect(page.locator('main').getByRole('link', { name: /Booking/ })).toHaveCount(0);
});

/* ---------- CLS & paint pertama ---------- */

/**
 * Catat setiap frame (requestAnimationFrame, dipasang sebelum skrip situs) selama ±2 detik: apakah kotak/banner Kabar
 * (statis atau React) terlihat. Frame selama stylesheet <head> belum termuat tidak dihitung: dokumen masih
 * render-blocked (tidak ada yang tergambar), dan skrip pra-paint inline memang menunggu stylesheet itu (script-blocking).
 */
async function recordKabarVisibility(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __kabarSeen: string[]; __kabarFrames: number };
    w.__kabarSeen = [];
    w.__kabarFrames = 0;
    const sel = '[data-kabar-box], [data-kabar-banner], #promo-acara, aside[aria-label="Kabar, Promo & Acara"]';
    let frame = 0;
    const check = () => {
      frame++;
      const sheets = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')];
      if (sheets.length && sheets.every((l) => l.sheet)) {
        w.__kabarFrames++;
        for (const el of document.querySelectorAll<HTMLElement>(sel)) {
          const r = el.getBoundingClientRect();
          if (el.checkVisibility() && r.width > 0 && r.height > 0) w.__kabarSeen.push(`frame ${w.__kabarFrames}: ${el.tagName}#${el.id}`);
        }
      }
      if (frame < 120) requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

for (const path of ['/', `/cabang/${E2E_BRANCHES.cibubur.slug}/`]) {
  for (const expired of [false, true]) {
    test(`CLS ${path} ${expired ? 'jam 2100 (sudah berakhir, masih di HTML statis)' : 'item aktif'} < 0,005`, async ({ page }, testInfo) => {
      if (expired) await page.clock.setFixedTime(AFTER_ALL);
      await recordKabarVisibility(page);
      await page.goto(`${UNIFORM_URL}${path}`, { waitUntil: 'load' });
      await expect(page.locator('.prerender')).toHaveCount(0, { timeout: 20_000 });
      await page.waitForTimeout(1000);
      const cls = await clsOf(page);
      const seen = await page.evaluate(() => (window as unknown as { __kabarSeen: string[] }).__kabarSeen);
      testInfo.annotations.push({ type: 'CLS', description: `${testInfo.project.name} ${path} ${expired ? 'berakhir' : 'aktif'}: ${cls.toFixed(5)}` });
      console.log(`[CLS] ${testInfo.project.name} ${path} ${expired ? 'berakhir' : 'aktif'}: ${cls.toFixed(5)}`);
      expect(cls).toBeLessThan(0.005);
      if (expired) expect(seen, 'kotak/banner yang sudah berakhir tidak boleh pernah terlihat').toEqual([]);
      else expect(seen[0], 'kotak/banner aktif terlihat sejak frame pertama yang tergambar').toMatch(/^frame 1: /);
      expect(await page.evaluate(() => (window as unknown as { __kabarFrames: number }).__kabarFrames)).toBeGreaterThan(0);
    });
  }
}

/* ---------- Menu ---------- */

/**
 * Pengukuran (desktop 1280 px, varian uniform: Produk & Tips aktif): dengan "Kabar" di navbar desktop (9 menu) ruang
 * kosong di kiri menu tinggal 16 px, dan begitu cabang "Bogor Bantarjati" dipilih tombol cabang meluap 21 px dari
 * kontainer header (label cabang maks. 14rem → 83 px, keluar layar). Aturan pemilik: tidak muat → "Kabar" hanya di
 * menu HP & footer. Tes ini menjaga navbar desktop tetap muat (satu baris, tidak meluap) dengan cabang terpilih.
 */
test('menu Kabar: tidak di navbar desktop (1280 px tetap muat), ada di menu HP & footer', async ({ page, isMobile }, testInfo) => {
  await open(page, '/');
  await expect(page.locator('footer').getByRole('link', { name: 'Kabar', exact: true })).toHaveAttribute('href', '/kabar/');
  if (isMobile) {
    await page.getByRole('button', { name: 'Buka menu' }).click();
    await expect(page.locator('#mobile-menu').getByRole('link', { name: 'Kabar', exact: true })).toBeVisible();
    return;
  }
  const measure = async (label: string) => {
    const m = await page.evaluate(() => {
      const nav = document.querySelector('header nav')!;
      const ul = nav.querySelector('ul')!;
      const inner = nav.parentElement!;
      const links = [...ul.querySelectorAll('a')];
      const logo = inner.querySelector('a')!.getBoundingClientRect();
      const actions = nav.nextElementSibling!.getBoundingClientRect();
      const box = nav.getBoundingClientRect();
      const inBox = inner.getBoundingClientRect();
      return {
        labels: links.map((a) => a.textContent),
        heights: links.map((a) => Math.round(a.getBoundingClientRect().height)),
        tops: links.map((a) => Math.round(a.getBoundingClientRect().top)),
        ul: { scroll: ul.scrollWidth, client: ul.clientWidth },
        inner: { scroll: inner.scrollWidth, client: inner.clientWidth },
        logoRight: Math.round(logo.right),
        navLeft: Math.round(box.left),
        navRight: Math.round(box.right),
        actionsLeft: Math.round(actions.left),
        actionsRight: Math.round(actions.right),
        contentRight: Math.round(inBox.right - parseFloat(getComputedStyle(inner).paddingRight)),
      };
    });
    testInfo.annotations.push({ type: 'menu', description: `${label}: ${JSON.stringify(m)}` });
    console.log(`[menu] ${label} ${JSON.stringify(m)}`);
    expect(m.labels).not.toContain('Kabar');
    expect(new Set(m.tops).size, 'menu satu baris').toBe(1);
    expect(new Set(m.heights).size, 'tidak ada label menu yang membungkus').toBe(1);
    expect(m.ul.scroll).toBeLessThanOrEqual(m.ul.client);
    expect(m.inner.scroll).toBeLessThanOrEqual(m.inner.client);
    expect(m.logoRight).toBeLessThanOrEqual(m.navLeft);
    expect(m.navRight).toBeLessThanOrEqual(m.actionsLeft);
    expect(m.actionsRight, 'tombol header tidak meluap dari kontainer').toBeLessThanOrEqual(m.contentRight);
  };
  for (const path of ['/', '/kabar/', `/cabang/${E2E_BRANCHES.bogor.slug}/`]) {
    await open(page, path);
    await measure(path);
  }
  // Label tombol cabang terpanjang (nama cabang terpilih) memperlebar area tombol di kanan navbar
  await open(page, '/kabar/');
  await page.locator('header').getByRole('button', { name: 'Pilih cabang' }).click();
  const picker = page.getByRole('dialog', { name: 'Pilih cabang' });
  await picker.getByRole('button', { name: /Bogor/ }).first().click();
  await picker.getByRole('button', { name: new RegExp(`^${E2E_BRANCHES.bogor.name}`) }).last().click();
  await expect(page.locator('header')).toContainText(E2E_BRANCHES.bogor.name);
  await measure(`/kabar/ (cabang ${E2E_BRANCHES.bogor.name} dipilih)`);
});

/* ---------- JSON-LD (Rich Results) ---------- */

test('JSON-LD: Event (Acara) lengkap tanpa offers, BlogPosting (Promo/Kabar), CollectionPage + ItemList', async ({ page, isMobile }) => {
  test.skip(isMobile, 'pemeriksaan HTML hasil build');
  for (const a of [K.acaraCabang, K.acaraTempatLain]) {
    const ld = (await jsonLdOf(page, detail(a))).find((x) => x['@type'] === 'Event')!;
    expect(ld, a.slug).toBeTruthy();
    expect(requiredEventProps(ld), a.slug).toEqual([]);
    expect(ld.startDate).toBe(`${a.startsAt}:00+07:00`);
    expect(ld.endDate).toBe(`${a.endsAt}:00+07:00`);
    expect(ld.eventStatus).toBe('https://schema.org/EventScheduled');
    expect(ld.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode');
    expect(ld).not.toHaveProperty('offers');
    expect(ld.organizer).toMatchObject({ '@type': 'Organization', name: 'Cutless Hair Studio' });
    const places = ([] as Record<string, Record<string, unknown>>[]).concat(ld.location as never);
    for (const p of places) {
      expect(p['@type']).toBe('Place');
      expect(p.address['@type']).toBe('PostalAddress');
    }
  }
  const cabang = (await jsonLdOf(page, detail(K.acaraCabang))).find((x) => x['@type'] === 'Event')!;
  expect(cabang.location).toEqual([
    expect.objectContaining({ name: `Cutless Hair Studio ${E2E_BRANCHES.bogor.name}`, address: expect.objectContaining({ postalCode: '16152', addressCountry: 'ID' }) }),
  ]);
  const lain = (await jsonLdOf(page, detail(K.acaraTempatLain))).find((x) => x['@type'] === 'Event')!;
  expect(lain.location).toEqual({ '@type': 'Place', name: K.acaraTempatLain.venueName, address: { '@type': 'PostalAddress', streetAddress: K.acaraTempatLain.venueAddress } });

  for (const k of [K.promoDua, K.promoCibubur, K.kabarGambar]) {
    const ld = (await jsonLdOf(page, detail(k))).find((x) => x['@type'] === 'BlogPosting')!;
    expect(ld, k.slug).toMatchObject({ headline: k.title, description: k.summary, datePublished: k.publishedAt, url: `${UNIFORM_URL}${detail(k)}` });
    expect(ld).toHaveProperty('publisher');
    expect(ld).not.toHaveProperty('offers');
  }

  const index = await jsonLdOf(page, '/kabar/');
  const collection = index.find((x) => x['@type'] === 'CollectionPage')!;
  const list = collection.mainEntity as { '@type': string; numberOfItems: number; itemListElement: { url: string }[] };
  expect(list['@type']).toBe('ItemList');
  expect(list.numberOfItems).toBe(PUBLISHED.length);
  expect(list.itemListElement.map((i) => i.url)).not.toContain(`${UNIFORM_URL}${detail(K.draf)}`);
  expect(index.map((x) => x['@type'])).toContain('BreadcrumbList');
});

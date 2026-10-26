import { expect, type Locator, type Page } from '@playwright/test';
import { E2E_BOGOR_ONLY, E2E_BRANCHES, E2E_CIBUBUR_PRICE } from './fixtures/content';
import { expectNoHorizontalScroll, test } from './helpers';

/**
 * Harga per cabang di Daftar Harga (data uji e2e/fixtures/content.ts), 360 px & desktop:
 * (a) build varian "uniform" (:8788): harga sama di semua cabang → pemilih tersembunyi, "Berlaku di semua cabang";
 * (b) build bawaan: Black Grooming Uji berbeda di Cibubur → pemilih tampil, sinkron dua arah dengan navbar;
 * (c) Hanya Bogor Uji tersembunyi saat Cibubur dipilih dan di /cabang/cibubur/ (juga di HTML statis).
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const { bogor, cibubur } = E2E_BRANCHES;
const UNIFORM_URL = 'http://localhost:8788';

const harga = (page: Page) => page.locator('#harga');
const picker = (page: Page) => harga(page).getByRole('group', { name: 'Pilih cabang untuk melihat harga' });
const row = (section: Locator, name: string) => section.locator('li', { hasText: name }).first();

async function openPrices(page: Page, url = '/') {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(harga(page)).toBeAttached({ timeout: 20_000 });
  await harga(page).scrollIntoViewIfNeeded();
  await expect(harga(page).getByRole('heading', { level: 2 })).toBeVisible();
}

/**
 * Tombol cabang navbar. Desktop: di navbar (aria-label menyebut cabang terpilih). HP < 480 px: di menu hamburger
 * (teksnya menyebut cabang terpilih); menu dibuka dulu.
 */
async function navbarBranch(page: Page, isMobile: boolean): Promise<Locator> {
  // Navbar sembunyi saat menggulir ke bawah: kembali ke atas (seperti pengunjung) agar navbar tampil
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('header').first()).toBeInViewport();
  await page.waitForTimeout(300);
  if (!isMobile) return page.locator('header button[aria-label^="Cabang pilihanmu"], header button[aria-label="Pilih Cabang"]');
  const menu = page.locator('#mobile-menu');
  if (await menu.isHidden()) await page.getByRole('button', { name: 'Buka menu' }).click();
  return menu.getByRole('button').first();
}
const navbarShows = async (page: Page, isMobile: boolean, name: string) => {
  const btn = await navbarBranch(page, isMobile);
  if (isMobile) {
    await expect(btn).toContainText(name);
    await page.getByRole('button', { name: 'Tutup menu' }).click();
  } else await expect(btn).toHaveAttribute('aria-label', new RegExp(name));
};

/** Pilih cabang lewat navbar: tombol cabang → kota → cabang */
async function chooseInNavbar(page: Page, isMobile: boolean, city: string, name: string) {
  await (await navbarBranch(page, isMobile)).click();
  const dialog = page.getByRole('dialog', { name: 'Pilih cabang' });
  await dialog.getByRole('button', { name: new RegExp(city) }).first().click();
  await dialog.getByRole('button', { name: new RegExp(`^${name}`) }).last().click();
  await expect(dialog).toHaveCount(0);
}

test('(a) harga sama di semua cabang: pemilih tersembunyi, label "Berlaku di semua cabang"', async ({ page, isMobile }) => {
  await openPrices(page, `${UNIFORM_URL}/`);
  const section = harga(page);
  await expect(section.getByText('Berlaku di semua cabang')).toBeVisible();
  await expect(picker(page)).toHaveCount(0);
  await expect(row(section, E2E_CIBUBUR_PRICE.name)).toContainText(E2E_CIBUBUR_PRICE.base);
  await expect(row(section, E2E_BOGOR_ONLY)).toBeVisible();
  // Memilih cabang di navbar tidak memunculkan pemilih (harga tetap sama)
  await chooseInNavbar(page, isMobile, cibubur.city, cibubur.name);
  await expect(section.getByText('Berlaku di semua cabang')).toBeVisible();
  await expect(picker(page)).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

test('(b) harga berbeda di Cibubur: pemilih tampil, sinkron dua arah dengan navbar, harga berpindah', async ({ page, isMobile }) => {
  await openPrices(page);
  const section = harga(page);
  const group = picker(page);
  // Belum memilih cabang → cabang Aktif pertama
  await expect(group).toBeVisible();
  await expect(group.getByRole('button')).toHaveText([bogor.name, cibubur.name]);
  await expect(group.getByRole('button', { name: bogor.name })).toHaveAttribute('aria-pressed', 'true');
  await expect(section.getByText(`Harga cabang ${bogor.name}`)).toBeVisible();
  await expect(row(section, E2E_CIBUBUR_PRICE.name)).toContainText(E2E_CIBUBUR_PRICE.base);

  // Pemilih → navbar
  await group.getByRole('button', { name: cibubur.name }).click();
  await expect(group.getByRole('button', { name: cibubur.name })).toHaveAttribute('aria-pressed', 'true');
  await expect(section.getByText(`Harga cabang ${cibubur.name}`)).toBeVisible();
  await expect(row(section, E2E_CIBUBUR_PRICE.name)).toContainText(E2E_CIBUBUR_PRICE.shown);
  await expect(row(section, E2E_CIBUBUR_PRICE.name)).not.toContainText(E2E_CIBUBUR_PRICE.base);
  await navbarShows(page, isMobile, cibubur.name);
  expect(await page.evaluate(() => localStorage.getItem('cutless:branch'))).toBe(cibubur.slug);

  // Navbar → pemilih
  await chooseInNavbar(page, isMobile, bogor.city, bogor.name);
  await expect(group.getByRole('button', { name: bogor.name })).toHaveAttribute('aria-pressed', 'true');
  await expect(row(section, E2E_CIBUBUR_PRICE.name)).toContainText(E2E_CIBUBUR_PRICE.base);
  await expectNoHorizontalScroll(page);
});

test('(c) layanan hanya di Bogor: tersembunyi saat Cibubur dipilih dan di /cabang/cibubur/ (juga HTML statis)', async ({ page, request }) => {
  await openPrices(page);
  const section = harga(page);
  await expect(row(section, E2E_BOGOR_ONLY)).toBeVisible();
  await picker(page).getByRole('button', { name: cibubur.name }).click();
  await expect(section.getByText(`Harga cabang ${cibubur.name}`)).toBeVisible();
  await expect(section.locator('li', { hasText: E2E_BOGOR_ONLY })).toHaveCount(0);

  // Halaman cabang: harga cabang itu saja, tanpa pemilih
  await openPrices(page, `/cabang/${cibubur.slug}/`);
  await expect(harga(page).getByText(`Harga cabang ${cibubur.name}`)).toBeVisible();
  await expect(picker(page)).toHaveCount(0);
  await expect(harga(page).locator('li', { hasText: E2E_BOGOR_ONLY })).toHaveCount(0);
  await expect(row(harga(page), E2E_CIBUBUR_PRICE.name)).toContainText(E2E_CIBUBUR_PRICE.shown);
  await openPrices(page, `/cabang/${bogor.slug}/`);
  await expect(picker(page)).toHaveCount(0);
  await expect(row(harga(page), E2E_BOGOR_ONLY)).toBeVisible();

  // HTML statis (prerender) & JSON-LD priceRange per cabang
  const html = async (slug: string) => (await request.get(`/cabang/${slug}/`)).text();
  const cibuburHtml = await html(cibubur.slug);
  expect(cibuburHtml).toContain(`<p>Harga cabang ${cibubur.name}</p>`);
  expect(cibuburHtml).toContain(`<li><span>${E2E_CIBUBUR_PRICE.name}</span> <span>${E2E_CIBUBUR_PRICE.shown}</span></li>`);
  expect(cibuburHtml).not.toContain(E2E_BOGOR_ONLY);
  expect(cibuburHtml).toMatch(/"priceRange":"Rp\d[\d.]* - Rp\d[\d.]*"/);
  expect(await html(bogor.slug)).toContain(`<li><span>${E2E_BOGOR_ONLY}</span> <span>120K</span></li>`);
});

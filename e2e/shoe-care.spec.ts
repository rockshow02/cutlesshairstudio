import { expect, type Locator, type Page } from '@playwright/test';
import { E2E_BRANCHES, E2E_SHOE_CARE } from './fixtures/content';
import { expectNoHorizontalScroll, parseWa, test } from './helpers';

/**
 * Partner Cuci Sepatu (data uji e2e/fixtures/content.ts, bukan data CMS) di 360 px & desktop: section tampil setelah
 * Daftar Harga, tombol layanan → wa.me partner dengan pesan benar, catatan bila cabang lain dipilih, hanya di halaman
 * cabang partner, menu HP & footer, meta description cabang.
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const { bogor, cibubur } = E2E_BRANCHES;
const SECTION = '#cuci-sepatu';

/** Gulir ke elemen. Desktop memakai roda mouse (smooth scroll Lenis tidak mengikuti lompatan scroll native di CI). */
async function scrollTo(page: Page, target: Locator, isMobile: boolean) {
  await expect(target).toBeAttached({ timeout: 20_000 });
  if (isMobile) return target.scrollIntoViewIfNeeded();
  const vp = page.viewportSize()!;
  await page.mouse.move(vp.width / 2, vp.height / 2);
  for (let i = 0; i < 80; i++) {
    const top = await target.evaluate((el) => el.getBoundingClientRect().top);
    if (top > vp.height * 0.15 && top < vp.height * 0.55) break;
    await page.mouse.wheel(0, Math.max(-700, Math.min(700, top - vp.height * 0.35)));
    await page.waitForTimeout(150);
  }
  await page.mouse.move(5, 5);
}

/** Tombol WhatsApp melayang yang terlihat menimpa elemen? */
const fabOverlaps = (button: Locator) =>
  button.evaluate((btn) => {
    const b = btn.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLAnchorElement>('a[href^="https://wa.me/"]')].some((el) => {
      const s = getComputedStyle(el);
      if (el === btn || s.position !== 'fixed' || s.visibility === 'hidden' || s.opacity === '0' || el.hasAttribute('data-hidden')) return false;
      const f = el.getBoundingClientRect();
      return !(b.right < f.left || b.left > f.right || b.bottom < f.top || b.top > f.bottom);
    });
  });

test('beranda: section tampil setelah Daftar Harga, tombol layanan → WhatsApp partner dengan pesan benar', async ({ page, context, isMobile, apiCalls }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const section = page.locator(SECTION);
  await scrollTo(page, section, isMobile);
  await expect(section.getByRole('heading', { level: 2, name: E2E_SHOE_CARE.name })).toBeVisible();
  // Urutan: tepat setelah Daftar Harga (#harga), sebelum Hairstylist
  expect(await section.evaluate((el) => [el.previousElementSibling?.id, el.nextElementSibling?.id])).toEqual(['harga', 'hairstylist']);
  await expect(section.getByText(`Tersedia di ${bogor.name}`)).toBeVisible();
  await expect(section.getByText('hanya tersedia di cabang')).toHaveCount(0);

  // Kartu layanan: nama, harga Rupiah tanpa desimal ("mulai" bila diatur), estimasi
  const cards = section.locator('article');
  await expect(cards).toHaveCount(E2E_SHOE_CARE.services.length);
  await expect(cards.first()).toContainText(/mulai Rp\s45\.000/);
  await expect(cards.nth(1)).toContainText(/Rp\s30\.000/);
  await expect(cards.nth(1)).not.toContainText('mulai');
  await expect(cards.first()).toContainText('±2 hari');

  for (const s of E2E_SHOE_CARE.services) {
    const href = await section.getByRole('link', { name: `Pesan via WhatsApp: ${s.name}` }).getAttribute('href');
    const msg = parseWa(href!);
    expect(msg.number).toBe(E2E_SHOE_CARE.whatsappNumber);
    expect(msg.text).toBe(`Halo, saya mau pesan ${s.name} di Cutless Hair Studio cabang ${bogor.name}. (via website Cutless)`);
  }
  // Klik sungguhan membuka tab wa.me
  const first = section.getByRole('link', { name: `Pesan via WhatsApp: ${E2E_SHOE_CARE.services[0].name}` });
  await scrollTo(page, first, isMobile);
  await page.waitForTimeout(400);
  expect(await fabOverlaps(first), 'tombol WA melayang menutupi tombol pesan').toBe(false);
  const popup = context.waitForEvent('page');
  await first.click();
  expect(parseWa((await popup).url()).text).toContain(E2E_SHOE_CARE.services[0].name);

  // Tombol utama: pesan umum
  const main = section.getByRole('link', { name: 'Titip Sepatu via WhatsApp' });
  const mainWa = parseWa((await main.getAttribute('href'))!);
  expect(mainWa.number).toBe(E2E_SHOE_CARE.whatsappNumber);
  expect(mainWa.text).toContain('pesan layanan cuci sepatu di');
  await scrollTo(page, main, isMobile);
  await page.waitForTimeout(400);
  expect(await fabOverlaps(main), 'tombol WA melayang menutupi tombol utama').toBe(false);

  // Galeri (ada foto) & catatan
  await expect(section.getByRole('img', { name: 'Foto hasil uji satu' })).toBeAttached();
  await expect(section.getByText('Catatan uji pertama.')).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(apiCalls).toEqual([]);
});

test('cabang lain dipilih: section tetap tampil dengan catatan, WhatsApp tetap ke partner', async ({ page, isMobile }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((slug) => localStorage.setItem('cutless:branch', slug), cibubur.slug);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const section = page.locator(SECTION);
  await scrollTo(page, section, isMobile);
  await expect(section.getByText(`Layanan cuci sepatu hanya tersedia di cabang ${bogor.name}`)).toBeVisible();
  const href = await section.getByRole('link', { name: 'Titip Sepatu via WhatsApp' }).getAttribute('href');
  expect(parseWa(href!).number).toBe(E2E_SHOE_CARE.whatsappNumber);
  expect(parseWa(href!).text).toContain(`cabang ${bogor.name}`);
  await expectNoHorizontalScroll(page);
});

test('halaman cabang: tampil di cabang partner, tidak di cabang lain; meta description cabang partner', async ({ page, request }) => {
  await page.goto(`/cabang/${bogor.slug}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator(SECTION)).toBeAttached({ timeout: 20_000 });
  await page.goto(`/cabang/${cibubur.slug}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#harga')).toBeAttached({ timeout: 20_000 });
  await expect(page.locator(SECTION)).toHaveCount(0);

  const meta = async (slug: string) => (await (await request.get(`/cabang/${slug}/`)).text()).match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  expect(await meta(bogor.slug)).toContain('cuci sepatu');
  expect(await meta(cibubur.slug)).not.toContain('cuci sepatu');
  // Beranda tidak menyebut
  expect(((await (await request.get('/')).text()).match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '')).not.toContain('cuci sepatu');
});

test('navigasi: "Cuci Sepatu" di menu HP & footer, tidak di navbar desktop', async ({ page, isMobile }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('header').getByRole('navigation', { name: 'Menu utama' }).getByRole('link', { name: 'Cuci Sepatu' })).toHaveCount(0);
  if (isMobile) {
    await page.getByRole('button', { name: 'Buka menu' }).click();
    const link = page.getByRole('navigation', { name: 'Menu utama' }).getByRole('link', { name: 'Cuci Sepatu' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /#cuci-sepatu$/);
  }
  const footer = page.locator('footer');
  await expect(footer).toBeAttached({ timeout: 20_000 });
  await expect(footer.getByRole('link', { name: 'Cuci Sepatu' })).toHaveAttribute('href', /#cuci-sepatu$/);
});

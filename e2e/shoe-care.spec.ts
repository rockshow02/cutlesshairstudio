import { expect, type Locator, type Page } from '@playwright/test';
import { E2E_BRANCHES, E2E_SHOE_CARE } from './fixtures/content';
import { expectNoHorizontalScroll, parseWa, test } from './helpers';

/**
 * Halaman /cuci-sepatu/ & teaser (data uji e2e/fixtures/content.ts, bukan data CMS) di 360 px & desktop: buka langsung
 * (+ refresh), dari teaser & anchor lama, hero/About/layanan/galeri + lightbox, tombol daftar menu, tombol layanan →
 * wa.me partner, tanpa scroll horizontal, tombol WA melayang tidak menutupi tombol pesan, menu & meta.
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const { bogor, cibubur } = E2E_BRANCHES;
const PAGE = '/cuci-sepatu/';

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

test('buka /cuci-sepatu langsung & refresh: HTML statis, hero, About, layanan, galeri + lightbox, daftar menu', async ({ page, request, context, isMobile, apiCalls }) => {
  for (const path of [PAGE, '/cuci-sepatu']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    const html = await res.text();
    expect(html).toContain(`<title>[STAGING] Cuci Sepatu ${E2E_SHOE_CARE.name} di Cutless ${bogor.name}</title>`);
    expect(html).toMatch(/<meta name="description" content="Tagline uji cuci sepatu\. Layanan: Deep Clean Uji, Fast Clean Uji, dan Unyellowing Uji\." \/>/);
    expect(html).toMatch(/<meta property="og:image" content="[^"]+\.(webp|jpe?g|png)"/);
  }
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });

  // Hero
  await expect(page.getByRole('heading', { level: 1, name: E2E_SHOE_CARE.name })).toBeVisible();
  await expect(page.getByText(`Tersedia di ${bogor.name}`).first()).toBeVisible();
  const hero = page.locator('#top');
  const main = hero.getByRole('link', { name: 'Titip Sepatu via WhatsApp' });
  expect(parseWa((await main.getAttribute('href'))!)).toEqual({
    number: E2E_SHOE_CARE.whatsappNumber,
    text: `Halo ${E2E_SHOE_CARE.name}, saya mau pesan layanan cuci sepatu di Cutless Hair Studio cabang ${bogor.name}. (via website Cutless)`,
  });
  const menu = hero.getByRole('link', { name: 'Lihat Daftar Menu' });
  await expect(menu).toHaveAttribute('href', E2E_SHOE_CARE.menuUrl);
  await expect(menu).toHaveAttribute('target', '_blank');
  await expect(menu).toHaveAttribute('rel', 'noopener noreferrer');

  // About Us
  await expect(page.locator('#tentang')).toContainText('Paragraf About Us uji pertama.');

  // Layanan: tanpa harga, tombol per layanan ke wa.me partner
  const services = page.locator('#layanan');
  await expect(services.locator('article')).toHaveCount(E2E_SHOE_CARE.services.length);
  await expect(services).not.toContainText(/Rp\s?\d|mulai/);
  await expect(services.getByRole('link', { name: 'Lihat Daftar Menu' })).toHaveAttribute('href', E2E_SHOE_CARE.menuUrl);
  for (const s of E2E_SHOE_CARE.services) {
    const href = await services.getByRole('link', { name: `Pesan via WhatsApp: ${s.name}` }).getAttribute('href');
    expect(parseWa(href!)).toEqual({
      number: E2E_SHOE_CARE.whatsappNumber,
      text: `Halo ${E2E_SHOE_CARE.name}, saya mau pesan ${s.name} di Cutless Hair Studio cabang ${bogor.name}. (via website Cutless)`,
    });
  }
  const order = services.getByRole('link', { name: `Pesan via WhatsApp: ${E2E_SHOE_CARE.services[0].name}` });
  await scrollTo(page, order, isMobile);
  await page.waitForTimeout(400);
  expect(await fabOverlaps(order), 'tombol WA melayang menutupi tombol pesan').toBe(false);
  const popup = context.waitForEvent('page');
  await order.click();
  expect(parseWa((await popup).url()).text).toContain(E2E_SHOE_CARE.services[0].name);

  // Galeri + lightbox: klik untuk memperbesar, Esc menutup, panah berganti foto, fokus kembali
  const thumb = page.getByRole('button', { name: 'Perbesar foto: Foto hasil uji satu' });
  await scrollTo(page, thumb, isMobile);
  await thumb.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Tutup' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(dialog).toHaveAttribute('aria-label', 'Foto hasil uji dua');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(thumb).toBeFocused();
  await thumb.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Tutup' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Catatan, CTA penutup, lokasi
  await expect(page.locator('#titip')).toContainText('Catatan uji pertama.');
  await expect(page.locator('#lokasi').getByRole('link', { name: 'Petunjuk Arah' })).toBeAttached();
  await expectNoHorizontalScroll(page);
  expect(apiCalls).toEqual([]);
});

test('teaser beranda → /cuci-sepatu; anchor lama #cuci-sepatu → halaman; menu HP & footer', async ({ page, isMobile }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const teaser = page.locator('#cuci-sepatu-teaser');
  await scrollTo(page, teaser, isMobile);
  // Tepat setelah Daftar Harga, tanpa tombol WhatsApp (hanya ringkasan)
  expect(await teaser.evaluate((el) => el.previousElementSibling?.id)).toBe('harga');
  await expect(teaser.getByRole('heading', { name: E2E_SHOE_CARE.name })).toBeVisible();
  await expect(teaser).toContainText('Tagline uji cuci sepatu.');
  await expect(teaser.locator('a[href^="https://wa.me/"]')).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await teaser.getByRole('link', { name: /Lihat Layanan/ }).click();
  await expect(page).toHaveURL(/\/cuci-sepatu\/$/);
  await expect(page.getByRole('heading', { level: 1, name: E2E_SHOE_CARE.name })).toBeVisible();

  // Anchor lama
  await page.goto('/#cuci-sepatu', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/cuci-sepatu\/$/, { timeout: 20_000 });

  // Navbar desktop tidak menampilkan; menu HP & footer ke /cuci-sepatu/
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('header').getByRole('navigation', { name: 'Menu utama' }).getByRole('link', { name: 'Cuci Sepatu' })).toHaveCount(0);
  if (isMobile) {
    await page.getByRole('button', { name: 'Buka menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Menu utama' }).getByRole('link', { name: 'Cuci Sepatu' })).toHaveAttribute('href', /\/cuci-sepatu\/$/);
    await page.getByRole('button', { name: 'Tutup menu' }).click();
  }
  const footer = page.locator('footer');
  await expect(footer).toBeAttached({ timeout: 20_000 });
  await expect(footer.getByRole('link', { name: 'Cuci Sepatu' })).toHaveAttribute('href', /\/cuci-sepatu\/$/);
});

test('halaman cabang: teaser hanya di cabang partner; meta description cabang partner menyebut cuci sepatu', async ({ page, request }) => {
  await page.goto(`/cabang/${bogor.slug}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#cuci-sepatu-teaser')).toBeAttached({ timeout: 20_000 });
  await page.goto(`/cabang/${cibubur.slug}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#harga')).toBeAttached({ timeout: 20_000 });
  await expect(page.locator('#cuci-sepatu-teaser')).toHaveCount(0);

  const meta = async (path: string) => (await (await request.get(path)).text()).match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  expect(await meta(`/cabang/${bogor.slug}/`)).toContain('cuci sepatu');
  expect(await meta(`/cabang/${cibubur.slug}/`)).not.toContain('cuci sepatu');
  expect(await meta('/')).not.toContain('cuci sepatu');
  expect((await (await request.get('/sitemap.xml')).text())).toContain('/cuci-sepatu/');
});

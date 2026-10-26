import { expect, type Page } from '@playwright/test';
import { E2E_VIDEOS } from './fixtures/content';
import { expectNoHorizontalScroll, test } from './helpers';

/**
 * Bagian Video (data uji e2e/fixtures/content.ts), 360 px & desktop. Semua request ke Instagram di-mock: embed.js
 * tiruan mengganti <blockquote class="instagram-media"> dengan iframe, seperti skrip aslinya.
 * - build bawaan (Tampilkan bagian Video aktif): facade (sampul + tombol putar), tanpa request Instagram sampai kartu
 *   ditekan; klik memuat embed.js sekali; bingkai tidak berubah ukuran; embed diblokir → pesan + link cadangan;
 * - varian uniform (mati): bagian & HTML statis tidak ada.
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const UNIFORM_URL = 'http://localhost:8788';
const EMBED_JS = 'https://www.instagram.com/embed.js';

const MOCK_EMBED_JS = `window.instgrm = { Embeds: { process() {
  document.querySelectorAll('blockquote.instagram-media').forEach((q) => {
    const f = document.createElement('iframe');
    f.className = 'instagram-media instagram-media-rendered';
    f.src = q.dataset.instgrmPermalink + 'embed/';
    f.title = 'embed uji';
    f.style.height = '900px';
    q.replaceWith(f);
  });
} } };`;

/** Catat request ke Instagram; embed.js = tiruan (atau diblokir), lainnya halaman kosong */
async function mockInstagram(page: Page, opts: { block?: boolean } = {}) {
  const requests: string[] = [];
  await page.route(/instagram\.com|cdninstagram\.com/, (route) => {
    const url = route.request().url();
    requests.push(url);
    if (url.startsWith(EMBED_JS)) return opts.block ? route.abort() : route.fulfill({ contentType: 'application/javascript', body: MOCK_EMBED_JS });
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>embed uji</title><p>embed uji</p>' });
  });
  return requests;
}

async function openVideos(page: Page, base = '') {
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#lokasi')).toBeAttached({ timeout: 20_000 });
  const section = page.locator('#video');
  await expect(section).toBeAttached();
  await section.scrollIntoViewIfNeeded();
  return section;
}

test('facade: sampul + tombol putar berlabel, urut Urutan, link dirapikan; tanpa request Instagram sebelum diklik', async ({ page, request }) => {
  const requests = await mockInstagram(page);
  const section = await openVideos(page);
  expect(await section.evaluate((el) => el.previousElementSibling?.id)).toBe('galeri');
  await expect(section.getByRole('heading', { level: 2, name: E2E_VIDEOS.title })).toBeVisible();

  const buttons = section.getByRole('button', { name: /^Putar video:/ });
  await expect(buttons).toHaveCount(E2E_VIDEOS.shown.length);
  for (const [i, v] of E2E_VIDEOS.shown.entries()) {
    await expect(buttons.nth(i)).toHaveAccessibleName(`Putar video: ${v.caption}`);
    const card = section.locator('li').nth(i);
    await expect(card.locator('img')).toHaveJSProperty('complete', true);
    // Link cadangan: parameter ?igsh=... dibuang
    await expect(card.getByRole('link', { name: `Tonton di Instagram (${v.caption})` })).toHaveAttribute('href', v.url);
  }
  await expect(section).not.toContainText(E2E_VIDEOS.hidden);

  // Kartu 9:16
  const box = (await section.locator('[data-status]').first().boundingBox())!;
  expect(box.height / box.width).toBeCloseTo(16 / 9, 1);
  await expectNoHorizontalScroll(page);

  // Tidak ada skrip / iframe / request Instagram di muat awal (termasuk setelah digulir ke bagian Video)
  await page.waitForTimeout(500);
  expect(requests).toEqual([]);
  expect(await page.locator('script[src*="instagram.com"], iframe[src*="instagram.com"]').count()).toBe(0);

  // HTML statis: judul & keterangan yang terlihat
  const html = await (await request.get('/')).text();
  expect(html).toContain(`<h2>${E2E_VIDEOS.title}</h2>`);
  for (const v of E2E_VIDEOS.shown) expect(html).toContain(`<p>${v.caption}</p><a href="${v.url}">Tonton di Instagram</a>`);
  expect(html).not.toContain(E2E_VIDEOS.hidden);
  expect(html).not.toContain(EMBED_JS);
});

test('klik → embed.js dimuat sekali, embed menggantikan kartu itu di bingkai yang sama (tanpa layout shift)', async ({ page }) => {
  const requests = await mockInstagram(page);
  const section = await openVideos(page);
  const frames = section.locator('[data-status]');
  const before = (await frames.first().boundingBox())!;
  const nextTop = (await section.locator('figcaption').first().boundingBox())!.y;

  await section.getByRole('button', { name: `Putar video: ${E2E_VIDEOS.shown[0].caption}` }).click();
  const iframe = frames.first().locator('iframe.instagram-media');
  await expect(iframe).toHaveAttribute('src', `${E2E_VIDEOS.shown[0].url}embed/`);
  await expect(frames.first()).toHaveAttribute('data-status', 'ready');
  // Fokus pindah ke bingkai video (tombol sudah diganti)
  await expect(frames.first()).toBeFocused();
  await expect(frames.first()).toHaveAccessibleName(E2E_VIDEOS.shown[0].caption);
  // Ukuran bingkai & posisi keterangan di bawahnya tidak berubah walau embed lebih tinggi (digulir di dalam bingkai)
  const after = (await frames.first().boundingBox())!;
  expect([after.width, after.height]).toEqual([before.width, before.height]);
  expect((await section.locator('figcaption').first().boundingBox())!.y).toBe(nextTop);
  // Kartu lain tetap facade
  await expect(frames.nth(1)).toHaveAttribute('data-status', 'idle');

  // Kartu kedua lewat keyboard: skrip tidak dimuat ulang
  const second = section.getByRole('button', { name: `Putar video: ${E2E_VIDEOS.shown[1].caption}` });
  await second.focus();
  await page.keyboard.press('Enter');
  await expect(frames.nth(1).locator('iframe.instagram-media')).toHaveAttribute('src', `${E2E_VIDEOS.shown[1].url}embed/`);
  expect(requests.filter((u) => u.startsWith(EMBED_JS))).toHaveLength(1);
});

test('embed diblokir → pesan & link "Tonton di Instagram" tetap bisa dipakai', async ({ page }) => {
  await mockInstagram(page, { block: true });
  const section = await openVideos(page);
  await section.getByRole('button', { name: `Putar video: ${E2E_VIDEOS.shown[0].caption}` }).click();
  const frame = section.locator('[data-status]').first();
  await expect(frame).toHaveAttribute('data-status', 'failed');
  await expect(frame.getByRole('status')).toHaveText('Video tidak bisa dimuat di sini.');
  await expect(section.locator('li').first().getByRole('link', { name: /Tonton di Instagram/ })).toBeVisible();
  await expect(section.locator('li').first().getByRole('link', { name: /Tonton di Instagram/ })).toHaveAttribute('href', E2E_VIDEOS.shown[0].url);
});

test('tata letak: HP satu kartu + kartu berikutnya mengintip (geser), desktop 3 kolom', async ({ page }, testInfo) => {
  await mockInstagram(page);
  const section = await openVideos(page);
  const [a, b] = await Promise.all([0, 1].map(async (i) => (await section.locator('li').nth(i).boundingBox())!));
  const list = (await section.locator('ul').boundingBox())!;
  if (testInfo.project.name === 'hp') {
    // Berdampingan dalam deret yang bisa digeser; kartu kedua terpotong di tepi kanan
    expect(b.y).toBe(a.y);
    expect(a.width).toBeLessThan(list.width);
    expect(b.x + b.width).toBeGreaterThan(list.x + list.width);
    expect(await section.locator('ul').evaluate((el) => el.scrollWidth > el.clientWidth && getComputedStyle(el).overflowX)).toBe('auto');
  } else {
    expect(b.y).toBe(a.y);
    const gap = await section.locator('ul').evaluate((el) => parseFloat(getComputedStyle(el).columnGap));
    expect(b.x).toBeCloseTo(a.x + a.width + gap, 0);
    expect(a.width).toBeCloseTo((list.width - 2 * gap) / 3, 0);
  }
  await expectNoHorizontalScroll(page);
});

test('Tampilkan bagian Video mati (varian uniform): bagian & HTML statis tidak ada', async ({ page, request }) => {
  const requests = await mockInstagram(page);
  await page.goto(`${UNIFORM_URL}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#lokasi')).toBeAttached({ timeout: 20_000 });
  await expect(page.locator('#galeri')).toBeAttached();
  await expect(page.locator('#video')).toHaveCount(0);
  const html = await (await request.get(`${UNIFORM_URL}/`)).text();
  expect(html).not.toContain(E2E_VIDEOS.title);
  expect(html).not.toContain('instagram.com/reel/');
  expect(requests).toEqual([]);
});

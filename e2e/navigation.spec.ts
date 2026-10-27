import { expect, type Page } from '@playwright/test';
import { test } from './helpers';

/**
 * Navigasi desktop dengan smooth scroll (Lenis) aktif: setiap link navbar dan URL ber-hash mendarat di section yang
 * benar (tepi atas section tepat di bawah navbar, toleransi kecil), tidak terlempar ke section lain oleh snap.
 */
test.use({ contextOptions: { reducedMotion: 'no-preference' } });

const TARGETS = [
  { label: 'Layanan', id: 'layanan' },
  { label: 'Harga', id: 'harga' },
  { label: 'Hairstylist', id: 'hairstylist' },
  { label: 'Galeri', id: 'galeri' },
  { label: 'Lokasi', id: 'lokasi' },
  { label: 'Kontak', id: 'kontak' },
];

/** Tunggu gulir dimulai (bila perlu) lalu selesai (posisi stabil), lalu ukur posisi section terhadap navbar */
async function settled(page: Page, id: string, from?: number) {
  if (from !== undefined) {
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY)), { timeout: 3_000 }).not.toBe(from).catch(() => undefined);
  }
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const y = await page.evaluate(() => Math.round(window.scrollY));
    if (y === last) break;
    last = y;
    await page.waitForTimeout(250);
  }
  return page.evaluate((sectionId) => {
    const el = document.getElementById(sectionId)!;
    const top = el.getBoundingClientRect().top;
    // --header-offset = calc(tinggi navbar + bar pengumuman): ukur lewat elemen bantu (parseFloat tidak bisa membaca calc)
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--header-offset)';
    document.body.appendChild(probe);
    const header = probe.getBoundingClientRect().height;
    probe.remove();
    const atBottom = Math.ceil(window.scrollY + innerHeight) >= document.documentElement.scrollHeight - 2;
    return { top: Math.round(top), header, atBottom, lenis: document.documentElement.classList.contains('lenis') };
  }, id);
}

test('link navbar desktop mendarat di section yang benar (smooth scroll aktif)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'navbar desktop');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // Semua section dirender (Deferred) & Lenis aktif
  await expect(page.locator('#kontak')).toBeAttached({ timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('lenis')), { timeout: 15_000 }).toBe(true);
  // Animasi pembuka selesai (elemen preloader dilepas dari DOM; selama itu smooth scroll belum menerima klik)
  await expect(page.locator('[class*="_preloader_"]')).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(500);
  const nav = page.locator('header').getByRole('navigation', { name: 'Menu utama' });
  for (const t of TARGETS) {
    const link = nav.getByRole('link', { name: t.label, exact: true });
    // Navbar otomatis sembunyi saat menggulir ke bawah: gulir sedikit ke atas (seperti pengunjung) sampai muncul lagi
    await page.mouse.move(640, 450);
    await expect(async () => {
      await page.mouse.wheel(0, -120);
      await expect(link).toBeInViewport({ timeout: 600 });
    }).toPass({ timeout: 10_000 });
    const before = await page.evaluate(() => Math.round(window.scrollY));
    await link.click();
    const r = await settled(page, t.id, before);
    // Footer (Kontak) di dasar halaman: cukup terlihat penuh di layar
    if (t.id === 'kontak' || r.atBottom) expect(r.top, t.label).toBeLessThan(await page.evaluate(() => innerHeight));
    else expect(Math.abs(r.top - r.header), `${t.label}: tepi atas section ${r.top}px, navbar ${r.header}px`).toBeLessThanOrEqual(24);
  }
});

test('URL dengan hash (/#harga, dll.) mendarat di section yang benar', async ({ page, isMobile }) => {
  test.skip(isMobile, 'smooth scroll Lenis hanya desktop');
  for (const t of TARGETS.filter((x) => x.id !== 'kontak')) {
    await page.goto(`/#${t.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator(`#${t.id}`)).toBeAttached({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    const r = await settled(page, t.id);
    if (r.atBottom) expect(r.top, t.id).toBeLessThan(await page.evaluate(() => innerHeight));
    else expect(Math.abs(r.top - r.header), `/#${t.id}: tepi atas section ${r.top}px, navbar ${r.header}px`).toBeLessThanOrEqual(24);
  }
});

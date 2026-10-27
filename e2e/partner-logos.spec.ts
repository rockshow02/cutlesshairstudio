import { expect, type Page } from '@playwright/test';
import { E2E_PARTNER_LABEL, E2E_PARTNERS, E2E_SITE_NAME } from './fixtures/content';
import { expectNoHorizontalScroll, test } from './helpers';

/**
 * Pita logo partner di beranda (data uji e2e/fixtures/content.ts, bukan data CMS) dan halaman /partner yang dicabut.
 * Default config: "kurangi gerakan" → deret statis yang bisa digeser; blok kedua menguji animasi.
 */
const fixtureBuild = !process.env.E2E_BASE_URL;
const STRIP = `section[aria-label="Partner ${E2E_SITE_NAME}"]`;

async function openStrip(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const strip = page.locator(STRIP);
  // Section bawah dirender setelah hero (Deferred): gulir sampai pita muncul
  await expect(async () => {
    await page.mouse.wheel(0, 2000);
    await expect(strip).toBeAttached({ timeout: 500 });
  }).toPass({ timeout: 20_000 });
  await strip.scrollIntoViewIfNeeded();
  await expect(strip).toBeVisible();
  return strip;
}

/** Nama partner pada salinan pertama (tanpa salinan aria-hidden) */
const visibleNames = (page: Page) =>
  page.locator(`${STRIP} li:not([aria-hidden])`).evaluateAll((lis) =>
    lis.filter((li) => !li.closest('[aria-hidden="true"]')).map((li) => li.querySelector('img')?.getAttribute('alt') ?? li.textContent?.trim()),
  );

test('/partner tidak lagi tersedia: diarahkan ke beranda, tanpa link Partner di footer & menu', async ({ page, isMobile }) => {
  for (const path of ['/partner', '/partner/']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(new URL(page.url()).pathname, path).toBe('/');
  }
  await expect(page.locator('a[href*="/partner"]')).toHaveCount(0);
  if (isMobile) {
    await page.getByRole('button', { name: 'Buka menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Menu utama' }).getByRole('link', { name: 'Partner', exact: true })).toHaveCount(0);
  }
});

test('pita logo: 5 partner uji tepat sebelum CTA penutup, statis & bisa digeser saat "kurangi gerakan"', async ({ page }) => {
  test.skip(!fixtureBuild, 'butuh build E2E (data uji)');
  const strip = await openStrip(page);
  await expect(strip).toHaveAttribute('data-partner-strip', 'static');
  expect(await visibleNames(page)).toEqual(E2E_PARTNERS.map((p) => p.name));
  await expect(strip.getByText(E2E_PARTNER_LABEL, { exact: true })).toBeVisible();

  // Tepat sebelum CTA penutup (#booking)
  const nextId = await strip.evaluate((el) => el.nextElementSibling?.id);
  expect(nextId).toBe('booking');

  // Logo: <img> alt = nama; tanpa logo: nama sebagai teks
  for (const p of E2E_PARTNERS) {
    if (p.withLogo) await expect(strip.getByRole('img', { name: p.name })).toHaveCount(1);
    else await expect(strip.getByText(p.name, { exact: true })).toBeVisible();
  }
  // Link https → tab baru
  const link = strip.locator('a[href="https://example.com/partner-satu"]');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');

  // Deret statis: tidak ada animasi; bila tidak muat, bisa digeser di dalam pita (halaman tidak ikut melebar)
  expect(await strip.locator('[style*="--marquee-duration"]').count()).toBe(0);
  await expectNoHorizontalScroll(page);
});

test.describe('animasi', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('pita logo berjalan (3+ logo), berhenti saat di-hover, tanpa scroll horizontal halaman', async ({ page, isMobile }) => {
    test.skip(!fixtureBuild, 'butuh build E2E (data uji)');
    const strip = await openStrip(page);
    await expect(strip).toHaveAttribute('data-partner-strip', 'marquee');
    expect(await visibleNames(page)).toEqual(E2E_PARTNERS.map((p) => p.name));
    const band = strip.locator('[data-axis="x"]');
    const track = band.locator('> div').first();
    const pos = () => track.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
    // Desktop memakai smooth scroll (Lenis) yang bisa masih bergulir: pastikan pita di layar (tidak dijeda
    // data-offscreen) lalu tunggu sampai pita bergerak
    // Desktop: smooth scroll Lenis tidak mengikuti lompatan scroll native (scrollIntoViewIfNeeded) di CI →
    // gulir dengan roda mouse seperti pengunjung sampai pita di tengah layar
    const viewport = page.viewportSize()!;
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    for (let i = 0; i < 80; i++) {
      const top = await strip.evaluate((el) => el.getBoundingClientRect().top);
      if (top > viewport.height * 0.2 && top < viewport.height * 0.6) break;
      await page.mouse.wheel(0, Math.max(-600, Math.min(600, top - viewport.height * 0.4)));
      await page.waitForTimeout(150);
    }
    await page.mouse.move(5, viewport.height - 5); // kursor di luar pita (hover menjeda)
    try {
      await expect(async () => {
        await expect(strip).toBeInViewport({ ratio: 0.9 });
        await expect(band).not.toHaveAttribute('data-offscreen', '');
        const a = await pos();
        await page.waitForTimeout(300);
        expect(await pos()).not.toBe(a);
      }).toPass({ timeout: 15_000 });
    } catch {
      // Diagnosis untuk CI (log job tidak terbaca tanpa login): kenapa pita tidak bergerak
      const diag = await band.evaluate((el) => {
        const t = el.firstElementChild as HTMLElement;
        const cs = getComputedStyle(t);
        const r = el.getBoundingClientRect();
        return {
          scrollY: Math.round(scrollY),
          innerHeight,
          rect: [Math.round(r.top), Math.round(r.bottom)],
          hover: el.matches(':hover'),
          attrs: Object.fromEntries([...el.attributes].map((a) => [a.name, a.value.slice(0, 40)])),
          anim: [cs.animationName, cs.animationPlayState, cs.animationDuration, cs.transform],
          visibility: document.visibilityState,
          html: document.documentElement.className,
          reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
        };
      });
      throw new Error(`pita logo tidak bergerak: ${JSON.stringify(diag)}`);
    }
    if (!isMobile) {
      await strip.locator('[data-axis="x"]').hover();
      await page.waitForTimeout(150);
      const b = await pos();
      await page.waitForTimeout(500);
      expect(await pos()).toBe(b);
    }
    // Tinggi pita stabil setelah logo dimuat (tanpa layout shift)
    const h1 = await strip.evaluate((el) => el.getBoundingClientRect().height);
    await page.waitForTimeout(800);
    expect(await strip.evaluate((el) => el.getBoundingClientRect().height)).toBe(h1);
    await expectNoHorizontalScroll(page);
  });
});

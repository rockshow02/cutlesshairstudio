import { expect, type BrowserContext } from '@playwright/test';
import { E2E_BRANCHES, E2E_KABAR, E2E_SERVICE_PAGES, E2E_TIPS } from './fixtures/content';
import { test } from './helpers';

/**
 * Overlay statis penutup ringkasan prerender (scripts/bootOverlay.ts, src/lib/bootOverlay.ts): teks `.prerender` (font sistem)
 * tidak boleh terlihat sebelum React siap, overlay dilepas setelah React mount, dan bila JavaScript gagal overlay memudar
 * sendiri (≤ 4 detik) sehingga teks tetap terbaca. Isi teks hero diambil dari DOM, bukan dari konstanta (isi CMS bisa berubah).
 * Tampil untuk semua halaman prerender; "enablePreloader mati" diuji di tests/boot-overlay.test.ts (fixture e2e: aktif).
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh build E2E (data uji)');

const UNIFORM_URL = 'http://localhost:8788';
const OVERLAY = '#boot-overlay';
const INK = [12, 16, 20]; // --c-ink (#0c1014)

/** Semua jenis halaman prerender: build bawaan (:8787) & varian uniform (:8788: produk, tips, layanan, kabar) */
const MAIN_PAGES = ['/', '/cabang/', ...Object.values(E2E_BRANCHES).map((b) => `/cabang/${b.slug}/`), '/cuci-sepatu/', '/kebijakan-privasi/'];
const UNIFORM_PAGES = [
  '/',
  '/produk/',
  '/tips/',
  `/tips/${E2E_TIPS.withToc.slug}/`,
  '/layanan/',
  `/layanan/${E2E_SERVICE_PAGES.haircut.slug}/`,
  '/kabar/',
  `/kabar/${E2E_KABAR.promoDua.slug}/`,
];

/** Selisih terbesar sebuah kanal warna piksel dari warna latar (PNG didekode di halaman kosong terpisah) */
async function maxDeviationFromInk(context: BrowserContext, png: Buffer): Promise<number> {
  const tool = await context.newPage();
  try {
    return await tool.evaluate(
      async ({ b64, ink }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let max = 0;
        for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) max = Math.max(max, Math.abs(d[i + c] - ink[c]));
        return max;
      },
      { b64: png.toString('base64'), ink: INK },
    );
  } finally {
    await tool.close();
  }
}

test.describe('HTML prerender memuat overlay di semua halaman', () => {
  const cases = [...MAIN_PAGES.map((p) => ({ base: '', p })), ...UNIFORM_PAGES.map((p) => ({ base: UNIFORM_URL, p }))];
  for (const { base, p } of cases) {
    test(`${base ? 'uniform ' : ''}${p}`, async ({ page }) => {
      const html = await (await page.request.get(`${base}${p}`)).text();
      expect(html.match(/id="boot-overlay"/g)).toHaveLength(1);
      expect(html.indexOf('id="boot-overlay"')).toBeLessThan(html.indexOf('id="root"'));
      expect(html).toContain('<style id="boot-overlay-css">');
      // Ringkasan prerender tetap di HTML (SEO/GEO) dan overlay tidak menambah <main>. /produk/ memang tanpa ringkasan (#root kosong)
      if (p !== '/produk/') expect(html).toMatch(/<div class="prerender">[\s\S]*<h1/);
      expect(html).not.toMatch(/<main[\s>]/);
    });
  }
});

test('teks prerender tertutup sejak paint pertama dan overlay dilepas setelah React mount', async ({ page, context }) => {
  // Tahan semua JavaScript: halaman tetap di keadaan "HTML prerender saja" (sama dengan jeda kunjungan pertama)
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/*.js', async (route) => {
    await gate;
    await route.continue();
  });
  // 'commit': skrip module (ditahan) menunda DOMContentLoaded, jadi jangan menunggunya
  await page.goto(`${UNIFORM_URL}/`, { waitUntil: 'commit' });
  const h1 = page.locator('.prerender h1');
  await expect(h1).toBeVisible();
  await expect(page.locator(OVERLAY)).toBeVisible();
  const heroText = (await h1.innerText()).trim();
  expect(heroText.length).toBeGreaterThan(0);

  // Screenshot awal: area judul hero prerender hanya berisi warna latar (tertutup overlay), tidak ada teksnya
  const box = (await h1.boundingBox())!;
  const clip = { x: box.x, y: box.y, width: Math.min(box.width, page.viewportSize()!.width - box.x), height: box.height };
  expect(await maxDeviationFromInk(context, await page.screenshot({ clip }))).toBeLessThanOrEqual(4);
  // Kontrol: tanpa overlay, area yang sama berisi teks (membuktikan pemeriksaan ini peka)
  const hide = await page.addStyleTag({ content: `${OVERLAY}{display:none!important}` });
  expect(await maxDeviationFromInk(context, await page.screenshot({ clip }))).toBeGreaterThan(60);
  await hide.evaluate((el) => el.remove());

  // React siap: overlay & ringkasan prerender diganti halaman sungguhan
  release();
  await expect(page.locator('.prerender')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator(OVERLAY)).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('main h1').first()).toBeVisible();
});

type Boot = { uncovered: number; covered: number; cls: number };
declare global {
  interface Window {
    __boot: Boot;
  }
}

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test.describe(`jaringan lambat (Slow 4G, CPU 4×, tanpa cache), gerakan: ${reducedMotion}`, () => {
    test.use({ reducedMotion });

    test('teks prerender tidak pernah terlihat tanpa tertutup; CLS < 0,005; overlay hilang setelah mount', async ({ page, context }) => {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.clearBrowserCache');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.addInitScript(() => {
        const boot: Boot = (window.__boot = { uncovered: 0, covered: 0, cls: 0 });
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) boot.cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        const covers = () => {
          const o = document.getElementById('boot-overlay');
          if (!o) return false;
          const cs = getComputedStyle(o);
          const r = o.getBoundingClientRect();
          return cs.visibility === 'visible' && parseFloat(cs.opacity) >= 0.98 && r.width >= innerWidth - 1 && r.height >= innerHeight - 1;
        };
        const tick = () => {
          const h1 = document.querySelector('.prerender h1');
          const r = h1?.getBoundingClientRect();
          if (r && r.height > 0 && r.top < innerHeight) {
            if (covers()) boot.covered++;
            else boot.uncovered++;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

      await page.goto(`${UNIFORM_URL}/`, { waitUntil: 'commit' });
      await expect(page.locator('.prerender')).toHaveCount(0, { timeout: 90_000 });
      await expect(page.locator(OVERLAY)).toHaveCount(0, { timeout: 30_000 });
      await expect(page.locator('main h1').first()).toBeVisible();
      await page.waitForTimeout(1500);
      const boot = await page.evaluate(() => window.__boot);
      expect(boot.covered, 'ada frame saat ringkasan prerender tergambar (pengukuran bermakna)').toBeGreaterThan(0);
      expect(boot.uncovered, 'frame dengan teks prerender terlihat tanpa tertutup').toBe(0);
      expect(boot.cls).toBeLessThan(0.005);
    });
  });
}

test.describe('tanpa JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('overlay menutup teks sejak awal, memudar sendiri ≤ 4 detik, lalu teks prerender terbaca', async ({ page }) => {
    await page.goto(`${UNIFORM_URL}/`, { waitUntil: 'domcontentloaded' });
    const state = () =>
      page.evaluate(() => {
        const cs = getComputedStyle(document.getElementById('boot-overlay')!);
        return { opacity: parseFloat(cs.opacity), visibility: cs.visibility };
      });
    expect(await state()).toEqual({ opacity: 1, visibility: 'visible' });
    await expect.poll(async () => (await state()).visibility === 'hidden' || (await state()).opacity === 0, { timeout: 4000, intervals: [100] }).toBe(true);
    const h1 = page.locator('.prerender h1');
    await expect(h1).toBeVisible();
    expect((await h1.innerText()).trim().length).toBeGreaterThan(0);
  });
});

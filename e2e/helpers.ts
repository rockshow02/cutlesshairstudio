import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';

/** Service Token Cloudflare Access (OPSIONAL: hanya bila Worker staging dikunci Access). Dari environment saja. */
const ACCESS_ID = process.env.E2E_CF_ACCESS_CLIENT_ID ?? '';
const ACCESS_SECRET = process.env.E2E_CF_ACCESS_CLIENT_SECRET ?? '';

/**
 * Konteks uji:
 *  - wa.me tidak benar-benar dibuka (dijawab halaman kosong), URL-nya tetap bisa diperiksa
 *  - header Access hanya ke origin situs (bila diisi)
 *  - setiap request ke /api/* dicatat (situs statis tidak boleh memanggil API)
 */
export async function prepareContext(context: BrowserContext, baseURL: string | undefined) {
  await context.route('https://wa.me/**', (route) => route.fulfill({ contentType: 'text/plain', body: 'WhatsApp (uji)' }));
  if (ACCESS_ID && ACCESS_SECRET && baseURL) {
    const origin = new URL(baseURL).origin;
    await context.route(
      (url) => url.origin === origin,
      (route) => route.continue({ headers: { ...route.request().headers(), 'CF-Access-Client-Id': ACCESS_ID, 'CF-Access-Client-Secret': ACCESS_SECRET } }),
    );
  }
}

/** CPU dilambatkan N× (Chromium, CDP) untuk menguji tes yang peka waktu: E2E_CPU_THROTTLE=4 npx playwright test … */
const CPU_THROTTLE = Number(process.env.E2E_CPU_THROTTLE ?? 0);

export const test = base.extend<{ apiCalls: string[] }>({
  context: async ({ context, baseURL }, use) => {
    await prepareContext(context, baseURL);
    await use(context);
  },
  page: async ({ page }, use) => {
    if (CPU_THROTTLE > 1) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
    }
    await use(page);
  },
  apiCalls: async ({ context }, use) => {
    const calls: string[] = [];
    context.on('request', (r) => {
      const url = new URL(r.url());
      if (url.pathname.startsWith('/api/')) calls.push(url.pathname);
    });
    await use(calls);
  },
});

/** Link wa.me → { nomor, pesan } */
export function parseWa(href: string) {
  const url = new URL(href);
  return { number: url.pathname.replace(/\//g, ''), text: url.searchParams.get('text') ?? '' };
}

/** Pastikan tidak ada scroll horizontal */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/**
 * CLS halaman sejak dimuat: menunggu font situs selesai (document.fonts.ready) dan dua frame, lalu menjumlahkan semua
 * layout shift tanpa input (buffered + takeRecords). Tidak bergantung pada jeda waktu tetap.
 */
export const clsOf = (page: Page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    type Shift = { hadRecentInput: boolean; value: number };
    let total = 0;
    const add = (entries: PerformanceEntry[]) => entries.forEach((e) => { if (!(e as unknown as Shift).hadRecentInput) total += (e as unknown as Shift).value; });
    const observer = new PerformanceObserver((list) => add(list.getEntries()));
    observer.observe({ type: 'layout-shift', buffered: true });
    // Entri buffered dikirim ke callback secara async: tunggu satu frame, lalu ambil sisanya
    await new Promise((r) => requestAnimationFrame(r));
    add(observer.takeRecords());
    observer.disconnect();
    return total;
  });

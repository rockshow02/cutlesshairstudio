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

export const test = base.extend<{ apiCalls: string[] }>({
  context: async ({ context, baseURL }, use) => {
    await prepareContext(context, baseURL);
    await use(context);
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

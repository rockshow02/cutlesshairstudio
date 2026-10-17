import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';

/** AUTH_MOCK_SECRET staging (dari environment, tidak pernah ditulis ke repo). Kosong = uji lokal. */
const SECRET = process.env.E2E_MOCK_SECRET ?? '';
/** Service Token Cloudflare Access (OPSIONAL: hanya bila seluruh Worker staging dikunci Access). Dari environment saja. */
const ACCESS_ID = process.env.E2E_CF_ACCESS_CLIENT_ID ?? '';
const ACCESS_SECRET = process.env.E2E_CF_ACCESS_CLIENT_SECRET ?? '';

/** Header Service Token Access; kosong bila tidak diisi (lokal, atau Access hanya di path admin) */
export function accessHeaders(): Record<string, string> {
  return ACCESS_ID && ACCESS_SECRET ? { 'CF-Access-Client-Id': ACCESS_ID, 'CF-Access-Client-Secret': ACCESS_SECRET } : {};
}

/**
 * Mode staging (E2E_MOCK_SECRET terisi). Semua header di bawah HANYA dikirim ke origin staging
 * (tidak ke challenges.cloudflare.com, Google Fonts, dll.):
 *  - CF-Access-Client-Id/Secret (opsional, bila E2E_CF_ACCESS_CLIENT_* diisi) ke SEMUA request origin staging,
 *    untuk kasus Access mengunci seluruh Worker (halaman, aset, dan API). Bila Access hanya di /admin, tidak perlu.
 *  - x-e2e-secret ke /api/** saja: staging memakai kunci Turnstile ASLI yang tidak bisa diselesaikan
 *    browser otomatis. Server melewati Turnstile hanya bila APP_ENV staging, AUTH_MOCK_ENABLED true,
 *    dan secret cocok.
 *  - skrip widget Turnstile diganti stub yang langsung memberi token placeholder, supaya tombol
 *    "Konfirmasi booking" aktif. Token itu diabaikan server karena x-e2e-secret.
 * Lokal (development, tanpa site key, tanpa Access) tidak memerlukan semua ini.
 * Catatan: page.request (APIRequestContext) tidak melewati route ini → tambahkan accessHeaders() sendiri.
 */
export async function prepareContext(context: BrowserContext, baseURL: string | undefined) {
  if (!SECRET || !baseURL) return;
  const origin = new URL(baseURL).origin;
  await context.route(
    (url) => url.origin === origin,
    (route) => {
      const isApi = new URL(route.request().url()).pathname.startsWith('/api/');
      return route.continue({ headers: { ...route.request().headers(), ...accessHeaders(), ...(isApi ? { 'x-e2e-secret': SECRET } : {}) } });
    },
  );
  await context.route('https://challenges.cloudflare.com/turnstile/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile={render:function(el,o){setTimeout(function(){o.callback('e2e-placeholder')},0);return 'e2e'},reset:function(){},remove:function(){}};`,
    }),
  );
}

/**
 * Simulasi jaringan lambat: E2E_SLOW_API_MS=500 menunda setiap GET /api/** (untuk memunculkan race
 * "menghitung elemen saat daftar masih dimuat ulang"). Diteruskan ke route lain (mis. header staging).
 */
const SLOW_API_MS = Number(process.env.E2E_SLOW_API_MS ?? 0);
export async function slowApi(context: BrowserContext) {
  if (!SLOW_API_MS) return;
  await context.route('**/api/**', async (route) => {
    if (route.request().method() === 'GET') await new Promise((r) => setTimeout(r, SLOW_API_MS));
    return route.fallback();
  });
}

/** test dengan konteks browser yang sudah disiapkan untuk staging (lihat prepareContext) */
export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    await prepareContext(context, baseURL);
    await slowApi(context);
    await use(context);
  },
});

/** Login mock (pengganti Google di lokal/staging) */
export async function mockLogin(page: Page, email: string, next = '/booking/') {
  const q = new URLSearchParams({ email, next, ...(SECRET ? { secret: SECRET } : {}) });
  await page.goto(`/api/auth/mock?${q}`, { waitUntil: 'domcontentloaded' });
}

export const uniqueEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@test.local`;

/** Lengkapi profil di /profil/lengkapi */
export async function completeProfile(page: Page, name: string, phone: string) {
  await expect(page).toHaveURL(/\/profil\/lengkapi/);
  await page.getByLabel('Nama', { exact: true }).fill(name);
  await page.getByLabel('Nomor WhatsApp', { exact: true }).fill(phone);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Simpan & lanjut/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/profil/lengkapi'));
  await page.waitForLoadState('domcontentloaded');
}

/** Klik chip tanggal ke-n lalu tunggu daftar jam */
export async function pickDate(page: Page, index: number) {
  await page.getByRole('list', { name: 'Pilih tanggal' }).getByRole('button').nth(index).click();
  await expect(page.getByText('Memuat jam tersedia…')).toHaveCount(0);
}

/** Booking lewat API dari sesi halaman ini (dipakai untuk membuat bentrok) */
export async function apiBook(page: Page, body: Record<string, unknown>) {
  // Token placeholder: lokal (development) tidak memeriksa Turnstile; di staging server melewatinya
  // karena header x-e2e-secret dari prepareContext (konteks halaman ini harus sudah disiapkan)
  const withToken = { turnstileToken: 'e2e-placeholder', ...body };
  return page.evaluate(async (b) => {
    const r = await fetch('/api/bookings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
    return { status: r.status, json: await r.json() };
  }, withToken);
}

/**
 * Tunggu daftar Booking saya selesai dimuat (ulang). Setelah batal/jadwal ulang daftar dimuat ulang
 * (skeleton, aria-busy="true"); menghitung kartu sebelum selesai memberi hasil 0.
 */
export async function waitForBookingList(page: Page) {
  await expect(page.locator('#daftar-booking')).toHaveAttribute('aria-busy', 'false');
}

/** Pastikan tidak ada scroll horizontal (layout 360px) */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

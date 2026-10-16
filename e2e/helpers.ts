import { expect, type Page } from '@playwright/test';

const SECRET = process.env.E2E_MOCK_SECRET ?? '';

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
  // Staging dengan kunci uji Turnstile Cloudflare menerima token dummy; lokal (development) tidak memeriksa
  const withToken = { turnstileToken: process.env.E2E_TURNSTILE_TOKEN ?? 'XXXX.DUMMY.TOKEN.XXXX', ...body };
  return page.evaluate(async (b) => {
    const r = await fetch('/api/bookings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
    return { status: r.status, json: await r.json() };
  }, withToken);
}

/** Pastikan tidak ada scroll horizontal (layout 360px) */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

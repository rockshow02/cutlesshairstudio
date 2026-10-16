import { expect, test } from '@playwright/test';
import { apiBook, completeProfile, expectNoHorizontalScroll, mockLogin, uniqueEmail } from './helpers';

/**
 * Aksi admin di 360px. Lokal: wrangler dev dengan ADMIN_DEV_EMAIL=owner@localhost (tanpa Cloudflare Access).
 * Di staging, /admin dilindungi Cloudflare Access sehingga tes ini hanya untuk lokal.
 */
test.skip(Boolean(process.env.E2E_BASE_URL), 'Admin E2E hanya lokal (staging memakai Cloudflare Access)');

test('admin: lihat booking pelanggan di jadwal, tambah catatan, batalkan dengan alasan', async ({ page, browser }) => {
  // Pelanggan membuat booking untuk besok
  const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL, reducedMotion: 'reduce' });
  const customer = await ctx.newPage();
  await mockLogin(customer, uniqueEmail('admin-flow'), '/booking/saya');
  await completeProfile(customer, 'Pelanggan Admin Flow', '0812 7777 4444');
  const slot = await customer.evaluate(async () => {
    const { branches } = await (await fetch('/api/booking/branches')).json();
    const date = branches[0].dates[1];
    const { slots } = await (await fetch(`/api/availability?branch=bogor-bantarjati&service=signature-haircut&barber=any&date=${date}`)).json();
    return { date, startAt: slots[slots.length - 1].startAt as string };
  });
  const created = await apiBook(customer, { branch: 'bogor-bantarjati', service: 'signature-haircut', barber: 'any', startAt: slot.startAt });
  expect(created.status).toBe(201);
  const code = created.json.booking.code as string;
  await ctx.close();

  await page.goto('/admin#jadwal', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /^Jadwal/ })).toBeVisible();
  await page.getByLabel('Tanggal').fill(slot.date);
  const card = page.getByRole('button', { name: /Pelanggan Admin Flow/ });
  await expect(card).toBeVisible();
  await expectNoHorizontalScroll(page);
  await card.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: code })).toBeVisible();
  await expect(dialog.getByRole('link', { name: '0812-7777-4444' })).toHaveAttribute('href', /wa\.me\/6281277774444/);
  await dialog.getByLabel(/Catatan admin/).fill('Pelanggan minta model taper');
  await dialog.getByRole('button', { name: 'Simpan catatan' }).click();
  await expect(dialog.getByRole('status')).toContainText('Catatan disimpan');

  page.once('dialog', (d) => d.accept('Hairstylist berhalangan'));
  await dialog.getByRole('button', { name: 'Batalkan' }).click();
  await expect(dialog.getByRole('status')).toContainText('Dibatalkan');
  await expect(dialog.getByText('Dibatalkan').first()).toBeVisible();
});

test('admin: walk-in tamu tanpa akun', async ({ page }) => {
  await page.goto('/admin#baru', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Booking baru/ })).toBeVisible();
  await page.getByLabel('Layanan').selectOption({ label: 'Beard Trim & Shape · 20 mnt' });
  await page.getByRole('list', { name: 'Pilih tanggal' }).getByRole('button').nth(2).click();
  await page.locator('ul[aria-label^="Jam"] button').first().click();
  await page.getByLabel('Nama tamu').fill('Tamu Walk-in E2E');
  await page.getByLabel('Nomor WhatsApp').fill('0812 6666 1111');
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: /^Buat booking/ }).click();
  await expect(page.getByText(/Booking [A-HJ-NP-Z2-9]{8} dibuat untuk/)).toBeVisible();
});

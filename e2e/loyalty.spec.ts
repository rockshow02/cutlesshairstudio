import { expect, test } from '@playwright/test';
import { localSql } from './db';
import { apiBook, completeProfile, expectNoHorizontalScroll, mockLogin, uniqueEmail } from './helpers';

/**
 * Cutless Stamp (lokal saja; butuh SQL ke D1 lokal untuk data awal):
 * admin menandai Selesai → kartu bertambah → stempel ke-5 menerbitkan voucher → admin menukar voucher.
 */
test.skip(Boolean(process.env.E2E_BASE_URL), 'Cutless Stamp E2E hanya lokal (butuh data awal di D1 lokal)');
test.describe.configure({ mode: 'serial' });

const email = uniqueEmail('stamp');
const NAME = 'Pelanggan Stamp E2E';
const ymd = (offsetDays: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(Date.now() + offsetDays * 86_400_000));
const yesterday = ymd(-1);
const me = `(SELECT id FROM customers WHERE email = '${email}')`;

test.beforeAll(() => {
  localSql([
    `UPDATE loyalty_settings SET enabled = 1, tier1_stamps = 5, tier2_stamps = 10,
       tier1_service_ids = (SELECT json_group_array(id) FROM services WHERE slug IN ('hair-wash-styling', 'hot-towel-shave')),
       tier2_service_ids = (SELECT json_group_array(id) FROM services WHERE slug = 'signature-haircut') WHERE id = 1`,
  ]);
});
test.afterAll(() => {
  localSql([`UPDATE loyalty_settings SET enabled = 0 WHERE id = 1`]);
});

test('admin menandai Selesai → stempel ke-5 → voucher muncul di Booking saya', async ({ page, browser }) => {
  // Pelanggan baru dengan profil lengkap
  const customer = await browser.newContext({ baseURL: test.info().project.use.baseURL, reducedMotion: 'reduce', viewport: { width: 360, height: 740 } });
  const cp = await customer.newPage();
  await mockLogin(cp, email, '/booking/saya');
  await completeProfile(cp, NAME, '0812 7777 5555');

  // Data awal: 4 stempel di hari-hari sebelumnya + booking kemarin 10.00 WIB yang belum Selesai
  localSql([
    `INSERT OR IGNORE INTO loyalty_cards (customer_id) VALUES (${me})`,
    ...[10, 9, 8, 7].map(
      (d, i) =>
        `INSERT INTO loyalty_stamps (id, customer_id, stamp_date, cycle, kind, status, created_by, created_at, expires_at)
         VALUES ('e2e-stamp-${Date.now()}-${i}', ${me}, '${ymd(-d)}', 0, 'manual', 'active', 'e2e', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), '2099-01-01T00:00:00.000Z')`,
    ),
    `INSERT INTO bookings (id, code, branch_id, barber_id, service_id, customer_id, start_at, end_at, price_snapshot, duration_snapshot, service_name_snapshot, status, source)
     SELECT 'e2e-stamp-bk-${Date.now()}', 'E2' || substr(hex(randomblob(3)), 1, 6), 1,
       (SELECT id FROM barbers WHERE branch_id = 1 AND is_active = 1 ORDER BY sort_order, id LIMIT 1),
       s.id, ${me}, '${yesterday}T03:00:00.000Z', '${yesterday}T03:45:00.000Z', 100000, 45, s.name, 'confirmed', 'admin'
     FROM services s WHERE s.slug = 'signature-haircut'`,
  ]);

  await cp.goto('/booking/saya', { waitUntil: 'domcontentloaded' });
  await expect(cp.getByLabel('4 dari 10 stempel')).toBeVisible();

  // Admin menandai Selesai
  await page.goto('/admin#jadwal', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Tanggal').fill(yesterday);
  await page.getByRole('button', { name: new RegExp(NAME) }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Selesai' }).click();
  await expect(sheet.getByRole('status')).toContainText('Selesai');

  // Pelanggan: 5/10 + voucher hadiah pertama
  await cp.reload({ waitUntil: 'domcontentloaded' });
  await expect(cp.getByLabel('5 dari 10 stempel')).toBeVisible();
  await expect(cp.getByText('Hair Wash & Styling atau Hot Towel Shave').first()).toBeVisible();
  await expect(cp.getByText(/^CS-[A-HJ-NP-Z2-9]{6}$/)).toBeVisible();
  await expectNoHorizontalScroll(cp);
  await customer.close();
});

test('voucher ditukar admin di detail booking → hilang dari daftar voucher pelanggan', async ({ page, browser }) => {
  const customer = await browser.newContext({ baseURL: test.info().project.use.baseURL, reducedMotion: 'reduce', viewport: { width: 360, height: 740 } });
  const cp = await customer.newPage();
  await mockLogin(cp, email, '/booking/saya');
  const code = (await cp.getByText(/^CS-[A-HJ-NP-Z2-9]{6}$/).textContent())!;

  // Pelanggan booking Hair Wash & Styling besok
  const slot = await cp.evaluate(async () => {
    const { branches } = await (await fetch('/api/booking/branches')).json();
    const date = branches[0].dates[1];
    const { slots } = await (await fetch(`/api/availability?branch=bogor-bantarjati&service=hair-wash-styling&barber=any&date=${date}`)).json();
    return { date, startAt: slots[slots.length - 1].startAt as string };
  });
  const created = await apiBook(cp, { branch: 'bogor-bantarjati', service: 'hair-wash-styling', barber: 'any', startAt: slot.startAt });
  expect(created.status).toBe(201);

  // Admin: buka booking → Tukar voucher (dialog konfirmasi)
  await page.goto('/admin#jadwal', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Tanggal').fill(slot.date);
  await page.getByRole('button', { name: new RegExp(NAME) }).click();
  const sheet = page.getByRole('dialog').first();
  await sheet.getByRole('button', { name: 'Tukar voucher' }).click();
  const confirm = page.getByRole('dialog', { name: new RegExp(`Tukar voucher ${code}`) });
  await expect(confirm.getByRole('button', { name: 'Kembali' })).toBeFocused();
  await confirm.getByRole('button', { name: 'Tukar voucher' }).click();
  await expect(page.getByRole('dialog').first().getByRole('status')).toContainText(`Voucher ${code} ditukar`);

  // Pelanggan: voucher sudah tidak ada di daftar aktif
  await cp.reload({ waitUntil: 'domcontentloaded' });
  await expect(cp.getByLabel('5 dari 10 stempel')).toBeVisible();
  await expect(cp.getByText(code)).toHaveCount(0);
  await customer.close();
});

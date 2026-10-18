import { expect, test, type Browser, type Page } from '@playwright/test';
import { localSql } from './db';
import { completeProfile, expectNoHorizontalScroll, mockLogin, uniqueEmail } from './helpers';

/**
 * Cutless Shop (lokal saja; toko dinyalakan lewat SQL ke D1 lokal lalu dimatikan lagi):
 *  1. beli (ambil di cabang) → admin Tandai Lunas → Siap diambil → Sudah diambil → Selesai
 *  2. kirim dengan ongkir manual → admin isi ongkir → pelanggan melihat nominal persis → Lunas → kirim (resi) → diterima
 *  3. produk ditambahkan ke booking → booking dibatalkan → pesanan ikut batal
 */
test.skip(Boolean(process.env.E2E_BASE_URL), 'Shop E2E hanya lokal (butuh data awal di D1 lokal)');
test.describe.configure({ mode: 'serial' });

const RUN = Date.now();
const SLUG = `e2e-pomade-${RUN}`;
const PRODUCT = `E2E Pomade ${RUN}`;
const PRICE = 95000;

test.beforeAll(() => {
  localSql([
    `UPDATE shop_settings SET enabled = 1 WHERE id = 1`,
    `INSERT INTO shop_branch_settings (branch_id, pickup_enabled, with_booking_enabled, ship_manual_enabled, ship_auto_enabled, bank_name, bank_account_no, bank_account_name, unique_code_enabled)
     VALUES (1, 1, 1, 1, 0, 'BCA', '1234567890', 'Cutless Hair Studio', 0)
     ON CONFLICT (branch_id) DO UPDATE SET pickup_enabled = 1, with_booking_enabled = 1, ship_manual_enabled = 1, ship_auto_enabled = 0,
       bank_name = 'BCA', bank_account_no = '1234567890', bank_account_name = 'Cutless Hair Studio', unique_code_enabled = 0`,
    `INSERT INTO products (slug, name, category, description, is_active, sort_order) VALUES ('${SLUG}', '${PRODUCT}', 'Pomade', 'Produk uji E2E.', 1, 0)`,
    `INSERT INTO product_variants (product_id, sku, name, options, price, weight_gram, is_active) SELECT id, 'E2E-${RUN}', '100 gr', '{}', ${PRICE}, 150, 1 FROM products WHERE slug = '${SLUG}'`,
    `INSERT INTO variant_stock (branch_id, variant_id, on_hand, reserved) SELECT 1, v.id, 20, 0 FROM product_variants v JOIN products p ON p.id = v.product_id WHERE p.slug = '${SLUG}'`,
  ]);
});
test.afterAll(() => {
  localSql([`UPDATE shop_settings SET enabled = 0 WHERE id = 1`]);
});

async function customerPage(browser: Browser, tag: string, name: string) {
  const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL, reducedMotion: 'reduce', viewport: { width: 360, height: 740 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  const page = await ctx.newPage();
  const email = uniqueEmail(tag);
  await mockLogin(page, email, '/shop/');
  await completeProfile(page, name, '0812 7777 4444');
  return Object.assign(page, { email });
}

async function addToCartAndCheckout(page: Page) {
  await page.goto(`/shop/${SLUG}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: PRODUCT })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Tambah ke keranjang' }).click();
  await page.getByRole('button', { name: /Keranjang/ }).click();
  const cart = page.getByRole('dialog', { name: 'Keranjang' });
  await expect(cart.getByText(PRODUCT)).toBeVisible();
  await expect(cart.getByText('Rp 95.000').first()).toBeVisible();
  await cart.getByRole('link', { name: 'Checkout' }).click();
  await expect(page).toHaveURL(/\/shop\/checkout/);
  await expect(page.getByText(`1× ${PRODUCT}`)).toBeVisible();
}

/** Admin: buka pesanan di tab Toko lewat kode */
async function openAdminOrder(page: Page, code: string) {
  await page.goto('/admin#toko', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#daftar-pesanan-admin')).toHaveAttribute('aria-busy', 'false');
  await page.getByLabel('Kode / nama').fill(code);
  await page.getByLabel('Kode / nama').press('Enter');
  await page.getByRole('button', { name: new RegExp(`^${code}`) }).click();
  return page.getByRole('dialog', { name: code });
}

const orderCode = async (page: Page) => (await page.getByRole('heading', { level: 1 }).textContent())!.trim();

test('beli → ambil di cabang: admin Lunas → Siap diambil → Sudah diambil → Selesai', async ({ page, browser }) => {
  const cp = await customerPage(browser, 'shop-pickup', 'Pembeli Ambil E2E');
  await addToCartAndCheckout(cp);
  await cp.getByRole('button', { name: /Ambil di cabang/ }).click();
  await cp.getByRole('button', { name: 'Buat pesanan' }).click();
  await expect(cp).toHaveURL(/\/pesanan\/.+baru=1/);
  await expect(cp.locator('#pesanan-detail')).toHaveAttribute('data-status', 'awaiting_payment');
  await expect(cp.getByTestId('nominal-bayar')).toContainText('Rp 95.000');
  await expect(cp.getByRole('link', { name: /Kirim bukti bayar/ })).toHaveAttribute('href', /wa\.me\/62\d+\?text=.*SH-/);
  await expectNoHorizontalScroll(cp);
  const code = await orderCode(cp);

  const sheet = await openAdminOrder(page, code);
  await sheet.getByRole('button', { name: 'Tandai Lunas' }).click();
  await expect(sheet.getByText('Dibayar').first()).toBeVisible();
  await sheet.getByRole('button', { name: 'Siap diambil' }).click();
  await expect(sheet.getByRole('button', { name: 'Sudah diambil' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Sudah diambil' }).click();
  await expect(sheet.getByText('Selesai').first()).toBeVisible();

  await cp.reload({ waitUntil: 'domcontentloaded' });
  await expect(cp.locator('#pesanan-detail')).toHaveAttribute('data-status', 'completed');
  await cp.goto('/pesanan', { waitUntil: 'domcontentloaded' });
  await expect(cp.locator('#daftar-pesanan')).toHaveAttribute('aria-busy', 'false');
  await expect(cp.getByRole('link', { name: code })).toBeVisible();
  await cp.context().close();
});

test('kirim dengan ongkir manual: admin isi ongkir → nominal persis → Lunas → kirim → pesanan diterima', async ({ page, browser }) => {
  const cp = await customerPage(browser, 'shop-ship', 'Pembeli Kirim E2E');
  await addToCartAndCheckout(cp);
  await cp.getByRole('button', { name: /Dikirim/ }).click();
  await cp.getByLabel('Alamat lengkap').fill('Jl. Pajajaran No. 10, Bantarjati, Bogor Utara');
  await cp.getByRole('button', { name: 'Buat pesanan' }).click();
  await expect(cp.locator('#pesanan-detail')).toHaveAttribute('data-status', 'awaiting_quote');
  await expect(cp.getByText(/sedang menghitung ongkir/)).toBeVisible();
  const code = await orderCode(cp);

  const sheet = await openAdminOrder(page, code);
  await sheet.getByLabel('Ongkir (Rp)').fill('15000');
  await sheet.getByLabel('Kurir').fill('JNE');
  await sheet.getByRole('button', { name: 'Simpan ongkir' }).click();
  await expect(sheet.getByRole('button', { name: 'Tandai Lunas' })).toBeVisible();

  await cp.reload({ waitUntil: 'domcontentloaded' });
  await expect(cp.getByTestId('nominal-bayar')).toContainText('Rp 110.000');

  // Nominal berbeda → peringatan + konfirmasi
  await sheet.getByLabel('Nominal diterima (Rp)').fill('100000');
  await sheet.getByRole('button', { name: 'Tandai Lunas' }).click();
  const warn = page.getByRole('dialog', { name: 'Nominal tidak sama dengan total' });
  await expect(warn).toBeVisible();
  await warn.getByRole('button', { name: 'Periksa lagi' }).click();
  await sheet.getByLabel('Nominal diterima (Rp)').fill('');
  await sheet.getByRole('button', { name: 'Tandai Lunas' }).click();
  await sheet.getByLabel('Nomor resi').fill('JNE0001E2E');
  await sheet.getByRole('button', { name: 'Tandai dikirim' }).click();
  await expect(sheet.getByText('Resi: JNE0001E2E')).toBeVisible();

  await cp.reload({ waitUntil: 'domcontentloaded' });
  await expect(cp.locator('#pesanan-detail')).toHaveAttribute('data-status', 'shipped');
  await cp.getByRole('button', { name: 'Pesanan diterima' }).click();
  await cp.getByRole('dialog').getByRole('button', { name: /Ya, sudah diterima/i }).click();
  await expect(cp.locator('#pesanan-detail')).toHaveAttribute('data-status', 'completed');
  await cp.context().close();
});

test('produk ditambahkan ke booking; booking dibatalkan → pesanan ikut batal', async ({ browser }) => {
  const cp = await customerPage(browser, 'shop-booking', 'Pembeli Booking E2E');
  const me = `(SELECT id FROM customers WHERE email = '${cp.email}')`;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(Date.now() + 3 * 86_400_000));
  localSql([
    `INSERT INTO bookings (id, code, branch_id, barber_id, service_id, customer_id, start_at, end_at, price_snapshot, duration_snapshot, service_name_snapshot, status, source)
     SELECT 'e2e-shop-bk-${RUN}', 'E3' || substr(hex(randomblob(3)), 1, 6), 1,
       (SELECT id FROM barbers WHERE branch_id = 1 AND is_active = 1 ORDER BY sort_order, id LIMIT 1),
       s.id, ${me}, '${day}T07:00:00.000Z', '${day}T07:45:00.000Z', 100000, 45, s.name, 'confirmed', 'online'
     FROM services s WHERE s.slug = 'signature-haircut'`,
  ]);
  await cp.goto('/booking/saya', { waitUntil: 'domcontentloaded' });
  await expect(cp.locator('#daftar-booking')).toHaveAttribute('aria-busy', 'false');
  await cp.getByRole('button', { name: 'Tambah produk' }).click();
  const pick = cp.getByRole('dialog', { name: 'Tambah produk' });
  await pick.getByRole('button', { name: `Pilih ${PRODUCT}` }).click();
  await pick.getByRole('button', { name: /Simpan · Rp 95\.000/ }).click();
  await expect(cp.locator('p', { hasText: 'Produk diambil saat datang' })).toContainText(PRODUCT);
  await expectNoHorizontalScroll(cp);

  await cp.getByRole('button', { name: 'Batalkan' }).first().click();
  const dialog = cp.getByRole('dialog');
  const reason = dialog.getByRole('textbox');
  if (await reason.count()) await reason.fill('Uji E2E toko');
  await dialog.getByRole('button', { name: /Batalkan booking|Ya, batalkan/i }).click();
  await cp.goto('/pesanan', { waitUntil: 'domcontentloaded' });
  await expect(cp.locator('#daftar-pesanan')).toHaveAttribute('aria-busy', 'false');
  await expect(cp.getByText('Dibatalkan').first()).toBeVisible();
  await cp.context().close();
});

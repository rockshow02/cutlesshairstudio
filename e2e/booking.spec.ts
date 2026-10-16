import { expect, test } from '@playwright/test';
import { apiBook, completeProfile, expectNoHorizontalScroll, mockLogin, pickDate, uniqueEmail } from './helpers';

test.describe.configure({ mode: 'serial' });

const email = uniqueEmail('pelanggan');

test('tombol booking tanpa login → masuk → lengkapi profil → kembali ke langkah yang sama → booking berhasil', async ({ page }) => {
  // Seperti tombol "Booking" di kartu layanan landing page (cabang & kategori layanan sudah dipilih)
  await page.goto('/booking/?cabang=bogor-bantarjati&layanan=Haircut', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/masuk\?next=/);
  await expectNoHorizontalScroll(page);

  // Login (mock Google) dengan next yang dibawa halaman /masuk
  const next = new URL(page.url()).searchParams.get('next')!;
  expect(next).toBe('/booking/?cabang=bogor-bantarjati&layanan=Haircut');
  await mockLogin(page, email, next);
  await completeProfile(page, 'Pelanggan E2E', '0812 7777 1234');

  // Kembali ke langkah layanan (cabang sudah terisi, layanan difilter kategori Haircut)
  await expect(page).toHaveURL(/cabang=bogor-bantarjati/);
  await expect(page.getByText('Menampilkan kategori Haircut')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: /Signature Haircut/ }).click();

  await page.getByRole('button', { name: /Siapa saja/ }).click();
  await pickDate(page, 1); // besok
  await page.locator('ul[aria-label^="Jam"] button').first().click();

  await expect(page.getByRole('heading', { name: 'Konfirmasi booking' })).toBeVisible();
  await expect(page.getByText('Pelanggan E2E')).toBeVisible();
  await expect(page.getByText('0812-7777-1234')).toBeVisible();
  await page.getByLabel(/Catatan/).fill('Tes E2E');
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Konfirmasi booking' }).click();

  await expect(page).toHaveURL(/\/booking\/sukses\?id=/);
  await expect(page.getByRole('heading', { name: 'Booking berhasil!' })).toBeVisible();
  await expect(page.getByText(/^[A-HJ-NP-Z2-9]{8}$/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Kirim detail ke WhatsApp cabang/ })).toHaveAttribute('href', /^https:\/\/wa\.me\/62\d+\?text=.*Kode/);
  const ics = await page.getByRole('link', { name: /Tambah ke kalender/ }).getAttribute('href');
  const res = await page.request.get(ics!);
  expect(res.headers()['content-type']).toContain('text/calendar');
  expect(await res.text()).toContain('BEGIN:VEVENT');
  await expectNoHorizontalScroll(page);
});

test('slot bentrok: jam dibooking orang lain saat konfirmasi → pesan 409 + jam alternatif → booking alternatif berhasil', async ({ page, browser }) => {
  await mockLogin(page, email, '/booking/?cabang=bogor-bantarjati&layanan=signature-haircut');
  await page.getByRole('button', { name: /Dimas/ }).click();
  await pickDate(page, 2);
  await page.locator('ul[aria-label^="Jam"] button').nth(2).click();
  await expect(page.getByRole('heading', { name: 'Konfirmasi booking' })).toBeVisible();

  // Pelanggan lain membooking jam & hairstylist yang sama lebih dulu
  const url = new URL(page.url());
  const barberId = url.searchParams.get('barber');
  const other = await browser.newContext({ baseURL: url.origin, reducedMotion: 'reduce' });
  const otherPage = await other.newPage();
  await mockLogin(otherPage, uniqueEmail('lain'), '/booking/');
  await completeProfile(otherPage, 'Pelanggan Lain', '0812 7777 9999');
  // Ambil jam yang sedang dipilih dari ringkasan konfirmasi
  const chosenText = await page.getByText(/WIB$/).first().textContent();
  const avail = await otherPage.evaluate(async ({ barberId }) => {
    const r = await fetch('/api/booking/branches');
    const { branches } = await r.json();
    const date = branches[0].dates[2];
    const a = await fetch(`/api/availability?branch=bogor-bantarjati&service=signature-haircut&barber=${barberId}&date=${date}`);
    return (await a.json()).slots as { time: string; startAt: string }[];
  }, { barberId });
  const hhmm = chosenText!.match(/(\d{2})\.(\d{2})/)!;
  const slot = avail.find((s) => s.time === `${hhmm[1]}:${hhmm[2]}`)!;
  expect(slot).toBeTruthy();
  const taken = await apiBook(otherPage, { branch: 'bogor-bantarjati', service: 'signature-haircut', barber: Number(barberId), startAt: slot.startAt });
  expect(taken.status).toBe(201);

  await page.getByRole('button', { name: 'Konfirmasi booking' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Jam ini baru saja dibooking');
  await expect(alert.getByRole('button')).toHaveCount(3);
  await expectNoHorizontalScroll(page);
  await alert.getByRole('button').first().click();
  await page.getByRole('button', { name: 'Konfirmasi booking' }).click();
  await expect(page).toHaveURL(/\/booking\/sukses/);
  await other.close();
});

test('booking saya: jadwal ulang lalu batalkan', async ({ page }) => {
  await mockLogin(page, email, '/booking/saya');
  await expect(page.getByRole('heading', { name: 'Booking saya' })).toBeVisible();
  const cards = page.locator('article');
  await expect(page.getByRole('heading', { name: 'Aktif' })).toBeVisible();
  const first = cards.first();
  const before = (await first.locator('span').first().textContent())!;
  const withOldTime = () => page.locator('article').filter({ hasText: before }).count();
  const countBefore = await withOldTime();

  await first.getByRole('button', { name: 'Jadwal ulang' }).click();
  await pickDate(page, 3);
  await first.locator('ul[aria-label^="Jam"] button').first().click();
  await expectNoHorizontalScroll(page); // panel jadwal ulang (chip tanggal) tidak boleh melebarkan halaman
  await first.getByRole('button', { name: /^Pindah ke/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'dipindah ke' })).toBeVisible();
  await expectNoHorizontalScroll(page);
  // Satu booking pindah dari jadwal lama (bisa ada booking lain di jam yang sama dengan hairstylist berbeda)
  await expect.poll(withOldTime).toBe(countBefore - 1);

  const activeBefore = await page.locator('article').filter({ has: page.getByRole('button', { name: 'Batalkan' }) }).count();
  await page.locator('article').first().getByRole('button', { name: 'Batalkan' }).click();
  await page.getByLabel('Alasan (opsional)').fill('Ada keperluan');
  await page.getByRole('button', { name: 'Ya, batalkan booking' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'dibatalkan' })).toBeVisible();
  await expect(page.locator('article').filter({ has: page.getByRole('button', { name: 'Batalkan' }) })).toHaveCount(activeBefore - 1);
  await expect(page.getByText('Dibatalkan').first()).toBeVisible();
});

test('profil: ubah nomor tersimpan & dinormalisasi', async ({ page }) => {
  await mockLogin(page, email, '/profil');
  await page.getByLabel('Nomor WhatsApp').fill('+62 813-1111-2222');
  await page.getByRole('button', { name: 'Simpan perubahan' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Profil tersimpan' })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Nomor WhatsApp')).toHaveValue('0813-1111-2222');
  await expectNoHorizontalScroll(page);
});

test('landing page: tombol "Booking Online" di hero → masuk → kembali ke booking dengan cabang terpilih', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('cutless:branch', 'bogor-bantarjati'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  const hero = page.locator('#top').getByRole('link', { name: 'Booking Online' });
  await expect(hero).toHaveAttribute('href', '/booking/?cabang=bogor-bantarjati');
  // Tombol hijau WhatsApp tetap chat WhatsApp
  // (disembunyikan dari pembaca layar saat berada di area hero, jadi dicek lewat selektor CSS)
  await expect(page.locator('a[class*="fab"]')).toHaveAttribute('href', /wa\.me/);
  await hero.click();
  await expect(page).toHaveURL(/\/masuk\?next=%2Fbooking%2F%3Fcabang%3Dbogor-bantarjati/);
  await mockLogin(page, 'budi@test.local', new URL(page.url()).searchParams.get('next')!);
  await expect(page.getByRole('heading', { name: 'Pilih layanan' })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

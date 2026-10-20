import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { expectNoHorizontalScroll, parseWa, test } from './helpers';

/**
 * Halaman /partner/ (360 px & desktop): navigasi dari beranda, refresh langsung (HTML statis), form → wa.me
 * berisi pesan yang benar, tidak ada request ke /api/*.
 */
const json = <T>(file: string): T => JSON.parse(readFileSync(`src/content/${file}`, 'utf8')) as T;
const partner = json<{ partnershipWhatsapp?: string; hero: { title: string } }>('partner.json');
const settings = json<{ mainWhatsappNumber: string; siteName: string }>('settings.json');
const partnerNumber = partner.partnershipWhatsapp || settings.mainWhatsappNumber;

test('beranda → Partner (footer; di HP juga lewat menu) → /partner/', async ({ page, isMobile, apiCalls }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  if (isMobile) {
    await page.getByRole('button', { name: 'Buka menu' }).click();
    const link = page.getByRole('navigation', { name: 'Menu utama' }).getByRole('link', { name: 'Partner', exact: true });
    await expect(link).toBeVisible();
    await link.click();
  } else {
    // Navbar desktop tetap ringkas: Partner hanya di footer
    await expect(page.locator('header').getByRole('link', { name: 'Partner', exact: true })).toBeHidden();
    const footerLink = page.locator('footer').getByRole('link', { name: 'Partner', exact: true });
    await footerLink.scrollIntoViewIfNeeded();
    await footerLink.click();
  }
  await expect(page).toHaveURL(/\/partner\/$/);
  await expect(page.getByRole('heading', { level: 1, name: partner.hero.title })).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(apiCalls).toEqual([]);
});

test('refresh langsung di /partner/: HTML statis dengan title & meta sendiri', async ({ page, request }) => {
  for (const path of ['/partner/', '/partner']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    const html = await res.text();
    expect(html).toContain('Kemitraan &amp; Kerja Sama | ');
    expect(html).toMatch(/<meta name="description" content="[^"]+"/);
    expect(html).toContain('/partner/" />');
    expect(html).toContain(partner.hero.title);
  }
  await page.goto('/partner/', { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/Kemitraan & Kerja Sama \| /);
  await expect(page.locator('#ajukan form')).toBeVisible();
});

test('form: validasi di browser, lalu Kirim via WhatsApp membuka wa.me dengan pesan berisi semua isian', async ({ page, context, apiCalls }) => {
  await page.goto('/partner/', { waitUntil: 'domcontentloaded' });
  // Tombol hero "Ajukan Kerja Sama" → form
  await page.getByRole('link', { name: 'Ajukan Kerja Sama' }).first().click();
  const form = page.locator('#ajukan form');
  await expect(form).toBeInViewport();

  const submit = form.getByRole('button', { name: /Kirim via WhatsApp/i });
  await submit.click();
  await expect(form.locator('[aria-invalid="true"]')).toHaveCount(5);
  await expect(form.getByLabel(/Jenis kerja sama/)).toBeFocused();

  await form.getByLabel(/Jenis kerja sama/).selectOption('korporat');
  await form.getByLabel(/^Nama \(/).fill('Rina Wulandari');
  await form.getByLabel(/perusahaan\/brand/i).fill('PT Contoh Sejahtera');
  await form.getByLabel(/^Kota/).fill('Bandung');
  await form.getByLabel(/Nomor WhatsApp/).fill('12345');
  await form.getByLabel(/Pesan singkat/).fill('Grooming untuk 40 karyawan bulan depan.');
  await submit.click();
  await expect(form.getByText(/diawali 08 atau 62, mis/i).last()).toBeVisible();

  await form.getByLabel(/Nomor WhatsApp/).fill('0812-3456-7890');
  // Tombol kirim tidak tertutup tombol WhatsApp melayang
  await submit.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const overlap = await submit.evaluate((btn) => {
    const b = btn.getBoundingClientRect();
    return [...document.querySelectorAll('a')].some((el) => {
      const s = getComputedStyle(el);
      if (s.position !== 'fixed' || !el.href.startsWith('https://wa.me/') || s.visibility === 'hidden' || s.opacity === '0' || el.hasAttribute('data-hidden')) return false;
      const f = el.getBoundingClientRect();
      return !(b.right < f.left || b.left > f.right || b.bottom < f.top || b.top > f.bottom);
    });
  });
  expect(overlap, 'tombol WA melayang menutupi tombol kirim').toBe(false);
  const popup = context.waitForEvent('page');
  await submit.click();
  const wa = parseWa((await popup).url());
  expect(wa.number).toBe(partnerNumber);
  expect(wa.text).toContain(`Halo Tim Partnership ${settings.siteName}`);
  expect(wa.text).toContain('*Jenis kerja sama:* Korporat & Event');
  expect(wa.text).toContain('*Nama:* Rina Wulandari');
  expect(wa.text).toContain('*Perusahaan/brand:* PT Contoh Sejahtera');
  expect(wa.text).toContain('*Kota:* Bandung');
  expect(wa.text).toContain('*Nomor WhatsApp:* 081234567890');
  expect(wa.text).toContain('Grooming untuk 40 karyawan bulan depan.');
  await expect(form.getByRole('status')).toContainText('WhatsApp sudah dibuka');
  await expectNoHorizontalScroll(page);
  expect(apiCalls).toEqual([]);
});

test('kartu jenis & FAQ: link ke section detail, accordion bisa dibuka dengan keyboard', async ({ page }) => {
  await page.goto('/partner/', { waitUntil: 'domcontentloaded' });
  const card = page.locator('#jenis-kerja-sama').getByRole('link').nth(1);
  await expect(card).toHaveAttribute('href', '#brand-kolaborasi');
  await card.click();
  await expect(page.locator('#brand-kolaborasi')).toBeInViewport();
  // Tombol "Ajukan" di section detail mengisi jenis di form
  await page.locator('#brand-kolaborasi').getByRole('link', { name: 'Ajukan Kerja Sama' }).click();
  await expect(page.locator('#ajukan select')).toHaveValue('brand');

  const first = page.locator('#faq details').first();
  await first.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('open', '');
  await expect(first.locator('p')).toBeVisible();
});

test('tombol Chat Tim Partnership → WhatsApp nomor partnership', async ({ page }) => {
  await page.goto('/partner/', { waitUntil: 'domcontentloaded' });
  const href = await page.getByRole('link', { name: 'Chat Tim Partnership' }).getAttribute('href');
  const wa = parseWa(href!);
  expect(wa.number).toBe(partnerNumber);
  expect(wa.text).toContain('Tim Partnership');
});

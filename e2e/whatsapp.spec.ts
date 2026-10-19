import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { expectNoHorizontalScroll, parseWa, test } from './helpers';

/**
 * Situs statis: semua tombol booking & pesan membuka WhatsApp cabang yang benar (360 px & desktop),
 * tidak ada request ke /api/*, rute fitur yang dicabut → beranda (bila pernah ditautkan) atau 404.
 */
const json = <T>(file: string): T => JSON.parse(readFileSync(`src/content/${file}`, 'utf8')) as T;
const branches = json<{ slug: string; name: string; whatsappNumber: string; status: string }[]>('branches.json');
const barbers = json<{ name: string; branchSlug: string; whatsappNumber?: string; isActive?: boolean }[]>('barbers.json');
const bogor = branches.find((b) => b.slug === 'bogor-bantarjati')!;
const cibubur = branches.find((b) => b.slug === 'cibubur')!;

/** Tombol booking/pesan (footer berisi WhatsApp PUSAT untuk pertanyaan umum, sengaja tidak termasuk) */
const waLinks = (page: import('@playwright/test').Page) =>
  page.locator('a[href^="https://wa.me/"]').evaluateAll((els) =>
    els.filter((a) => !a.closest('footer')).map((a) => ({ href: (a as HTMLAnchorElement).href, label: (a.textContent ?? '').trim().replace(/\s+/g, ' ') })),
  );

test('belum memilih cabang: tombol hero → pemilih cabang → WhatsApp cabang itu dengan pesan menyebut cabang', async ({ page, context, apiCalls }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const hero = page.getByRole('link', { name: 'Booking via WhatsApp' }).first();
  await expect(hero).toBeVisible();
  await hero.click();
  const picker = page.getByRole('dialog', { name: 'Pilih cabang' });
  await picker.getByRole('button', { name: /Cibubur/ }).click(); // kota
  const popup = context.waitForEvent('page');
  await picker.getByRole('button', { name: /^Cibubur/ }).last().click(); // cabang
  const wa = parseWa((await popup).url());
  expect(wa.number).toBe(cibubur.whatsappNumber);
  expect(wa.text).toContain(`cabang ${cibubur.name}`);
  await expectNoHorizontalScroll(page);
  expect(apiCalls).toEqual([]);
});

test('setelah cabang dipilih: semua tombol booking/pesan di beranda langsung ke WhatsApp cabang itu', async ({ page, apiCalls }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((slug) => localStorage.setItem('cutless:branch', slug), cibubur.slug);
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Muat semua section (lazy) dengan menggulir sampai bawah
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
  });
  await expect(page.locator('#layanan a[href^="https://wa.me/"]').first()).toBeVisible();
  const links = await waLinks(page);
  const ownBarbers = new Map(barbers.filter((b) => b.whatsappNumber).map((b) => [b.name, b.whatsappNumber!]));
  // Tombol umum (hero, navbar "Booking Sekarang", CTA penutup, tombol melayang, kartu layanan & harga) → nomor cabang
  const general = links.filter((l) => ![...ownBarbers.keys()].some((name) => decodeURIComponent(l.href).includes(name)));
  expect(general.length).toBeGreaterThanOrEqual(5);
  for (const l of general) {
    const wa = parseWa(l.href);
    expect.soft(wa.number, l.label).toBe(cibubur.whatsappNumber);
    expect.soft(wa.text, l.label).toContain(`cabang ${cibubur.name}`);
  }
  // Pesan menyebut layanan / paket bila tombolnya di kartu layanan atau harga
  const texts = links.map((l) => parseWa(l.href).text);
  expect(texts.some((t) => /mau booking .*Haircut|layanan/i.test(t))).toBe(true);
  // Navbar "Booking Sekarang" (desktop) / tombol melayang
  const labels = links.map((l) => l.label.toLowerCase());
  expect(labels.some((t) => t.includes('booking'))).toBe(true);
  await expectNoHorizontalScroll(page);
  expect(apiCalls).toEqual([]);
});

test('kartu hairstylist: WhatsApp hairstylist (atau cabangnya) dengan nama hairstylist & cabang', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((slug) => localStorage.setItem('cutless:branch', slug), bogor.slug);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#hairstylist').scrollIntoViewIfNeeded();
  const active = barbers.filter((b) => b.isActive !== false && b.branchSlug === bogor.slug);
  const links = await page.locator('#hairstylist a[href^="https://wa.me/"]').evaluateAll((els) => els.map((a) => (a as HTMLAnchorElement).href));
  expect(links.length).toBeGreaterThan(0);
  for (const href of links) {
    const wa = parseWa(href);
    const barber = active.find((b) => wa.text.includes(b.name));
    expect(barber, wa.text).toBeTruthy();
    expect(wa.number).toBe(barber!.whatsappNumber || bogor.whatsappNumber);
    expect(wa.text).toContain(`cabang ${bogor.name}`);
  }
});

test('halaman /cabang/:slug: tombol booking selalu ke cabang halaman itu (bukan cabang tersimpan)', async ({ page, apiCalls }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((slug) => localStorage.setItem('cutless:branch', slug), cibubur.slug);
  await page.goto(`/cabang/${bogor.slug}/`, { waitUntil: 'domcontentloaded' });
  const book = page.getByRole('main').locator('a[href^="https://wa.me/"]').first();
  await expect(book).toBeVisible();
  const wa = parseWa((await book.getAttribute('href'))!);
  expect(wa.number).toBe(bogor.whatsappNumber);
  expect(wa.text).toContain(`cabang ${bogor.name}`);
  await expectNoHorizontalScroll(page);
  await page.goto('/produk/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toBeVisible();
  expect(apiCalls).toEqual([]);
});

test('rute fitur yang dicabut: /booking & /shop → beranda, lainnya 404', async ({ page }) => {
  for (const path of ['/booking', '/booking/saya', '/shop', '/shop/beard-oil']) {
    const r = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(new URL(page.url()).pathname, path).toBe('/');
    expect(r?.status()).toBe(200);
  }
  for (const path of ['/masuk', '/profil', '/pesanan', '/admin', '/kebijakan-privasi', '/api/health']) {
    const r = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(r?.status(), path).toBe(404);
  }
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

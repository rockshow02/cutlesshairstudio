import { createServer, type Server } from 'node:http';
import { expect, type Page, type Request as PwRequest } from '@playwright/test';
import { E2E_BARBERS, E2E_BRANCHES, E2E_HERO_CTA } from './fixtures/content';
import { parseWa, test } from './helpers';

/**
 * Hitungan klik WhatsApp (Worker lokal + D1 lokal, npm run e2e:server):
 *  - klik tombol WhatsApp mengirim satu kiriman kecil ke /api/klik-wa (jenis, cabang, kapster, halaman) & tetap membuka wa.me,
 *    juga saat endpoint gagal atau lambat
 *  - endpoint menolak Origin lain & isian di luar daftar
 *  - /statistik/ 403 tanpa JWT Cloudflare Access; dengan JWT valid menampilkan angka dari klik uji (360 px & desktop)
 * Kunci Access tiruan: server JWKS di 127.0.0.1:8799 (ACCESS_TEAM_DOMAIN di npm run e2e:server).
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh Worker lokal dengan D1 lokal (npm run e2e:server)');

const { bogor, cibubur } = E2E_BRANCHES;
const ORIGIN = 'http://localhost:8787';
const TEAM = 'http://127.0.0.1:8799';
const AUD = 'e2e-statistik';
const ENDPOINT = '/api/klik-wa';
const barber = E2E_BARBERS[0];
const barberKey = barber.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const isClick = (r: PwRequest) => new URL(r.url()).pathname === ENDPOINT && r.method() === 'POST';
const payloadOf = (r: PwRequest) => JSON.parse(r.postData() ?? '{}') as Record<string, string>;

/** Klik link WhatsApp → tab wa.me (dijawab halaman uji oleh helpers.prepareContext) */
async function clickWa(page: Page, link: ReturnType<Page['locator']>) {
  const popup = page.context().waitForEvent('page');
  await link.click();
  return popup;
}

test('tombol booking halaman cabang: kiriman 204 (jenis, cabang, halaman; tanpa nomor/pesan) & wa.me terbuka', async ({ page }) => {
  await page.goto(`/cabang/${cibubur.slug}/`, { waitUntil: 'domcontentloaded' });
  // Tombol booking di hero halaman cabang (kartu layanan/harga di halaman ini = booking umum untuk cabang ini)
  const link = page.locator('#top a[href^="https://wa.me/"]').first();
  await expect(link).toBeVisible();
  const sent = page.waitForRequest(isClick);
  const answered = page.waitForResponse((r) => isClick(r.request()));
  const popup = await clickWa(page, link);
  expect(parseWa(popup.url()).number).toBe(cibubur.whatsappNumber);
  const req = await sent;
  expect(payloadOf(req)).toEqual({ k: 'cabang', b: cibubur.slug, p: `/cabang/${cibubur.slug}/` });
  expect(req.postData()).not.toContain(cibubur.whatsappNumber);
  expect(req.headers().cookie).toBeUndefined();
  expect((await answered).status()).toBe(204);
});

test('tombol kapster di beranda: jenis kapster + kunci kapster', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const link = page.locator(`a[href^="https://wa.me/"][href*="${encodeURIComponent(barber.name)}"]`).first();
  await link.scrollIntoViewIfNeeded({ timeout: 20_000 });
  const sent = page.waitForRequest(isClick);
  await clickWa(page, link);
  expect(payloadOf(await sent)).toEqual({ k: 'kapster', b: barber.branchSlug, s: barberKey, p: '/' });
});

test('pemilih cabang (belum memilih cabang): klik tercatat untuk cabang yang dipilih', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: E2E_HERO_CTA }).first().click();
  const picker = page.getByRole('dialog', { name: 'Pilih cabang' });
  await picker.getByRole('button', { name: /Cibubur/ }).click();
  const sent = page.waitForRequest(isClick);
  const popup = page.context().waitForEvent('page');
  await picker.getByRole('button', { name: /^Cibubur/ }).last().click();
  expect(parseWa((await popup).url()).number).toBe(cibubur.whatsappNumber);
  expect(payloadOf(await sent)).toMatchObject({ k: 'umum', b: cibubur.slug, p: '/' });
});

for (const mode of ['gagal', 'lambat'] as const) {
  test(`endpoint ${mode}: WhatsApp tetap langsung terbuka`, async ({ page, context }) => {
    let hit = 0;
    await context.route(`**${ENDPOINT}`, async (route) => {
      hit++;
      if (mode === 'gagal') return route.abort('failed');
      await new Promise((r) => setTimeout(r, 15_000));
      return route.fulfill({ status: 204 }).catch(() => undefined);
    });
    await page.goto(`/cabang/${bogor.slug}/`, { waitUntil: 'domcontentloaded' });
    const link = page.locator('main a[href^="https://wa.me/"]').first();
    await expect(link).toBeVisible();
    const started = Date.now();
    const popup = await clickWa(page, link);
    await popup.waitForLoadState('domcontentloaded');
    expect(parseWa(popup.url()).number).toBe(bogor.whatsappNumber);
    expect(Date.now() - started).toBeLessThan(5_000);
    await expect.poll(() => hit).toBeGreaterThan(0);
    await context.unrouteAll({ behavior: 'ignoreErrors' });
  });
}

test('endpoint: Origin lain 403, isian di luar daftar 400, kiriman besar 413, GET 405', async ({ request, isMobile }) => {
  test.skip(isMobile, 'tidak bergantung ukuran layar');
  const send = (data: string, origin = ORIGIN) => request.post(ENDPOINT, { headers: { Origin: origin, 'Content-Type': 'text/plain' }, data });
  const ok = JSON.stringify({ k: 'umum', p: '/' });
  expect((await send(ok)).status()).toBe(204);
  expect((await send(ok, 'https://evil.example')).status()).toBe(403);
  expect((await request.post(ENDPOINT, { data: ok })).status()).toBe(403);
  expect((await send(JSON.stringify({ k: 'umum', b: 'jakarta', p: '/' }))).status()).toBe(400);
  expect((await send(JSON.stringify({ k: 'umum', p: '/', nomor: '628123' }))).status()).toBe(400);
  expect((await send(JSON.stringify({ k: 'umum', p: `/${'a'.repeat(600)}` }))).status()).toBe(413);
  expect((await request.get(ENDPOINT)).status()).toBe(405);
});

/* ---------- /statistik/ ---------- */

let jwks: Server | undefined;
let privateKey: CryptoKey;
const kid = `e2e-${Date.now()}`;
const b64url = (d: ArrayBuffer | string) => Buffer.from(typeof d === 'string' ? d : new Uint8Array(d)).toString('base64url');

async function accessJwt(claims: Record<string, unknown> = {}) {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid }));
  const body = b64url(JSON.stringify({ aud: [AUD], iss: TEAM, email: 'owner@contoh.id', exp: Math.floor(Date.now() / 1000) + 600, ...claims }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

test.describe('statistik', () => {
  test.beforeAll(async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    privateKey = pair.privateKey;
    const body = JSON.stringify({ keys: [{ ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid }] });
    jwks = createServer((req, res) => {
      if (req.url === '/cdn-cgi/access/certs') res.writeHead(200, { 'Content-Type': 'application/json' }).end(body);
      else res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => jwks!.listen(8799, '127.0.0.1', resolve));
  });
  test.afterAll(async () => {
    await new Promise((resolve) => jwks?.close(resolve));
  });

  test('tanpa JWT Access / JWT salah → 403, tanpa data', async ({ request, page }) => {
    for (const headers of [{}, { 'Cf-Access-Jwt-Assertion': 'palsu' }, { 'Cf-Access-Jwt-Assertion': await accessJwt({ aud: ['aplikasi-lain'] }) }]) {
      const res = await request.get('/statistik/', { headers });
      expect(res.status()).toBe(403);
      expect(await res.text()).not.toContain(cibubur.name);
    }
    expect((await request.get('/statistik/?format=csv')).status()).toBe(403);
    const res = await page.goto('/statistik/');
    expect(res?.status()).toBe(403);
    await expect(page.getByRole('heading', { name: 'Akses ditolak' })).toBeVisible();
  });

  test('JWT valid: angka bertambah tepat sesuai klik uji, noindex, ramah HP, CSV', async ({ request, page }) => {
    const auth = { 'Cf-Access-Jwt-Assertion': await accessJwt() };
    const csvCount = async () => {
      const res = await request.get('/statistik/?format=csv', { headers: auth });
      expect(res.status()).toBe(200);
      const row = (await res.text()).split('\r\n').find((l) => l.includes('"Booking kapster"') && l.includes(`"${barber.name}"`) && l.includes('"TikTok"'));
      return row ? Number(row.split(',').pop()!.replace(/"/g, '')) : 0;
    };
    const before = await csvCount();
    const click = JSON.stringify({ k: 'kapster', b: barber.branchSlug, s: barberKey, p: '/', r: 'www.tiktok.com' });
    for (let i = 0; i < 3; i++) {
      expect((await request.post(ENDPOINT, { headers: { Origin: ORIGIN, 'Content-Type': 'text/plain' }, data: click })).status()).toBe(204);
    }
    expect(await csvCount()).toBe(before + 3);

    await page.setExtraHTTPHeaders(auth);
    const res = await page.goto('/statistik/');
    expect(res?.status()).toBe(200);
    expect(res?.headers()['x-robots-tag']).toBe('noindex, nofollow');
    await expect(page.getByRole('heading', { name: 'Statistik klik WhatsApp' })).toBeVisible();
    await expect(page.locator('[data-table="kapster"]')).toContainText(barber.name);
    await expect(page.locator('[data-table="asal"]')).toContainText('TikTok');
    expect(Number(await page.locator('[data-stat="last7"]').textContent())).toBeGreaterThanOrEqual(3);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // Tidak masuk sitemap & llms.txt
    for (const file of ['/sitemap.xml', '/llms.txt']) expect(await (await request.get(file)).text()).not.toContain('statistik');
  });
});

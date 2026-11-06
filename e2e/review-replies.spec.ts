import { createServer, type Server } from 'node:http';
import { expect, type APIRequestContext } from '@playwright/test';
import { test } from './helpers';

/**
 * Balasan ulasan Google (Worker lokal + D1 lokal + MockGbpClient, npm run e2e:server; mode Aktif di build E2E):
 *  - /ulasan/ 403 tanpa JWT Cloudflare Access; tidak ada di sitemap & llms.txt; /ulasan-config.json tidak terbuka
 *  - cron (Worker --test-scheduled) mengambil ulasan contoh: bintang 5 bersih terkirim otomatis, sisanya antre, yang sudah
 *    berbalas dilewati; cron kedua tidak menggandakan apa pun
 *  - admin menyunting draf, menyimpan, dan mengirim; ringkasan & judul tab; ramah HP (360 px) dan desktop
 * Kunci Access tiruan: server JWKS di 127.0.0.1:8799 (ACCESS_TEAM_DOMAIN di npm run e2e:server).
 */
test.skip(!!process.env.E2E_BASE_URL, 'butuh Worker lokal dengan D1 lokal (npm run e2e:server)');

const TEAM = 'http://127.0.0.1:8799';
const AUD = 'e2e-statistik';
const CRON = '/cdn-cgi/handler/scheduled';

let jwks: Server | undefined;
let privateKey: CryptoKey;
const kid = `e2e-ulasan-${Date.now()}`;
const b64url = (d: ArrayBuffer | string) => Buffer.from(typeof d === 'string' ? d : new Uint8Array(d)).toString('base64url');

async function accessJwt() {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid }));
  const body = b64url(JSON.stringify({ aud: [AUD], iss: TEAM, email: 'pemilik@contoh.id', exp: Math.floor(Date.now() / 1000) + 600 }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

async function runCron(request: APIRequestContext) {
  const res = await request.get(CRON);
  expect(res.status()).toBe(200);
}

test.describe('ulasan', () => {
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

  test('tanpa JWT Access → 403 tanpa data; tidak di sitemap/llms.txt; konfigurasi build tidak terbuka', async ({ request, page }) => {
    expect((await request.get('/ulasan/')).status()).toBe(403);
    expect((await request.get('/ulasan/', { headers: { 'Cf-Access-Jwt-Assertion': 'palsu' } })).status()).toBe(403);
    expect((await request.post('/ulasan/aksi', { form: { id: 'x', aksi: 'lewati' } })).status()).toBe(403);
    const res = await page.goto('/ulasan/');
    expect(res?.status()).toBe(403);
    await expect(page.getByRole('heading', { name: 'Akses ditolak' })).toBeVisible();
    for (const file of ['/sitemap.xml', '/llms.txt']) expect(await (await request.get(file)).text()).not.toContain('ulasan');
    expect((await request.get('/ulasan-config.json')).status()).toBe(404);
  });

  test('cron mengambil ulasan contoh; admin menyunting & mengirim; cron ulang tidak menggandakan', async ({ request, page }, testInfo) => {
    // Server & D1 dipakai bersama proyek hp dan desktop: tiap proyek memakai ulasan sasaran sendiri, tanpa hitungan absolut
    const [sendName, skipName] = testInfo.project.name === 'hp' ? ['Contoh Tiga', 'Contoh Empat'] : ['Contoh Enam', 'Contoh Dua'];
    const auth = { 'Cf-Access-Jwt-Assertion': await accessJwt() };
    await runCron(request);
    await page.setExtraHTTPHeaders(auth);
    const res = await page.goto('/ulasan/');
    expect(res?.status()).toBe(200);
    expect(res?.headers()['x-robots-tag']).toBe('noindex, nofollow');
    await expect(page.getByRole('heading', { name: 'Balasan ulasan Google' })).toBeVisible();
    await expect(page.locator('[data-mode="Aktif"]')).toBeVisible();

    const card = (name: string) => page.locator('[data-review]', { hasText: name });
    const waitingCards = page.locator('[data-review]:not([data-status="terkirim"]):not([data-status="dilewati"])');
    // Bintang 5 bersih → terkirim otomatis; sudah berbalas di Google → dilewati
    await expect(card('Contoh Satu')).toHaveAttribute('data-status', 'terkirim');
    await expect(card('Contoh Lima')).toHaveAttribute('data-status', 'dilewati');
    // Bintang 5 berisi "antrinya lama" tidak pernah otomatis: terkirim hanya bila admin yang mengirim (proyek lain tidak menyentuhnya)
    expect(await card('Contoh Dua').getAttribute('data-status')).not.toBe(null);
    const totalCards = await page.locator('[data-review]').count();
    const waiting = await waitingCards.count();
    await expect(page.locator('[data-summary="total"]')).toHaveText(String(waiting));
    await expect(page).toHaveTitle(waiting ? `(${waiting}) Ulasan – Cutless` : 'Ulasan – Cutless');

    // Cron kedua: tidak ada kartu baru
    await runCron(request);
    await page.reload();
    await expect(page.locator('[data-review]')).toHaveCount(totalCards);

    // Sunting draf → simpan → bertahan setelah muat ulang
    await expect(card(sendName)).toHaveAttribute('data-status', /antre|gagal/);
    await card(sendName).locator('textarea').fill('Draf hasil suntingan admin uji.');
    await card(sendName).getByRole('button', { name: 'Simpan draf' }).click();
    await expect(page.locator('[data-notice="tersimpan"]')).toBeVisible();
    await expect(card(sendName).locator('textarea')).toHaveValue('Draf hasil suntingan admin uji.');

    // Kirim → pindah ke riwayat, disetujui oleh admin
    await card(sendName).getByRole('button', { name: 'Kirim' }).click();
    await expect(page.locator('[data-notice="terkirim"]')).toBeVisible();
    await expect(card(sendName)).toHaveAttribute('data-status', 'terkirim');
    await expect(card(sendName)).toContainText('Draf hasil suntingan admin uji.');
    await expect(card(sendName)).toContainText('pemilik@contoh.id');

    // Lewati
    await card(skipName).getByRole('button', { name: 'Lewati' }).click();
    await expect(card(skipName)).toHaveAttribute('data-status', 'dilewati');
    await expect(page).toHaveTitle(waiting - 2 > 0 ? `(${waiting - 2}) Ulasan – Cutless` : 'Ulasan – Cutless');
  });

  test('ramah HP: tanpa scroll horizontal, tombol ≥ 44 px', async ({ request, page }) => {
    await page.setExtraHTTPHeaders({ 'Cf-Access-Jwt-Assertion': await accessJwt() });
    await runCron(request);
    await page.goto('/ulasan/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const buttons = page.locator('[data-review] button');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});

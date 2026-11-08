/**
 * Jam yang bisa diatur untuk tes e2e statistik klik WA (worker/clock.ts): hanya Worker uji (var E2E_CLOCK=1 di
 * `npm run e2e:server`) yang membaca header x-e2e-now (epoch ms); produksi/staging mengabaikannya. Tes ini memastikan
 * (1) aturan itu, (2) hari yang tercatat (dayWIB) & rentang /statistik/ mengikuti jam itu sehingga tes e2e bisa memalsukan
 * 23.59 → 00.01 WIB, dan (3) helper CSV tes menjumlahkan semua baris hari (satu klik yang sama bisa jadi dua baris per hari).
 * Data uji tetap, bukan data CMS.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { dayWIB, WA_CLICK_ENDPOINT, type WaClickAllowlist } from '../src/content/waClicks';
import { resetAccessCache } from '../worker/access';
import { E2E_NOW_HEADER, nowOf } from '../worker/clock';
import type { Env } from '../worker/env';
import { handleStats } from '../worker/stats';
import { handleWaClick, resetAllowlistCache } from '../worker/waClicks';
import { clicksInCsv } from './helpers/waCsv';
import { testD1 } from './helpers/d1';

const ORIGIN = 'https://situs-uji.example';
const ALLOW: WaClickAllowlist = { branches: { cibubur: 'Cibubur' }, barbers: { 'barber-uji': 'Barber Uji' }, pages: ['/'] };
const CLICK = { k: 'kapster', b: 'cibubur', s: 'barber-uji', p: '/', r: 'www.tiktok.com' };
/** 15 Juni 2099, 23.59 WIB dan semenit sesudah tengah malam (16 Juni, 00.01 WIB) */
const T2359 = Date.parse('2099-06-15T23:59:30+07:00');
const T0001 = Date.parse('2099-06-16T00:01:00+07:00');

const req = (headers: Record<string, string> = {}) => new Request('https://situs-uji.example/x', { headers });

describe('nowOf', () => {
  it('E2E_CLOCK=1 + header angka valid → waktu dari header', () => {
    expect(nowOf(req({ [E2E_NOW_HEADER]: String(T2359) }), { E2E_CLOCK: '1' } as Env)).toBe(T2359);
  });

  it('tanpa E2E_CLOCK (produksi/staging) atau nilainya bukan "1" → header diabaikan, jam sungguhan', () => {
    for (const env of [{}, { E2E_CLOCK: '0' }, { E2E_CLOCK: 'true' }, { E2E_CLOCK: '' }]) {
      const before = Date.now();
      const now = nowOf(req({ [E2E_NOW_HEADER]: String(T2359) }), env as Env);
      expect(now, JSON.stringify(env)).toBeGreaterThanOrEqual(before);
      expect(now).toBeLessThanOrEqual(Date.now());
    }
  });

  it('header tidak valid → jam sungguhan', () => {
    for (const bad of ['', 'abc', '0', '-5', 'NaN', 'Infinity']) {
      const before = Date.now();
      expect(nowOf(req({ [E2E_NOW_HEADER]: bad }), { E2E_CLOCK: '1' } as Env), JSON.stringify(bad)).toBeGreaterThanOrEqual(before);
    }
    expect(nowOf(req(), { E2E_CLOCK: '1' } as Env)).toBeGreaterThan(0);
  });
});

function clickEnv(flag?: string) {
  const { d1, db } = testD1();
  const env = { ASSETS: { fetch: async (r: Request) => (new URL(r.url).pathname === '/klik-wa.json' ? Response.json(ALLOW) : new Response('', { status: 404 })) }, DB: d1, ALLOWED_ORIGINS: ORIGIN, ...(flag ? { E2E_CLOCK: flag } : {}) } as Env;
  return { env, db };
}
const postClick = (env: Env, headers: Record<string, string> = {}) =>
  handleWaClick(new Request(`${ORIGIN}${WA_CLICK_ENDPOINT}`, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'text/plain', ...headers }, body: JSON.stringify(CLICK) }), env);
const days = (db: ReturnType<typeof testD1>['db']) => (db.prepare('SELECT day, clicks FROM wa_clicks ORDER BY day').all() as { day: string; clicks: number }[]).map((r) => `${r.day}:${r.clicks}`);

describe('hari klik mengikuti jam yang diatur (handleWaClick)', () => {
  beforeEach(() => resetAllowlistCache());

  it('E2E_CLOCK=1: klik 23.59 WIB → hari itu, klik 00.01 WIB → hari berikutnya (dua baris untuk kunci yang sama)', async () => {
    const { env, db } = clickEnv('1');
    for (const t of [T2359, T2359, T2359, T0001, T0001, T0001]) expect((await postClick(env, { [E2E_NOW_HEADER]: String(t) })).status).toBe(204);
    expect(days(db)).toEqual(['2099-06-15:3', '2099-06-16:3']);
  });

  it('tanpa E2E_CLOCK: header diabaikan, hari = hari sungguhan (WIB)', async () => {
    const { env, db } = clickEnv();
    const before = dayWIB(Date.now());
    await postClick(env, { [E2E_NOW_HEADER]: String(T2359) });
    const after = dayWIB(Date.now());
    expect([`${before}:1`, `${after}:1`]).toContain(days(db)[0]);
  });
});

describe('rentang /statistik/ mengikuti jam yang diatur (handleStats)', () => {
  const AUD = 'aud-uji';
  const TEAM = 'https://tim-uji.cloudflareaccess.com';
  const b64url = (d: ArrayBuffer | string) => Buffer.from(typeof d === 'string' ? d : new Uint8Array(d)).toString('base64url');
  let keys: CryptoKeyPair;
  let jwks: { keys: JsonWebKey[] };
  beforeAll(async () => {
    keys = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    jwks = { keys: [{ ...(await crypto.subtle.exportKey('jwk', keys.publicKey)), kid: 'k1' } as JsonWebKey] };
  });
  beforeEach(() => {
    resetAccessCache();
    resetAllowlistCache();
  });
  /** JWT berlaku menurut jam SUNGGUHAN (header x-e2e-now tidak boleh memengaruhi verifikasi Access) */
  const jwt = async () => {
    const head = b64url(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' }));
    const body = b64url(JSON.stringify({ aud: [AUD], iss: TEAM, exp: Date.now() / 1000 + 600, iat: Date.now() / 1000 - 10 }));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(`${head}.${body}`));
    return `${head}.${body}.${b64url(sig)}`;
  };
  const csvAt = async (flag: string | undefined, now: number | undefined) => {
    const { env, db } = clickEnv(flag);
    db.prepare('INSERT INTO wa_clicks (day, kind, branch, barber, page, source, clicks) VALUES (?, ?, ?, ?, ?, ?, ?)').run('2099-06-15', 'kapster', 'cibubur', 'barber-uji', '/', 'tiktok', 3);
    const withAccess = { ...env, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD } as Env;
    const headers: Record<string, string> = { 'Cf-Access-Jwt-Assertion': await jwt() };
    if (now) headers[E2E_NOW_HEADER] = String(now);
    const res = await handleStats(new Request(`${ORIGIN}/statistik/?format=csv`, { headers }), withAccess, { accessFetcher: async (u) => (u === `${TEAM}/cdn-cgi/access/certs` ? Response.json(jwks) : new Response('', { status: 404 })) });
    return { status: res.status, csv: await res.text() };
  };

  it('E2E_CLOCK=1: "hari ini" = hari dari header → data 2099 masuk rentang 30 hari terakhir; JWT tetap diperiksa dengan jam sungguhan', async () => {
    const r = await csvAt('1', T0001);
    expect(r.status).toBe(200);
    expect(clicksInCsv(r.csv, { kind: 'Booking kapster', barber: 'Barber Uji', source: 'TikTok' })).toBe(3);
  });

  it('tanpa E2E_CLOCK: header diabaikan → rentang berakhir hari sungguhan, data 2099 tidak ikut', async () => {
    const r = await csvAt(undefined, T0001);
    expect(r.status).toBe(200);
    expect(clicksInCsv(r.csv, { kind: 'Booking kapster', barber: 'Barber Uji', source: 'TikTok' })).toBe(0);
  });
});

describe('clicksInCsv (helper tes e2e)', () => {
  const head = '"tanggal","jenis_tombol","cabang","kapster","halaman","asal_kunjungan","klik"';
  const row = (day: string, kind: string, barber: string, source: string, n: number) => `"${day}","${kind}","Cibubur","${barber}","/","${source}","${n}"`;
  const csv = (rows: string[]) => `${String.fromCharCode(0xfeff)}${[head, ...rows].join('\r\n')}\r\n`;

  it('menjumlahkan SEMUA baris yang cocok, lintas hari (bukan hanya baris pertama)', () => {
    const c = csv([row('2099-06-15', 'Booking kapster', 'Barber Uji', 'TikTok', 3), row('2099-06-16', 'Booking kapster', 'Barber Uji', 'TikTok', 3)]);
    expect(clicksInCsv(c, { kind: 'Booking kapster', barber: 'Barber Uji', source: 'TikTok' })).toBe(6);
  });

  it('hanya baris yang cocok jenis/kapster/asal; filter hari opsional; tanpa baris = 0', () => {
    const c = csv([
      row('2099-06-15', 'Booking kapster', 'Barber Uji', 'TikTok', 3),
      row('2099-06-16', 'Booking kapster', 'Barber Uji', 'TikTok', 4),
      row('2099-06-16', 'Booking kapster', 'Barber Lain', 'TikTok', 9),
      row('2099-06-16', 'Booking kapster', 'Barber Uji', 'Instagram', 9),
      row('2099-06-16', 'Tombol cabang', 'Barber Uji', 'TikTok', 9),
    ]);
    const m = { kind: 'Booking kapster', barber: 'Barber Uji', source: 'TikTok' };
    expect(clicksInCsv(c, m)).toBe(7);
    expect(clicksInCsv(c, { ...m, day: '2099-06-16' })).toBe(4);
    expect(clicksInCsv(csv([]), m)).toBe(0);
    expect(clicksInCsv('', m)).toBe(0);
  });
});

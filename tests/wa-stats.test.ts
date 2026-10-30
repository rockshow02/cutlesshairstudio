/**
 * /statistik/: hanya dengan JWT Cloudflare Access yang valid (diverifikasi Worker sendiri: tanda tangan RS256, aud, iss,
 * kedaluwarsa), angka dari data uji D1 benar (7/30 hari, per cabang/jenis/kapster/halaman/asal, harian), rentang tanggal,
 * ekspor CSV, noindex & tidak di-cache. Kunci RSA dibuat di tes; daftar kunci Access tiruan (tanpa jaringan).
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { WaClickAllowlist } from '../src/content/waClicks';
import { resetAccessCache, teamOrigin, verifyAccessJwt } from '../worker/access';
import type { Env } from '../worker/env';
import { addDays, handleStats, parseRange, summarize, type ClickRecord } from '../worker/stats';
import { resetAllowlistCache } from '../worker/waClicks';
import { testD1 } from './helpers/d1';

const TEAM = 'https://tim-uji.cloudflareaccess.com';
const AUD = 'aud-statistik-uji';
const NOW = Date.UTC(2026, 9, 30, 5); // 30 Okt 2026 12:00 WIB
const TODAY = '2026-10-30';
const ALLOW: WaClickAllowlist = { branches: { cibubur: 'Cibubur', 'bogor-bantarjati': 'Bogor Bantarjati' }, barbers: { 'barber-uji': 'Barber Uji' }, pages: ['/', '/cabang/cibubur/'] };

const b64url = (data: ArrayBuffer | Uint8Array | string) =>
  Buffer.from(typeof data === 'string' ? data : data instanceof Uint8Array ? data : new Uint8Array(data)).toString('base64url');

let keys: CryptoKeyPair;
let otherKeys: CryptoKeyPair;
let jwks: { keys: JsonWebKey[] };

async function sign(payload: Record<string, unknown>, opts: { kid?: string; key?: CryptoKey; alg?: string } = {}) {
  const head = b64url(JSON.stringify({ alg: opts.alg ?? 'RS256', kid: opts.kid ?? 'kunci-1', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', opts.key ?? keys.privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}
const claims = (over: Record<string, unknown> = {}) => ({ aud: [AUD], iss: TEAM, email: 'owner@contoh.id', exp: NOW / 1000 + 600, iat: NOW / 1000 - 10, ...over });

const fetcher = async (url: string) => (url === `${TEAM}/cdn-cgi/access/certs` ? Response.json(jwks) : new Response('', { status: 404 }));
const opts = { teamDomain: TEAM, aud: AUD, now: NOW, fetcher };

beforeAll(async () => {
  const gen = () => crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as Promise<CryptoKeyPair>;
  [keys, otherKeys] = await Promise.all([gen(), gen()]);
  jwks = { keys: [{ ...(await crypto.subtle.exportKey('jwk', keys.publicKey)), kid: 'kunci-1' } as JsonWebKey] };
});
beforeEach(() => {
  resetAccessCache();
  resetAllowlistCache();
});

describe('verifikasi JWT Cloudflare Access', () => {
  it('JWT valid → diterima (aud string atau array, team domain tanpa https://)', async () => {
    expect(await verifyAccessJwt(await sign(claims()), opts)).toBe(true);
    expect(await verifyAccessJwt(await sign(claims({ aud: AUD })), opts)).toBe(true);
    expect(await verifyAccessJwt(await sign(claims()), { ...opts, teamDomain: 'tim-uji.cloudflareaccess.com/' })).toBe(true);
    expect(teamOrigin('tim-uji.cloudflareaccess.com')).toBe(TEAM);
  });

  it.each([
    ['aud lain (aplikasi Access lain)', () => sign(claims({ aud: ['aud-lain'] }))],
    ['iss lain (tim Access lain)', () => sign(claims({ iss: 'https://tim-lain.cloudflareaccess.com' }))],
    ['kedaluwarsa', () => sign(claims({ exp: NOW / 1000 - 1 }))],
    ['tanpa exp', () => sign(claims({ exp: undefined }))],
    ['belum berlaku (nbf)', () => sign(claims({ nbf: NOW / 1000 + 3600 }))],
    ['ditandatangani kunci lain', () => sign(claims(), { key: otherKeys.privateKey })],
    ['kid tak dikenal', () => sign(claims(), { kid: 'kunci-palsu' })],
    ['alg none', async () => `${b64url(JSON.stringify({ alg: 'none', kid: 'kunci-1' }))}.${b64url(JSON.stringify(claims()))}.`],
    ['isi diubah setelah ditandatangani', async () => {
      const [h, , s] = (await sign(claims())).split('.');
      return `${h}.${b64url(JSON.stringify(claims({ email: 'penyusup@contoh.id' })))}.${s}`;
    }],
    ['bukan JWT', async () => 'bukan.jwt'],
    ['kosong', async () => ''],
  ])('ditolak: %s', async (_label, token) => {
    expect(await verifyAccessJwt(await token(), opts)).toBe(false);
  });

  it('variabel ACCESS_TEAM_DOMAIN / ACCESS_AUD kosong → selalu ditolak', async () => {
    const token = await sign(claims());
    expect(await verifyAccessJwt(token, { ...opts, aud: '' })).toBe(false);
    expect(await verifyAccessJwt(token, { ...opts, teamDomain: '' })).toBe(false);
  });

  it('daftar kunci Access tidak bisa diambil → ditolak', async () => {
    expect(await verifyAccessJwt(await sign(claims()), { ...opts, fetcher: async () => new Response('', { status: 500 }) })).toBe(false);
    expect(await verifyAccessJwt(await sign(claims()), { ...opts, fetcher: async () => { throw new Error('jaringan'); } })).toBe(false);
  });
});

/* ---------- Data uji ---------- */

const rec = (day: string, kind: string, branch: string, page: string, source: string, clicks: number, barber = ''): ClickRecord => ({ day, kind, branch, barber, page, source, clicks });
const DATA: ClickRecord[] = [
  rec(TODAY, 'cabang', 'cibubur', '/cabang/cibubur/', 'google', 5),
  rec(TODAY, 'kapster', 'cibubur', '/', 'instagram', 2, 'barber-uji'),
  rec(addDays(TODAY, -3), 'umum', 'bogor-bantarjati', '/', 'langsung', 4),
  rec(addDays(TODAY, -6), 'tips', '', 'lainnya', 'lainnya', 1),
  // Di luar 7 hari, masih dalam 30 hari
  rec(addDays(TODAY, -10), 'umum', 'cibubur', '/', 'google', 10),
  // Di luar 30 hari
  rec(addDays(TODAY, -40), 'umum', 'cibubur', '/', 'google', 100),
];

function statsEnv(withData = true): Env {
  const { d1, db } = testD1();
  const insert = db.prepare('INSERT INTO wa_clicks (day, kind, branch, barber, page, source, clicks) VALUES (?, ?, ?, ?, ?, ?, ?)');
  if (withData) for (const r of DATA) insert.run(r.day, r.kind, r.branch, r.barber, r.page, r.source, r.clicks);
  return {
    ASSETS: { fetch: async (req: Request) => (new URL(req.url).pathname === '/klik-wa.json' ? Response.json(ALLOW) : new Response('', { status: 404 })) },
    DB: d1,
    ACCESS_TEAM_DOMAIN: TEAM,
    ACCESS_AUD: AUD,
  };
}
const get = async (path: string, env: Env, token?: string) =>
  handleStats(new Request(`https://situs-uji.example${path}`, { headers: token ? { 'Cf-Access-Jwt-Assertion': token } : {} }), env, { now: NOW, accessFetcher: fetcher });

describe('/statistik/', () => {
  it('tanpa JWT / JWT salah → 403 (walau aturan Access lupa dipasang), tanpa data', async () => {
    const env = statsEnv();
    for (const token of [undefined, 'palsu', await sign(claims({ aud: ['aud-lain'] }))]) {
      const res = await get('/statistik/', env, token);
      expect(res.status).toBe(403);
      const body = await res.text();
      expect(body).toContain('Akses ditolak');
      expect(body).not.toContain('Cibubur');
    }
    expect((await get('/statistik/?format=csv', env)).status).toBe(403);
  });

  it('JWT valid → 200, noindex, tidak di-cache, angka benar dari data uji', async () => {
    const res = await get('/statistik/', statsEnv(), await sign(claims()));
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const html = await res.text();
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(html).toContain('<b data-stat="last7">12</b>');
    expect(html).toContain('<b data-stat="last30">22</b>');
    // Default 30 hari terakhir
    expect(html).toContain('<b data-stat="total">22</b>');
    expect(html).toContain('1 Okt 2026 – 30 Okt 2026'); // awal & akhir rentang
    const section = (id: string) => html.match(new RegExp(`data-table="${id}">[\\s\\S]*?</section>`))![0];
    expect(section('cabang')).toMatch(/Cibubur<span[^>]*><\/span><\/td><td class="n">17<\/td>/);
    expect(section('cabang')).toMatch(/Bogor Bantarjati<span[^>]*><\/span><\/td><td class="n">4<\/td>/);
    expect(section('cabang')).toMatch(/Nomor pusat \(tanpa cabang\)<span[^>]*><\/span><\/td><td class="n">1<\/td>/);
    expect(section('jenis')).toMatch(/Booking umum<span[^>]*><\/span><\/td><td class="n">14<\/td>/);
    expect(section('kapster')).toMatch(/Barber Uji<span[^>]*><\/span><\/td><td class="n">2<\/td>/);
    expect(section('asal')).toMatch(/Google<span[^>]*><\/span><\/td><td class="n">15<\/td>/);
    expect(section('halaman')).toMatch(/Halaman lain<span[^>]*><\/span><\/td><td class="n">1<\/td>/);
    // Tanpa JavaScript
    expect(html).not.toMatch(/<script/i);
  });

  it('filter rentang tanggal & grafik harian (hari kosong = 0)', async () => {
    const from = addDays(TODAY, -6);
    const html = await (await get(`/statistik/?dari=${from}&sampai=${TODAY}`, statsEnv(), await sign(claims()))).text();
    expect(html).toContain('<b data-stat="total">12</b>');
    expect(html.match(/<rect /g)).toHaveLength(7);
    expect(html).toContain('<title>30 Okt 2026: 7 klik</title>');
    expect(html).toContain('<title>29 Okt 2026: 0 klik</title>');
    expect(html).toContain(`value="${from}"`);
  });

  it('ekspor CSV rentang yang dipilih (nama cabang/kapster, aman dibuka di Excel)', async () => {
    const res = await get(`/statistik/?dari=${addDays(TODAY, -3)}&sampai=${TODAY}&format=csv`, statsEnv(), await sign(claims()));
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('Content-Disposition')).toBe(`attachment; filename="klik-wa_${addDays(TODAY, -3)}_${TODAY}.csv"`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM: Excel membaca UTF-8
    const lines = new TextDecoder().decode(bytes).trim().split('\r\n');
    expect(lines).toEqual([
      '"tanggal","jenis_tombol","cabang","kapster","halaman","asal_kunjungan","klik"',
      `"${addDays(TODAY, -3)}","Booking umum","Bogor Bantarjati","","/","Langsung / aplikasi","4"`,
      `"${TODAY}","Tombol cabang","Cibubur","","/cabang/cibubur/","Google","5"`,
      `"${TODAY}","Booking kapster","Cibubur","Barber Uji","/","Instagram","2"`,
    ]);
  });

  it('database kosong → "Belum ada data"; belum terhubung → 503', async () => {
    const empty = await (await get('/statistik/', statsEnv(false), await sign(claims()))).text();
    expect(empty).toContain('<b data-stat="total">0</b>');
    expect(empty).toContain('Belum ada data.');
    const res = await get('/statistik/', { ...statsEnv(), DB: undefined }, await sign(claims()));
    expect(res.status).toBe(503);
  });

  it('/statistik (tanpa garis miring) → 301 ke /statistik/ setelah lolos Access', async () => {
    const res = await get('/statistik?dari=2026-10-01', statsEnv(), await sign(claims()));
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://situs-uji.example/statistik/?dari=2026-10-01');
  });
});

describe('parseRange & summarize', () => {
  const url = (q: string) => new URL(`https://x.example/statistik/?${q}`);
  it('default 30 hari; terbalik ditukar; > 366 hari dipotong; tanggal tidak valid diabaikan', () => {
    expect(parseRange(url(''), TODAY)).toEqual({ from: addDays(TODAY, -29), to: TODAY });
    expect(parseRange(url('dari=2026-10-30&sampai=2026-10-01'), TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-30' });
    expect(parseRange(url('dari=2020-01-01&sampai=2026-10-30'), TODAY).from).toBe(addDays(TODAY, -365));
    expect(parseRange(url('dari=2026-02-31&sampai=abc'), TODAY)).toEqual({ from: addDays(TODAY, -29), to: TODAY });
  });

  it('kapster kosong tidak dihitung di tabel kapster; urutan terbanyak dulu', () => {
    const s = summarize(DATA.slice(0, 5), DATA, { from: addDays(TODAY, -29), to: TODAY }, TODAY, ALLOW);
    expect(s.byBarber).toEqual([{ key: 'barber-uji', label: 'Barber Uji', clicks: 2 }]);
    expect(s.byBranch.map((r) => r.clicks)).toEqual([17, 4, 1]);
    expect(s.daily).toHaveLength(30);
  });
});

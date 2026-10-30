/**
 * Hitungan klik WhatsApp: validasi kiriman (hanya nilai dari daftar yang diizinkan), endpoint Worker POST /api/klik-wa
 * (Origin, ukuran, 204, UPSERT penghitung harian di D1 tiruan), dan pencatat di browser (sendBeacon → fetch keepalive,
 * tidak pernah melempar error). Data uji tetap, bukan data CMS.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { barberKey, dayWIB, normalizePage, referrerSource, validateWaClick, WA_CLICK_ENDPOINT, type WaClickAllowlist } from '../src/content/waClicks';
import { contextFor, rememberLanding, rememberWaClick, sendWaClick, waClickPayload } from '../src/lib/waClickTracking';
import { handleWaClick, recordClick, resetAllowlistCache } from '../worker/waClicks';
import type { Env } from '../worker/env';
import worker from '../worker/index';
import { testD1 } from './helpers/d1';

const ALLOW: WaClickAllowlist = {
  branches: { cibubur: 'Cibubur', 'bogor-bantarjati': 'Bogor Bantarjati' },
  barbers: { 'barber-uji': 'Barber Uji' },
  pages: ['/', '/cabang/', '/cabang/cibubur/', '/tips/cara-uji/'],
};
const ORIGIN = 'https://situs-uji.example';
const valid = { k: 'cabang', b: 'cibubur', p: '/cabang/cibubur/', r: 'www.google.co.id' };

function env(overrides: Partial<Env> = {}) {
  const { d1, db } = testD1();
  const assets = vi.fn(async (req: Request) =>
    new URL(req.url).pathname === '/klik-wa.json' ? Response.json(ALLOW) : new Response('aset', { status: 200 }),
  );
  return { db, env: { ASSETS: { fetch: assets }, DB: d1, ALLOWED_ORIGINS: `${ORIGIN}, https://www.situs-uji.example`, ...overrides } as Env };
}

const post = (body: unknown, headers: Record<string, string> = { Origin: ORIGIN }, method = 'POST') =>
  new Request(`${ORIGIN}${WA_CLICK_ENDPOINT}`, { method, headers: { 'Content-Type': 'text/plain', ...headers }, body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined });

const rows = (db: ReturnType<typeof testD1>['db']) => db.prepare('SELECT * FROM wa_clicks ORDER BY kind, page, source').all();

beforeEach(() => resetAllowlistCache());

describe('validateWaClick', () => {
  it('kiriman valid → baris dengan kelompok asal kunjungan', () => {
    expect(validateWaClick(valid, ALLOW)).toEqual({ kind: 'cabang', branch: 'cibubur', barber: '', page: '/cabang/cibubur/', source: 'google' });
    expect(validateWaClick({ k: 'kapster', b: 'cibubur', s: 'barber-uji', p: '/' }, ALLOW)).toMatchObject({ barber: 'barber-uji', source: 'langsung' });
    expect(validateWaClick({ k: 'umum', p: '/cabang/cibubur' }, ALLOW)?.page).toBe('/cabang/cibubur/');
  });

  it('halaman tak dikenal → "lainnya"; asal kunjungan tak dikenal → "lainnya"', () => {
    expect(validateWaClick({ k: 'umum', p: '/halaman-baru/', r: 'blog.contoh.id' }, ALLOW)).toMatchObject({ page: 'lainnya', source: 'lainnya' });
  });

  it.each([
    ['bukan objek', 'teks'],
    ['array', [valid]],
    ['jenis tombol tak dikenal', { ...valid, k: 'iklan' }],
    ['cabang tak dikenal', { ...valid, b: 'jakarta' }],
    ['kapster tak dikenal', { k: 'kapster', s: 'orang-lain', p: '/' }],
    ['kapster tanpa nama', { k: 'kapster', p: '/' }],
    ['kunci tambahan (mis. nomor HP / isi pesan)', { ...valid, nomor: '628123456789' }],
    ['nilai bukan teks', { ...valid, b: 123 }],
    ['path tidak diawali /', { ...valid, p: 'https://evil.example/' }],
    ['terlalu panjang', { ...valid, p: `/${'a'.repeat(300)}` }],
    ['__proto__', JSON.parse('{"k":"umum","p":"/","b":"__proto__"}')],
  ])('ditolak: %s', (_label, input) => {
    expect(validateWaClick(input, ALLOW)).toBeNull();
  });

  it('referrerSource, barberKey, normalizePage, dayWIB', () => {
    expect(referrerSource('l.instagram.com')).toBe('instagram');
    expect(referrerSource('m.facebook.com')).toBe('facebook');
    expect(referrerSource('www.google.com')).toBe('google');
    expect(referrerSource('notgoogle.com')).toBe('lainnya');
    expect(referrerSource('')).toBe('langsung');
    expect(referrerSource('<script>')).toBe('lainnya');
    expect(barberKey('Soemardi(erte)')).toBe('soemardi-erte');
    expect(barberKey('José Ñ')).toBe('jose-n');
    expect(normalizePage('/Cabang/Cibubur?x=1#a')).toBe('/cabang/cibubur/');
    // 23:30 WIB 31 Des = 16:30 UTC → tetap 31 Des; 00:30 WIB 1 Jan = 17:30 UTC 31 Des → 1 Jan
    expect(dayWIB(Date.UTC(2026, 11, 31, 16, 30))).toBe('2026-12-31');
    expect(dayWIB(Date.UTC(2026, 11, 31, 17, 30))).toBe('2027-01-01');
  });
});

describe('POST /api/klik-wa', () => {
  it('klik valid → 204 & penghitung harian; klik yang sama → UPSERT clicks + 1; kombinasi lain → baris baru', async () => {
    const t = env();
    for (let i = 0; i < 3; i++) expect((await worker.fetch(post(valid), t.env)).status).toBe(204);
    expect((await worker.fetch(post({ ...valid, r: 'l.instagram.com' }), t.env)).status).toBe(204);
    expect((await worker.fetch(post({ k: 'kapster', b: 'cibubur', s: 'barber-uji', p: '/' }, { Origin: 'https://www.situs-uji.example' }), t.env)).status).toBe(204);
    const today = dayWIB(Date.now());
    expect(rows(t.db)).toEqual([
      { day: today, kind: 'cabang', branch: 'cibubur', barber: '', page: '/cabang/cibubur/', source: 'google', clicks: 3 },
      { day: today, kind: 'cabang', branch: 'cibubur', barber: '', page: '/cabang/cibubur/', source: 'instagram', clicks: 1 },
      { day: today, kind: 'kapster', branch: 'cibubur', barber: 'barber-uji', page: '/', source: 'langsung', clicks: 1 },
    ]);
  });

  it('tabel tidak punya kolom IP, nomor HP, isi pesan, cookie, atau ID pengunjung', () => {
    const cols = (testD1().db.prepare("SELECT name FROM pragma_table_info('wa_clicks')").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(['day', 'kind', 'branch', 'barber', 'page', 'source', 'clicks']);
  });

  it('penghitung per hari WIB terpisah', async () => {
    const t = env();
    const row = validateWaClick(valid, ALLOW)!;
    await recordClick(t.env.DB!, row, Date.UTC(2026, 9, 29, 12));
    await recordClick(t.env.DB!, row, Date.UTC(2026, 9, 30, 12));
    await recordClick(t.env.DB!, row, Date.UTC(2026, 9, 30, 13));
    expect(t.db.prepare('SELECT day, clicks FROM wa_clicks ORDER BY day').all()).toEqual([
      { day: '2026-10-29', clicks: 1 },
      { day: '2026-10-30', clicks: 2 },
    ]);
  });

  it.each([
    ['Origin lain', { Origin: 'https://evil.example' }, 403],
    ['tanpa Origin', {} as Record<string, string>, 403],
    ['Origin mirip (subdomain palsu)', { Origin: 'https://situs-uji.example.evil.example' }, 403],
  ])('ditolak: %s → %i, tidak ada yang disimpan', async (_label, headers, status) => {
    const t = env();
    expect((await worker.fetch(post(valid, headers), t.env)).status).toBe(status);
    expect(rows(t.db)).toEqual([]);
  });

  it('selain POST → 405; kiriman > 512 byte → 413; bukan JSON / isian tidak valid → 400', async () => {
    const t = env();
    const get = await worker.fetch(post(null, { Origin: ORIGIN }, 'GET'), t.env);
    expect(get.status).toBe(405);
    expect(get.headers.get('Allow')).toBe('POST');
    expect((await worker.fetch(post({ ...valid, r: 'x'.repeat(600) }), t.env)).status).toBe(413);
    expect((await worker.fetch(post('{bukan json'), t.env)).status).toBe(400);
    expect((await worker.fetch(post({ ...valid, b: 'jakarta' }), t.env)).status).toBe(400);
    expect(rows(t.db)).toEqual([]);
  });

  it('database belum terhubung / daftar tidak ada → 503 (tidak error)', async () => {
    expect((await handleWaClick(post(valid), env({ DB: undefined }).env)).status).toBe(503);
    resetAllowlistCache();
    const noList = env({ ASSETS: { fetch: async () => new Response('tidak ada', { status: 404 }) } });
    expect((await handleWaClick(post(valid), noList.env)).status).toBe(503);
  });

  it('rute lain tetap dilayani file statis', async () => {
    const t = env();
    const res = await worker.fetch(new Request(`${ORIGIN}/cabang/`), t.env);
    expect(await res.text()).toBe('aset');
  });
});

describe('pencatat di browser', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sendBeacon dipakai bila tersedia (tanpa fetch)', () => {
    const sendBeacon = vi.fn(() => true);
    const fetchFn = vi.fn();
    vi.stubGlobal('navigator', { sendBeacon });
    vi.stubGlobal('fetch', fetchFn);
    sendWaClick({ k: 'umum', p: '/' });
    expect(sendBeacon).toHaveBeenCalledWith(WA_CLICK_ENDPOINT, expect.any(Blob));
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('sendBeacon menolak / melempar error → fetch keepalive', () => {
    for (const sendBeacon of [vi.fn(() => false), vi.fn(() => { throw new Error('diblokir'); }), undefined]) {
      const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
      vi.stubGlobal('navigator', { sendBeacon });
      vi.stubGlobal('fetch', fetchFn);
      sendWaClick({ k: 'umum', p: '/' });
      expect(fetchFn).toHaveBeenCalledWith(WA_CLICK_ENDPOINT, expect.objectContaining({ method: 'POST', keepalive: true, body: '{"k":"umum","p":"/"}' }));
    }
  });

  it('semua cara kirim gagal → tidak melempar error', async () => {
    vi.stubGlobal('navigator', { sendBeacon: () => { throw new Error('x'); } });
    vi.stubGlobal('fetch', () => Promise.reject(new Error('jaringan putus')));
    expect(() => sendWaClick({ k: 'umum', p: '/' })).not.toThrow();
    vi.stubGlobal('fetch', () => { throw new Error('sinkron'); });
    expect(() => sendWaClick({ k: 'umum', p: '/' })).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });

  it('kiriman hanya jenis, cabang, kapster, halaman, & host asal (tanpa nomor/pesan)', () => {
    const href = rememberWaClick('https://wa.me/628111111111?text=Halo%20cabang%20Cibubur', { kind: 'kapster', branch: 'cibubur', barber: 'barber-uji' });
    const payload = waClickPayload(contextFor(href, '/'), '/', 'www.google.com');
    expect(payload).toEqual({ k: 'kapster', b: 'cibubur', s: 'barber-uji', p: '/', r: 'www.google.com' });
    expect(JSON.stringify(payload)).not.toMatch(/628111111111|Halo/);
    expect(new TextEncoder().encode(JSON.stringify(payload)).length).toBeLessThan(200);
  });

  it('link identik dari beberapa tombol (navbar & hero cabang): jenis paling spesifik yang dicatat', () => {
    const href = 'https://wa.me/628222222222?text=Halo%20cabang%20Bogor';
    rememberWaClick(href, { kind: 'cabang', branch: 'bogor-bantarjati' });
    rememberWaClick(href, { kind: 'umum', branch: 'bogor-bantarjati' });
    expect(contextFor(href, '/')).toEqual({ kind: 'cabang', branch: 'bogor-bantarjati' });
    rememberWaClick(href, { kind: 'promo', branch: 'bogor-bantarjati' });
    expect(contextFor(href, '/').kind).toBe('promo');
  });

  it('link tanpa catatan: halaman cabang → tombol cabang, selain itu booking umum', () => {
    expect(contextFor('https://wa.me/6280000', '/cabang/cibubur/')).toEqual({ kind: 'cabang', branch: 'cibubur' });
    expect(contextFor('https://wa.me/6280000', '/')).toEqual({ kind: 'umum' });
  });

  it('asal kunjungan: referrer luar disimpan (host saja), pindah halaman di situs sendiri tidak mengubahnya', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    rememberLanding('https://www.google.com/search?q=barber+cibubur', 'situs-uji.example');
    expect(store.get('cutless:ref')).toBe('www.google.com');
    rememberLanding('https://situs-uji.example/cabang/', 'situs-uji.example');
    rememberLanding('', 'situs-uji.example');
    expect(store.get('cutless:ref')).toBe('www.google.com');
    store.clear();
    rememberLanding('', 'situs-uji.example');
    expect(store.get('cutless:ref')).toBe('');
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('diblokir'); }, setItem: () => undefined });
    expect(() => rememberLanding('https://www.google.com/', 'situs-uji.example')).not.toThrow();
  });
});

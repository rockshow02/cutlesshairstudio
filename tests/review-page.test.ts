import { readdirSync, readFileSync, statSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { reviewConfig } from '../scripts/vite-content-plugin';
import { REVIEW_CONFIG_PATH, type ReplyMode } from '../src/content/reviewReplies';
import { resetAccessCache } from '../worker/access';
import type { D1Database, Env } from '../worker/env';
import { resetReviewConfigCache } from '../worker/ulasan/config';
import { insertReview, type ReviewStatus } from '../worker/ulasan/db';
import { MockGbpClient } from '../worker/ulasan/gbp';
import { handleReviews } from '../worker/ulasan/page';
import { contentFixture } from './helpers/contentFixture';
import { testD1 } from './helpers/d1';

const TEAM = 'https://tim-uji.cloudflareaccess.com';
const AUD = 'aud-ulasan-uji';
const NOW = Date.UTC(2026, 10, 6, 5, 0, 0);
const ORIGIN = 'https://situs-uji.example';

const b64url = (data: ArrayBuffer | Uint8Array | string) => Buffer.from(typeof data === 'string' ? data : data instanceof Uint8Array ? data : new Uint8Array(data)).toString('base64url');
let keys: CryptoKeyPair;
let jwks: { keys: JsonWebKey[] };
async function sign(payload: Record<string, unknown>) {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}
const claims = (over: Record<string, unknown> = {}) => ({ aud: [AUD], iss: TEAM, email: 'pemilik@contoh.id', exp: NOW / 1000 + 600, iat: NOW / 1000 - 10, ...over });
const accessFetcher = async (url: string) => (url === `${TEAM}/cdn-cgi/access/certs` ? Response.json(jwks) : new Response('', { status: 404 }));

beforeAll(async () => {
  keys = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  jwks = { keys: [{ ...(await crypto.subtle.exportKey('jwk', keys.publicKey)), kid: 'k1' } as JsonWebKey] };
});

let ctx: ReturnType<typeof testD1>;
let prepared: number;
let client: MockGbpClient;
let mode: ReplyMode;

const makeEnv = (): Env => {
  const base = contentFixture();
  const config = reviewConfig({ ...base, settings: { ...base.settings, reviewReplyMode: mode } });
  const counting: D1Database = { prepare: (sql) => ((prepared += 1), ctx.d1.prepare(sql)) };
  return {
    ASSETS: { fetch: async (req: Request) => (new URL(req.url).pathname === REVIEW_CONFIG_PATH ? Response.json(config) : new Response('', { status: 404 })) },
    REVIEWS_DB: counting,
    ACCESS_TEAM_DOMAIN: TEAM,
    ACCESS_AUD: AUD,
  };
};

beforeEach(() => {
  resetAccessCache();
  resetReviewConfigCache();
  ctx = testD1('migrations-ulasan');
  prepared = 0;
  client = new MockGbpClient();
  mode = 'Aktif';
});

const seed = (id: string, over: { branch?: string; rating?: number; status?: ReviewStatus; reviewer?: string; reviewedAt?: string; draft?: string; createdAt?: number } = {}) =>
  insertReview(ctx.d1, { id, branch: over.branch ?? 'cibubur', reviewer: over.reviewer ?? 'Budi', rating: over.rating ?? 3, body: 'isi ulasan', reviewedAt: over.reviewedAt ?? '2026-11-05T10:00:00Z', status: over.status ?? 'antre', draft: over.draft ?? 'Terima kasih kak.' }, over.createdAt ?? NOW - 3_600_000);
const row = (id: string) => ctx.db.prepare('SELECT status, draft, approved_by FROM reviews WHERE id = ?').get(id) as { status: string; draft: string; approved_by: string | null };

const get = async (path = '/ulasan/', token: string | null | undefined = undefined, headers: Record<string, string> = {}) => {
  const jwt = token === undefined ? await sign(claims()) : token;
  const h = { ...(jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {}), ...headers };
  return handleReviews(new Request(`${ORIGIN}${path}`, { headers: h }), makeEnv(), { now: NOW, accessFetcher, client });
};
const post = async (fields: Record<string, string>, over: { token?: string | null; origin?: string | null; path?: string } = {}) => {
  const jwt = over.token === undefined ? await sign(claims()) : over.token;
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (jwt) headers['Cf-Access-Jwt-Assertion'] = jwt;
  if (over.origin !== null) headers.Origin = over.origin ?? ORIGIN;
  return handleReviews(new Request(`${ORIGIN}${over.path ?? '/ulasan/aksi'}`, { method: 'POST', headers, body: new URLSearchParams(fields).toString() }), makeEnv(), { now: NOW, accessFetcher, client });
};

describe('/ulasan/: akses', () => {
  it('tanpa JWT, aud salah, atau kedaluwarsa → 403 untuk GET dan POST, D1 tidak disentuh', async () => {
    await seed('r1');
    prepared = 0;
    const bad = [null, 'palsu', await sign(claims({ aud: ['lain'] })), await sign(claims({ exp: NOW / 1000 - 1 }))];
    for (const token of bad) {
      const res = await get('/ulasan/', token);
      expect(res.status).toBe(403);
      expect(await res.text()).not.toContain('Budi');
      expect((await post({ id: 'r1', aksi: 'lewati' }, { token })).status).toBe(403);
    }
    expect(prepared).toBe(0);
    expect(row('r1').status).toBe('antre');
  });

  it('variabel Access kosong → selalu 403', async () => {
    const env = { ...makeEnv(), ACCESS_TEAM_DOMAIN: '', ACCESS_AUD: '' };
    const res = await handleReviews(new Request(`${ORIGIN}/ulasan/`, { headers: { 'Cf-Access-Jwt-Assertion': await sign(claims()) } }), env, { now: NOW, accessFetcher, client });
    expect(res.status).toBe(403);
  });

  it('/ulasan → 301 ke /ulasan/; metode lain 405; jalur tak dikenal 404', async () => {
    const redirect = await get('/ulasan');
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get('Location')).toBe('/ulasan/');
    const del = await handleReviews(new Request(`${ORIGIN}/ulasan/`, { method: 'DELETE', headers: { 'Cf-Access-Jwt-Assertion': await sign(claims()) } }), makeEnv(), { now: NOW, accessFetcher, client });
    expect(del.status).toBe(405);
    expect((await get('/ulasan/lain/')).status).toBe(404);
    expect((await post({}, { path: '/ulasan/' })).status).toBe(405);
  });

  it('REVIEWS_DB tidak terpasang → 503 ramah', async () => {
    const env = { ...makeEnv(), REVIEWS_DB: undefined };
    const res = await handleReviews(new Request(`${ORIGIN}/ulasan/`, { headers: { 'Cf-Access-Jwt-Assertion': await sign(claims()) } }), env, { now: NOW, accessFetcher, client });
    expect(res.status).toBe(503);
  });
});

describe('/ulasan/: tampilan', () => {
  it('200, noindex, tanpa cache, tanpa JavaScript; antrean di atas riwayat; nama di-escape', async () => {
    await seed('r1', { reviewer: '<script>alert(1)</script>' });
    await seed('r2', { status: 'terkirim', reviewer: 'Sudah Dibalas' });
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    // no-referrer membuat browser mengirim 'Origin: null' pada form POST (admin sah ditolak pemeriksaan CSRF)
    expect(res.headers.get('Referrer-Policy')).toBe('same-origin');
    const html = await res.text();
    expect(html).toContain('<meta name="robots" content="noindex');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html.indexOf('Antrean')).toBeLessThan(html.indexOf('Riwayat'));
    expect(html.indexOf('&lt;script&gt;')).toBeLessThan(html.indexOf('Sudah Dibalas'));
  });

  it('ringkasan: antre per cabang, ulasan tertua, judul tab dengan jumlah antre', async () => {
    await seed('a', { branch: 'cibubur', reviewedAt: '2026-11-05T10:00:00Z' });
    await seed('b', { branch: 'bogor-bantarjati', reviewedAt: '2026-11-02T10:00:00Z', rating: 1 });
    await seed('c', { status: 'terkirim' });
    const html = await (await get()).text();
    expect(html).toContain('<title>(2) Ulasan – Cutless</title>');
    expect(html).toMatch(/data-summary="total"[^>]*>2</);
    expect(html).toMatch(/data-branch="cibubur"[^>]*>[\s\S]*?>1</);
    expect(html).toMatch(/data-branch="bogor-bantarjati"[^>]*>[\s\S]*?>1</);
    expect(html).toMatch(/data-summary="oldest"[^>]*>[\s\S]*?Bogor Bantarjati[\s\S]*?2 Nov 2026/);
  });

  it('tanpa antrean: judul tanpa angka dan pesan kosong', async () => {
    const html = await (await get()).text();
    expect(html).toContain('<title>Ulasan – Cutless</title>');
    expect(html).toMatch(/data-summary="oldest"[^>]*>[^<]*(Tidak ada|Belum ada)/);
  });

  it('banner mode: Uji menyebut tidak ada balasan terkirim ke Google', async () => {
    mode = 'Uji';
    expect(await (await get()).text()).toMatch(/Mode Uji[\s\S]*tidak ada balasan[\s\S]*Google/i);
  });
});

describe('/ulasan/: penanda Baru sejak kunjungan terakhir', () => {
  it('kunjungan pertama: tanpa penanda dan cookie dipasang', async () => {
    await seed('a');
    const res = await get();
    const html = await res.text();
    expect(html).not.toContain('data-new');
    const cookie = res.headers.get('Set-Cookie') ?? '';
    expect(cookie).toContain(`ulasan_terakhir=${NOW}`);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toContain('Path=/ulasan/');
  });

  it('dengan cookie: hanya ulasan yang dibuat setelahnya bertanda Baru', async () => {
    await seed('lama', { reviewer: 'Lama', createdAt: NOW - 10 * 3_600_000 });
    await seed('baru', { reviewer: 'Baru Datang', createdAt: NOW - 1_000 });
    const html = await (await get('/ulasan/', undefined, { Cookie: `ulasan_terakhir=${NOW - 3_600_000}` })).text();
    const cards = html.split('<article');
    expect(cards.find((c) => c.includes('Baru Datang'))).toContain('data-new');
    expect(cards.find((c) => c.includes('>Lama<'))).not.toContain('data-new');
  });

  it('cookie bukan angka diabaikan', async () => {
    await seed('a');
    const html = await (await get('/ulasan/', undefined, { Cookie: 'ulasan_terakhir=abc' })).text();
    expect(html).not.toContain('data-new');
  });
});

describe('/ulasan/aksi', () => {
  it('kirim (mode Aktif): terkirim, disetujui oleh email JWT, satu panggilan Google', async () => {
    await seed('r1');
    const res = await post({ id: 'r1', aksi: 'kirim', draf: 'Draf akhir admin.' });
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toMatch(/^\/ulasan\/\?s=terkirim#r-/);
    expect(row('r1')).toMatchObject({ status: 'terkirim', approved_by: 'pemilik@contoh.id', draft: 'Draf akhir admin.' });
    expect(client.replies).toEqual([{ reviewId: 'r1', text: 'Draf akhir admin.' }]);
  });

  it('mode Uji dan Mati: tombol Kirim tidak mengirim apa pun ke Google', async () => {
    await seed('r1');
    for (const m of ['Uji', 'Mati'] as const) {
      mode = m;
      resetReviewConfigCache();
      const res = await post({ id: 'r1', aksi: 'kirim', draf: 'Draf.' });
      expect(res.status).toBe(303);
      expect(res.headers.get('Location')).toContain('s=mode');
      expect(row('r1').status).toBe('antre');
    }
    expect(client.replies).toEqual([]);
    const html = await (await get('/ulasan/?s=mode')).text();
    expect(html).toContain('mode balasan ulasan belum Aktif');
  });

  it('kirim dua kali: balasan hanya satu', async () => {
    await seed('r1');
    await Promise.all([post({ id: 'r1', aksi: 'kirim', draf: 'Draf.' }), post({ id: 'r1', aksi: 'kirim', draf: 'Draf.' })]);
    expect(client.replies).toHaveLength(1);
  });

  it('Origin lain atau tanpa Origin → 403 tanpa efek (CSRF)', async () => {
    await seed('r1');
    expect((await post({ id: 'r1', aksi: 'kirim', draf: 'Draf.' }, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await post({ id: 'r1', aksi: 'kirim', draf: 'Draf.' }, { origin: null })).status).toBe(403);
    expect(row('r1').status).toBe('antre');
    expect(client.replies).toEqual([]);
  });

  it('simpan: draf valid tersimpan; draf 4.097 karakter, kosong, atau berisi {nama} → 422 tanpa perubahan', async () => {
    await seed('r1');
    expect((await post({ id: 'r1', aksi: 'simpan', draf: 'Draf baru.' })).status).toBe(303);
    expect(row('r1').draft).toBe('Draf baru.');
    for (const draf of ['a'.repeat(4097), '  ', 'Halo {nama}']) {
      expect((await post({ id: 'r1', aksi: 'simpan', draf })).status).toBe(422);
    }
    expect(row('r1').draft).toBe('Draf baru.');
  });

  it('lewati: status dilewati dan tidak ada kiriman; yang sudah terkirim tidak bisa dilewati', async () => {
    await seed('r1');
    await seed('r2', { status: 'terkirim' });
    expect((await post({ id: 'r1', aksi: 'lewati' })).status).toBe(303);
    expect(row('r1').status).toBe('dilewati');
    await post({ id: 'r2', aksi: 'lewati' });
    expect(row('r2').status).toBe('terkirim');
    expect(client.replies).toEqual([]);
  });

  it('aksi atau id tak dikenal → 400; badan terlalu besar → 413; Google gagal → status gagal', async () => {
    await seed('r1');
    expect((await post({ id: 'r1', aksi: 'hapus' })).status).toBe(400);
    expect((await post({ aksi: 'kirim' })).status).toBe(400);
    expect((await post({ id: 'r1', aksi: 'simpan', draf: 'a'.repeat(20_000) })).status).toBe(413);
    client.failReply = true;
    const res = await post({ id: 'r1', aksi: 'kirim', draf: 'Draf.' });
    expect(res.headers.get('Location')).toContain('s=gagal-api');
    expect(row('r1').status).toBe('gagal');
  });

  it('GbpClient tidak tersedia (secret belum diisi) → pesan, tidak terkirim', async () => {
    await seed('r1');
    const res = await handleReviews(
      new Request(`${ORIGIN}/ulasan/aksi`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: ORIGIN, 'Cf-Access-Jwt-Assertion': await sign(claims()) }, body: new URLSearchParams({ id: 'r1', aksi: 'kirim', draf: 'Draf.' }).toString() }),
      makeEnv(),
      { now: NOW, accessFetcher, client: null },
    );
    expect(res.headers.get('Location')).toContain('s=klien');
    expect(row('r1').status).toBe('antre');
  });
});

describe('rute Worker', () => {
  it('/ulasan/ dan /ulasan/aksi lewat Worker utama: tanpa JWT 403', async () => {
    const worker = (await import('../worker/index')).default;
    for (const [path, method] of [['/ulasan/', 'GET'], ['/ulasan', 'GET'], ['/ulasan/aksi', 'POST']] as const) {
      const res = await worker.fetch(new Request(`${ORIGIN}${path}`, { method }), makeEnv());
      expect(res.status, path).toBe(403);
    }
  });
});

describe('konfigurasi build tidak terbuka untuk publik', () => {
  it('GET /ulasan-config.json lewat Worker → 404', async () => {
    const worker = (await import('../worker/index')).default;
    expect((await worker.fetch(new Request(`${ORIGIN}${REVIEW_CONFIG_PATH}`), makeEnv())).status).toBe(404);
  });
});

describe('tidak ada jalur kirim selain reply.ts', () => {
  it('.reply( (pemanggilan klien Google) hanya muncul di worker/ulasan/reply.ts', () => {
    const files: string[] = [];
    const walk = (dir: string) => readdirSync(dir).forEach((f) => (statSync(`${dir}/${f}`).isDirectory() ? walk(`${dir}/${f}`) : f.endsWith('.ts') && files.push(`${dir}/${f}`)));
    walk('worker');
    const callers = files.filter((f) => /\.reply\(/.test(readFileSync(f, 'utf8')));
    expect(callers).toEqual(['worker/ulasan/reply.ts']);
  });

  it('sendReply hanya diimpor oleh sync.ts dan page.ts', () => {
    const users = ['worker/index.ts', 'worker/ulasan/sync.ts', 'worker/ulasan/page.ts', 'worker/stats.ts', 'worker/waClicks.ts'].filter((f) => /sendReply/.test(readFileSync(f, 'utf8')));
    expect(users).toEqual(['worker/ulasan/sync.ts', 'worker/ulasan/page.ts']);
  });
});

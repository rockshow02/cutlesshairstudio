import { beforeEach, describe, expect, it } from 'vitest';
import { reviewConfig } from '../scripts/vite-content-plugin';
import type { ReplyMode } from '../src/content/reviewReplies';
import type { Env } from '../worker/env';
import { MockGbpClient, type GbpReview } from '../worker/ulasan/gbp';
import { MAX_AUTO_PER_HOUR, runReviewSync } from '../worker/ulasan/sync';
import { contentFixture } from './helpers/contentFixture';
import { testD1 } from './helpers/d1';

const NOW = Date.UTC(2026, 10, 6, 5, 0, 0); // 12.00 WIB
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const LOCATION = 'loc/cibubur';

const review = (id: string, rating: number, text = 'Potongan rapi', over: Partial<GbpReview> = {}): GbpReview => ({
  id,
  location: LOCATION,
  reviewer: 'Budi',
  rating,
  text,
  createdAt: new Date(NOW - HOUR).toISOString(),
  hasReply: false,
  ...over,
});

const configFor = (mode: ReplyMode) => {
  const base = contentFixture();
  return reviewConfig({ ...base, settings: { ...base.settings, reviewReplyMode: mode } });
};

let ctx: ReturnType<typeof testD1>;
let env: Env;
beforeEach(() => {
  ctx = testD1('migrations-ulasan');
  env = { ASSETS: { fetch: async () => new Response('') }, REVIEWS_DB: ctx.d1, GBP_LOCATIONS: JSON.stringify({ cibubur: LOCATION, 'tidak-ada': 'loc/x' }) };
});

type Row = { id: string; status: string; sent_auto: number; draft: string; approved_by: string | null };
const rows = () => ctx.db.prepare('SELECT id, status, sent_auto, draft, approved_by FROM reviews ORDER BY id').all() as Row[];
const statusOf = (id: string) => rows().find((r) => r.id === id)?.status;
const sync = (client: MockGbpClient, mode: ReplyMode, now = NOW) => runReviewSync(env, { client, config: configFor(mode), now });

describe('runReviewSync: mode', () => {
  it('Aktif: bintang 5 bersih dibalas otomatis dengan draf dari template', async () => {
    const client = new MockGbpClient([review('r1', 5)]);
    expect(await sync(client, 'Aktif')).toMatchObject({ fetched: 1, inserted: 1, autoSent: 1, queued: 0 });
    expect(rows()[0]).toMatchObject({ id: 'r1', status: 'terkirim', sent_auto: 1 });
    expect(client.replies).toHaveLength(1);
    expect(client.replies[0]).toMatchObject({ reviewId: 'r1', text: rows()[0].draft });
  });

  it('Uji: bintang 5 masuk antrean, tidak ada yang terkirim', async () => {
    const client = new MockGbpClient([review('r1', 5)]);
    await sync(client, 'Uji');
    expect(rows()[0]).toMatchObject({ status: 'antre', sent_auto: 0 });
    expect(rows()[0].draft).not.toBe('');
    expect(client.replies).toEqual([]);
  });

  it('Mati: klien tidak dipanggil dan tabel kosong', async () => {
    const client = new MockGbpClient([review('r1', 5)]);
    expect(await sync(client, 'Mati')).toEqual({ fetched: 0, inserted: 0, autoSent: 0, queued: 0 });
    expect(client.listCalls).toBe(0);
    expect(rows()).toEqual([]);
  });
});

describe('runReviewSync: aturan kirim', () => {
  it('bintang 1–4 tidak pernah terkirim otomatis, walau mode Aktif', async () => {
    const client = new MockGbpClient([1, 2, 3, 4].map((n) => review(`r${n}`, n, 'bagus sekali')));
    await sync(client, 'Aktif');
    expect(rows().map((r) => r.status)).toEqual(['antre', 'antre', 'antre', 'antre']);
    expect(client.replies).toEqual([]);
  });

  it('bintang 5 berisi kata keluhan (huruf kapital) tetap antre', async () => {
    const client = new MockGbpClient([review('r1', 5, 'Bagus tapi LAMA banget!')]);
    await sync(client, 'Aktif');
    expect(statusOf('r1')).toBe('antre');
    expect(client.replies).toEqual([]);
  });

  it('ulasan yang sudah dibalas di Google dilewati', async () => {
    const client = new MockGbpClient([review('r1', 5, 'ok', { hasReply: true }), review('r2', 1, 'ok', { hasReply: true })]);
    await sync(client, 'Aktif');
    expect(rows().map((r) => r.status)).toEqual(['dilewati', 'dilewati']);
    expect(client.replies).toEqual([]);
  });

  it('ulasan lebih tua dari 14 hari tidak disimpan', async () => {
    const client = new MockGbpClient([review('lama', 5, 'ok', { createdAt: new Date(NOW - 15 * DAY).toISOString() }), review('baru', 5)]);
    await sync(client, 'Uji');
    expect(rows().map((r) => r.id)).toEqual(['baru']);
  });

  it('cabang di GBP_LOCATIONS yang tidak ada di konten dilewati', async () => {
    const client = new MockGbpClient([review('r1', 5, 'ok', { location: 'loc/x' })]);
    await sync(client, 'Uji');
    expect(rows()).toEqual([]);
  });
});

describe('runReviewSync: idempotensi & batas', () => {
  it('cron berulang tidak menggandakan baris atau balasan, dan tidak menimpa draf admin', async () => {
    const client = new MockGbpClient([review('a', 5), review('b', 3, 'ok')]);
    await sync(client, 'Aktif');
    ctx.db.prepare("UPDATE reviews SET draft = 'Draf admin' WHERE id = 'b'").run();
    const again = await sync(client, 'Aktif', NOW + HOUR);
    expect(again).toMatchObject({ inserted: 0, autoSent: 0 });
    expect(rows()).toHaveLength(2);
    expect(client.replies).toHaveLength(1);
    expect(rows().find((r) => r.id === 'b')).toMatchObject({ status: 'antre', draft: 'Draf admin' });
  });

  it('dua sinkron bersamaan tidak menghasilkan balasan ganda', async () => {
    const client = new MockGbpClient([review('a', 5)]);
    await Promise.all([sync(client, 'Aktif'), sync(client, 'Aktif')]);
    expect(rows()).toHaveLength(1);
    expect(client.replies).toHaveLength(1);
  });

  it(`batas ${MAX_AUTO_PER_HOUR} kiriman otomatis per jam; sisanya antre dan tidak dikirim sinkron berikutnya`, async () => {
    const client = new MockGbpClient(Array.from({ length: 12 }, (_, i) => review(`r${String(i).padStart(2, '0')}`, 5)));
    const first = await sync(client, 'Aktif');
    expect(first.autoSent).toBe(MAX_AUTO_PER_HOUR);
    expect(rows().filter((r) => r.status === 'terkirim')).toHaveLength(MAX_AUTO_PER_HOUR);
    expect(rows().filter((r) => r.status === 'antre')).toHaveLength(2);
    await sync(client, 'Aktif', NOW + HOUR + 60_000);
    expect(client.replies).toHaveLength(MAX_AUTO_PER_HOUR);
  });

  it('kiriman otomatis dari sinkron sebelumnya dalam jam yang sama ikut dihitung', async () => {
    const client = new MockGbpClient(Array.from({ length: 6 }, (_, i) => review(`a${i}`, 5)));
    await sync(client, 'Aktif');
    client.add(...Array.from({ length: 6 }, (_, i) => review(`b${i}`, 5)));
    await sync(client, 'Aktif', NOW + 10 * 60_000);
    expect(client.replies).toHaveLength(MAX_AUTO_PER_HOUR);
  });

  it('balasan gagal → status gagal, dan sinkron ulang tidak mencoba lagi', async () => {
    const client = new MockGbpClient([review('r1', 5)], { failReply: true });
    await sync(client, 'Aktif');
    expect(statusOf('r1')).toBe('gagal');
    client.failReply = false;
    await sync(client, 'Aktif', NOW + HOUR);
    expect(statusOf('r1')).toBe('gagal');
    expect(client.replies).toEqual([]);
  });

  it('satu cabang error tidak menghentikan cabang lain', async () => {
    env.GBP_LOCATIONS = JSON.stringify({ 'bogor-bantarjati': 'loc/error', cibubur: LOCATION });
    const client = new MockGbpClient([review('r1', 3, 'ok')], { failList: ['loc/error'] });
    const result = await sync(client, 'Uji');
    expect(result.inserted).toBe(1);
  });

  it('GBP_LOCATIONS kosong atau bukan JSON → tidak ada pekerjaan, tidak error', async () => {
    const client = new MockGbpClient([review('r1', 5)]);
    for (const value of [undefined, '', 'bukan json', '[]']) {
      env.GBP_LOCATIONS = value;
      expect(await sync(client, 'Aktif')).toMatchObject({ fetched: 0, inserted: 0 });
    }
    expect(rows()).toEqual([]);
  });

  it('nama pengulas dipotong 100 karakter', async () => {
    const client = new MockGbpClient([review('r1', 3, 'ok', { reviewer: 'n'.repeat(500) })]);
    await sync(client, 'Uji');
    expect((ctx.db.prepare('SELECT reviewer FROM reviews').get() as { reviewer: string }).reviewer).toHaveLength(100);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../worker/env';
import { insertReview, type ReviewStatus } from '../worker/ulasan/db';
import { MockGbpClient } from '../worker/ulasan/gbp';
import { sendReply } from '../worker/ulasan/reply';
import { testD1 } from './helpers/d1';

const NOW = Date.UTC(2026, 10, 6, 5, 0, 0);
const ADMIN = { kind: 'admin', email: 'pemilik@contoh.id' } as const;

let ctx: ReturnType<typeof testD1>;
let env: Env;
beforeEach(() => {
  ctx = testD1('migrations-ulasan');
  env = { ASSETS: { fetch: async () => new Response('') }, REVIEWS_DB: ctx.d1 };
});
afterEach(() => vi.restoreAllMocks());

const seed = (id: string, over: { rating?: number; status?: ReviewStatus; draft?: string } = {}) =>
  insertReview(ctx.d1, { id, branch: 'cibubur', reviewer: 'Budi Rahasia', rating: over.rating ?? 3, body: 'isi ulasan rahasia', reviewedAt: '2026-11-06T01:00:00Z', status: over.status ?? 'antre', draft: over.draft ?? 'Terima kasih kak Budi.' }, NOW);
const row = (id: string) => ctx.db.prepare('SELECT status, draft, approved_by, approved_at, sent_auto, sent_at FROM reviews WHERE id = ?').get(id) as Record<string, unknown>;

describe('sendReply: admin', () => {
  it('mengirim ulasan antre: terkirim, dicatat siapa & kapan, satu panggilan Google', async () => {
    await seed('r1');
    const client = new MockGbpClient();
    expect(await sendReply(env, client, 'r1', ADMIN, NOW)).toEqual({ ok: true });
    expect(row('r1')).toMatchObject({ status: 'terkirim', approved_by: 'pemilik@contoh.id', sent_auto: 0 });
    expect(row('r1').approved_at).toBe(new Date(NOW).toISOString());
    expect(client.replies).toEqual([{ reviewId: 'r1', text: 'Terima kasih kak Budi.' }]);
  });

  it('dua pengiriman bersamaan: tepat satu menang, Google dipanggil sekali', async () => {
    await seed('r1');
    const client = new MockGbpClient();
    const results = await Promise.all([sendReply(env, client, 'r1', ADMIN, NOW), sendReply(env, client, 'r1', ADMIN, NOW)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(client.replies).toHaveLength(1);
  });

  it('ulasan terkirim / dilewati tidak bisa dikirim ulang', async () => {
    await seed('t', { status: 'terkirim' });
    await seed('d', { status: 'dilewati' });
    const client = new MockGbpClient();
    expect(await sendReply(env, client, 't', ADMIN, NOW)).toEqual({ ok: false, reason: 'bukan-antrean' });
    expect(await sendReply(env, client, 'd', ADMIN, NOW)).toEqual({ ok: false, reason: 'bukan-antrean' });
    expect(client.replies).toEqual([]);
  });

  it('id tak dikenal → tidak-ditemukan', async () => {
    expect(await sendReply(env, new MockGbpClient(), 'x', ADMIN, NOW)).toEqual({ ok: false, reason: 'tidak-ditemukan' });
  });

  it('draf kosong, 4.097 karakter, atau berisi {nama} → ditolak, status tak berubah, tanpa panggilan', async () => {
    await seed('r1');
    const client = new MockGbpClient();
    for (const draft of ['   ', 'a'.repeat(4097), 'Halo {nama}', 'Selamat {salam_waktu}']) {
      expect(await sendReply(env, client, 'r1', ADMIN, NOW, draft)).toEqual({ ok: false, reason: 'draf-tidak-valid' });
    }
    expect(row('r1')).toMatchObject({ status: 'antre', draft: 'Terima kasih kak Budi.' });
    expect(client.replies).toEqual([]);
  });

  it('draf tersimpan yang tidak valid juga ditolak', async () => {
    await seed('r1', { draft: '' });
    expect(await sendReply(env, new MockGbpClient(), 'r1', ADMIN, NOW)).toEqual({ ok: false, reason: 'draf-tidak-valid' });
  });

  it('draftOverride valid menggantikan draf, dan itulah yang terkirim', async () => {
    await seed('r1');
    const client = new MockGbpClient();
    await sendReply(env, client, 'r1', ADMIN, NOW, '  Draf hasil edit admin.  ');
    expect(client.replies[0].text).toBe('Draf hasil edit admin.');
    expect(row('r1').draft).toBe('Draf hasil edit admin.');
  });

  it('draf 4.096 karakter (batas) masih boleh', async () => {
    await seed('r1');
    expect(await sendReply(env, new MockGbpClient(), 'r1', ADMIN, NOW, 'a'.repeat(4096))).toEqual({ ok: true });
  });

  it('Google gagal → gagal-api, status gagal; admin bisa mencoba lagi dan berhasil; log tanpa data sensitif', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await seed('r1');
    const client = new MockGbpClient([], { failReply: true });
    expect(await sendReply(env, client, 'r1', ADMIN, NOW)).toEqual({ ok: false, reason: 'gagal-api' });
    expect(row('r1')).toMatchObject({ status: 'gagal', sent_at: null });
    client.failReply = false;
    expect(await sendReply(env, client, 'r1', ADMIN, NOW + 1000)).toEqual({ ok: true });
    expect(row('r1').status).toBe('terkirim');
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toMatch(/Budi|rahasia|pemilik@contoh\.id|Terima kasih kak/i);
  });
});

describe('sendReply: otomatis', () => {
  it('menolak bintang 1–4 walau status baru dan draf valid', async () => {
    const client = new MockGbpClient();
    for (const rating of [1, 2, 3, 4]) {
      await seed(`r${rating}`, { rating, status: 'baru' });
      expect(await sendReply(env, client, `r${rating}`, { kind: 'otomatis' }, NOW)).toEqual({ ok: false, reason: 'tidak-boleh-otomatis' });
      expect(row(`r${rating}`).status).toBe('baru');
    }
    expect(client.replies).toEqual([]);
  });

  it('hanya dari status baru (bukan antre)', async () => {
    await seed('r1', { rating: 5, status: 'antre' });
    const client = new MockGbpClient();
    expect(await sendReply(env, client, 'r1', { kind: 'otomatis' }, NOW)).toEqual({ ok: false, reason: 'bukan-antrean' });
    expect(client.replies).toEqual([]);
  });

  it('bintang 5 status baru terkirim dan ditandai otomatis tanpa nama penyetuju', async () => {
    await seed('r1', { rating: 5, status: 'baru' });
    const client = new MockGbpClient();
    expect(await sendReply(env, client, 'r1', { kind: 'otomatis' }, NOW)).toEqual({ ok: true });
    expect(row('r1')).toMatchObject({ status: 'terkirim', sent_auto: 1, approved_by: null, approved_at: null });
  });
});

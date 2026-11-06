import { beforeEach, describe, expect, it } from 'vitest';
import { reviewConfig } from '../scripts/vite-content-plugin';
import type { Env } from '../worker/env';
import { MockGbpClient, type GbpReview } from '../worker/ulasan/gbp';
import { noopNotifier, type Notifier, type QueuedReview } from '../worker/ulasan/notify';
import { runReviewSync } from '../worker/ulasan/sync';
import { contentFixture } from './helpers/contentFixture';
import { testD1 } from './helpers/d1';

const NOW = Date.UTC(2026, 10, 6, 5, 0, 0);
const HOUR = 3_600_000;
const review = (id: string, rating: number, text = 'ok', over: Partial<GbpReview> = {}): GbpReview => ({ id, location: 'loc/cibubur', reviewer: 'Budi', rating, text, createdAt: new Date(NOW - HOUR).toISOString(), hasReply: false, ...over });

let env: Env;
beforeEach(() => {
  env = { ASSETS: { fetch: async () => new Response('') }, REVIEWS_DB: testD1('migrations-ulasan').d1, GBP_LOCATIONS: JSON.stringify({ cibubur: 'loc/cibubur' }) };
});

const recorder = () => {
  const calls: QueuedReview[][] = [];
  const notifier: Notifier = { queued: async (r) => void calls.push(r) };
  return { calls, notifier };
};
const config = (mode: 'Uji' | 'Aktif') => {
  const base = contentFixture();
  return reviewConfig({ ...base, settings: { ...base.settings, reviewReplyMode: mode } });
};

describe('Notifier', () => {
  it('noopNotifier tidak mengirim apa pun dan tidak melempar', async () => {
    await expect(noopNotifier.queued([{ id: 'a', branch: 'cibubur', branchName: 'Cibubur', rating: 3 }])).resolves.toBeUndefined();
  });

  it('sinkron memberi tahu hanya ulasan antre baru, satu panggilan per sinkron', async () => {
    const { calls, notifier } = recorder();
    const client = new MockGbpClient([review('a', 3), review('b', 1), review('c', 5, 'mantap'), review('d', 4, 'ok', { hasReply: true })]);
    await runReviewSync(env, { client, config: config('Aktif'), now: NOW, notifier });
    expect(calls).toHaveLength(1);
    expect(calls[0].map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(calls[0][0]).toMatchObject({ branch: 'cibubur', branchName: 'Cibubur' });
  });

  it('tanpa ulasan antre baru atau pada sinkron ulang, notifier tidak dipanggil', async () => {
    const { calls, notifier } = recorder();
    const client = new MockGbpClient([review('a', 3)]);
    await runReviewSync(env, { client, config: config('Uji'), now: NOW, notifier });
    await runReviewSync(env, { client, config: config('Uji'), now: NOW + HOUR, notifier });
    expect(calls).toHaveLength(1);
    const empty = recorder();
    await runReviewSync(env, { client: new MockGbpClient([]), config: config('Uji'), now: NOW, notifier: empty.notifier });
    expect(empty.calls).toHaveLength(0);
  });

  it('notifier yang melempar tidak menggagalkan sinkron', async () => {
    const client = new MockGbpClient([review('a', 3)]);
    const result = await runReviewSync(env, { client, config: config('Uji'), now: NOW, notifier: { queued: async () => Promise.reject(new Error('gagal')) } });
    expect(result.inserted).toBe(1);
  });

  it('tanpa notifier, sinkron memakai no-op', async () => {
    const result = await runReviewSync(env, { client: new MockGbpClient([review('a', 3)]), config: config('Uji'), now: NOW });
    expect(result.queued).toBe(1);
  });
});

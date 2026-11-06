import { beforeEach, describe, expect, it } from 'vitest';
import { reviewConfig } from '../scripts/vite-content-plugin';
import { REVIEW_CONFIG_PATH } from '../src/content/reviewReplies';
import { runScheduled } from '../worker/index';
import type { Env } from '../worker/env';
import { resetReviewConfigCache } from '../worker/ulasan/config';
import { contentFixture } from './helpers/contentFixture';
import { testD1 } from './helpers/d1';

const NOW = Date.UTC(2026, 10, 6, 5, 0, 0);

function envWith(mode: 'Mati' | 'Uji', extra: Partial<Env> = {}) {
  const ctx = testD1('migrations-ulasan');
  const base = contentFixture();
  const config = reviewConfig({ ...base, settings: { ...base.settings, reviewReplyMode: mode } });
  const assets = { fetch: async (req: Request) => (new URL(req.url).pathname === REVIEW_CONFIG_PATH ? Response.json(config) : new Response('', { status: 404 })) };
  const env: Env = { ASSETS: assets, REVIEWS_DB: ctx.d1, GBP_CLIENT: 'mock', GBP_LOCATIONS: JSON.stringify({ cibubur: 'mock/cibubur' }), ...extra };
  return { env, count: () => (ctx.db.prepare('SELECT COUNT(*) AS n FROM reviews').get() as { n: number }).n };
}

beforeEach(() => resetReviewConfigCache());

describe('scheduled (cron per jam)', () => {
  it('klien mock + mode Uji: contoh ulasan masuk antrean, diulang tidak menggandakan', async () => {
    const { env, count } = envWith('Uji');
    await runScheduled(env, NOW);
    const first = count();
    expect(first).toBeGreaterThan(0);
    await runScheduled(env, NOW + 3_600_000);
    expect(count()).toBe(first);
  });

  it('mode Mati: tidak ada yang disimpan', async () => {
    const { env, count } = envWith('Mati');
    await runScheduled(env, NOW);
    expect(count()).toBe(0);
  });

  it('tanpa secret OAuth & bukan mock: tidak berbuat apa-apa dan tidak error', async () => {
    const { env, count } = envWith('Uji', { GBP_CLIENT: '' });
    await expect(runScheduled(env, NOW)).resolves.toBeUndefined();
    expect(count()).toBe(0);
  });

  it('konfigurasi build tidak ada: tidak error', async () => {
    const { env, count } = envWith('Uji', { ASSETS: { fetch: async () => new Response('', { status: 404 }) } });
    await expect(runScheduled(env, NOW)).resolves.toBeUndefined();
    expect(count()).toBe(0);
  });
});

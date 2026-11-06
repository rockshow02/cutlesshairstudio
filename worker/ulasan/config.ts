import { REVIEW_CONFIG_PATH, type ReviewConfig } from '../../src/content/reviewReplies';
import type { Env } from '../env';

const TTL_MS = 5 * 60_000;
let cached: { at: number; value: ReviewConfig } | undefined;

/** dist/ulasan-config.json lewat binding ASSETS (disimpan 5 menit per isolate). null = tidak bisa dibaca. */
export async function loadReviewConfig(env: Env, now = Date.now()): Promise<ReviewConfig | null> {
  if (cached && now - cached.at < TTL_MS) return cached.value;
  try {
    // Host bebas: binding ASSETS hanya memakai path
    const res = await env.ASSETS.fetch(new Request(new URL(REVIEW_CONFIG_PATH, 'https://assets.invalid')));
    if (!res.ok) return null;
    const value = (await res.json()) as ReviewConfig;
    cached = { at: now, value };
    return value;
  } catch {
    return null;
  }
}

/** Untuk tes: kosongkan cache */
export const resetReviewConfigCache = () => {
  cached = undefined;
};

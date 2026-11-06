import { REPLY_MAX_LENGTH, REPLY_PLACEHOLDERS } from '../../src/content/reviewReplies';
import type { Env } from '../env';
import { claimForSend, getReview, markFailed, type ReviewStatus } from './db';
import type { GbpClient } from './gbp';

/**
 * SATU-SATUNYA jalur yang memanggil GbpClient.reply (dijaga tests/review-page.test.ts). Dipanggil oleh sinkron cron
 * (hanya bintang 5) dan oleh aksi admin di /ulasan/. Tidak ada endpoint publik yang mengirim balasan.
 */

export type SendResult =
  | { ok: true }
  | { ok: false; reason: 'tidak-ditemukan' | 'bukan-antrean' | 'tidak-boleh-otomatis' | 'draf-tidak-valid' | 'gagal-api' };

export type SendBy = { kind: 'otomatis' } | { kind: 'admin'; email: string };

const LEFTOVER = new RegExp(`\\{(${REPLY_PLACEHOLDERS.join('|')})\\}`);

/** Draf boleh dikirim: tidak kosong, ≤ batas Google, tanpa placeholder tersisa */
export const draftProblem = (draft: string): string | null => {
  if (!draft.trim()) return 'Draf balasan kosong.';
  if (draft.length > REPLY_MAX_LENGTH) return `Draf melebihi ${REPLY_MAX_LENGTH} karakter.`;
  if (LEFTOVER.test(draft)) return 'Draf masih berisi placeholder seperti {nama}.';
  return null;
};

export async function sendReply(env: Env, client: GbpClient, id: string, by: SendBy, now: number, draftOverride?: string): Promise<SendResult> {
  const db = env.REVIEWS_DB;
  if (!db) return { ok: false, reason: 'tidak-ditemukan' };
  const review = await getReview(db, id);
  if (!review) return { ok: false, reason: 'tidak-ditemukan' };
  // Pengaman ganda: bintang 1–4 tidak pernah lewat jalur otomatis, apa pun keputusan pemanggil
  if (by.kind === 'otomatis' && review.rating < 5) return { ok: false, reason: 'tidak-boleh-otomatis' };
  const from: ReviewStatus[] = by.kind === 'otomatis' ? ['baru'] : ['baru', 'antre', 'gagal'];
  if (!from.includes(review.status)) return { ok: false, reason: 'bukan-antrean' };
  const draft = (draftOverride ?? review.draft).trim();
  if (draftProblem(draft)) return { ok: false, reason: 'draf-tidak-valid' };
  if (!(await claimForSend(db, id, from, draft, by.kind === 'admin' ? by.email : null, by.kind === 'otomatis', now))) return { ok: false, reason: 'bukan-antrean' };
  try {
    await client.reply(id, draft);
    return { ok: true };
  } catch (error) {
    // Log tanpa isi ulasan, nama, atau email: hanya pesan galat klien (berisi kode status)
    console.error('ulasan: balasan gagal terkirim', error instanceof Error ? error.message : 'galat');
    await markFailed(db, id);
    return { ok: false, reason: 'gagal-api' };
  }
}

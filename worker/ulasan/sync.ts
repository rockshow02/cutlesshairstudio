import { REVIEWER_NAME_MAX, buildDraft, decideAction, type ReviewConfig } from '../../src/content/reviewReplies';
import type { Env } from '../env';
import { countAutoSentSince, insertReview, type ReviewStatus } from './db';
import type { GbpClient } from './gbp';
import { noopNotifier, type Notifier, type QueuedReview } from './notify';
import { sendReply } from './reply';

/** Batas kiriman otomatis per jam: bila ada bug, paling banyak sebanyak ini yang terkirim, sisanya masuk antrean */
export const MAX_AUTO_PER_HOUR = 10;
/** Ulasan yang lebih tua tidak diambil, agar antrean tidak banjir saat pertama dinyalakan */
const LOOKBACK_MS = 14 * 24 * 3_600_000;
const HOUR_MS = 3_600_000;
const BODY_MAX = 5000;

export interface SyncResult {
  fetched: number;
  inserted: number;
  autoSent: number;
  queued: number;
}

/** GBP_LOCATIONS: JSON {slug cabang: lokasi Google}; kosong / tidak valid = tidak ada pekerjaan */
function locationsOf(env: Env): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(env.GBP_LOCATIONS || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === 'string' && v)) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Cron per jam: ambil ulasan baru tiap cabang, simpan (idempoten), buat draf, lalu kirim otomatis HANYA bila
 * decideAction == 'kirim' (mode Aktif, bintang 5, tanpa kata keluhan) dan kuota per jam belum habis.
 * Mode Mati: tidak melakukan apa pun. Log hanya berisi hitungan.
 */
export async function runReviewSync(env: Env, deps: { client: GbpClient; config: ReviewConfig; now: number; notifier?: Notifier }): Promise<SyncResult> {
  const { client, config, now, notifier = noopNotifier } = deps;
  const queuedNow: QueuedReview[] = [];
  const result: SyncResult = { fetched: 0, inserted: 0, autoSent: 0, queued: 0 };
  const db = env.REVIEWS_DB;
  if (!db || config.mode === 'Mati') return result;
  const since = new Date(now - LOOKBACK_MS).toISOString();
  let quota = Math.max(0, MAX_AUTO_PER_HOUR - (await countAutoSentSince(db, now - HOUR_MS)));

  for (const [slug, location] of Object.entries(locationsOf(env))) {
    const branchName = config.branches[slug];
    if (!branchName) continue;
    let reviews;
    try {
      reviews = await client.listNewReviews(location, since);
    } catch (error) {
      console.error('ulasan: gagal mengambil ulasan', slug, error instanceof Error ? error.message : 'galat');
      continue;
    }
    for (const r of reviews.filter((x) => x.createdAt >= since)) {
      result.fetched += 1;
      const reviewer = r.reviewer.slice(0, REVIEWER_NAME_MAX);
      const body = r.text.slice(0, BODY_MAX);
      const draft = r.hasReply ? '' : buildDraft({ rating: r.rating, text: body, reviewer, branchName }, config.reply, now);
      const wantsAuto = !r.hasReply && decideAction({ mode: config.mode, rating: r.rating, text: body }, config.reply.complaintWords) === 'kirim';
      const auto = wantsAuto && quota > 0;
      const status: ReviewStatus = r.hasReply ? 'dilewati' : auto ? 'baru' : 'antre';
      const isNew = await insertReview(db, { id: r.id, branch: slug, reviewer, rating: r.rating, body, reviewedAt: r.createdAt, status, draft }, now);
      if (!isNew) continue;
      result.inserted += 1;
      if (status === 'antre') {
        result.queued += 1;
        queuedNow.push({ id: r.id, branch: slug, branchName, rating: r.rating });
      }
      if (auto) {
        quota -= 1;
        const sent = await sendReply(env, client, r.id, { kind: 'otomatis' }, now);
        if (sent.ok) result.autoSent += 1;
      }
    }
  }
  if (queuedNow.length) {
    try {
      await notifier.queued(queuedNow);
    } catch (error) {
      console.error('ulasan: notifikasi gagal', error instanceof Error ? error.message : 'galat');
    }
  }
  console.log('ulasan: sinkron selesai', JSON.stringify(result));
  return result;
}

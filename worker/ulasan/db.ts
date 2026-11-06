import type { D1Database } from '../env';

/** Akses D1 ulasan. Waktu disimpan sebagai ISO 8601 UTC. */

export type ReviewStatus = 'baru' | 'antre' | 'terkirim' | 'dilewati' | 'gagal';

export interface ReviewRow {
  id: string;
  branch: string;
  reviewer: string;
  rating: number;
  body: string;
  reviewed_at: string;
  status: ReviewStatus;
  draft: string;
  approved_by: string | null;
  approved_at: string | null;
  sent_auto: number;
  sent_at: string | null;
  emailed_at: string | null;
  created_at: string;
}

export const iso = (ms: number) => new Date(ms).toISOString();

export interface NewReview {
  id: string;
  branch: string;
  reviewer: string;
  rating: number;
  body: string;
  reviewedAt: string;
  status: ReviewStatus;
  draft: string;
}

/** INSERT OR IGNORE: ulasan yang sudah ada tidak berubah. true = baris baru. */
export async function insertReview(db: D1Database, r: NewReview, now: number): Promise<boolean> {
  const res = await db
    .prepare('INSERT OR IGNORE INTO reviews (id, branch, reviewer, rating, body, reviewed_at, status, draft, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(r.id, r.branch, r.reviewer, r.rating, r.body, r.reviewedAt, r.status, r.draft, iso(now))
    .run();
  return res.meta.changes === 1;
}

export const getReview = async (db: D1Database, id: string) => (await db.prepare('SELECT * FROM reviews WHERE id = ?').bind(id).all<ReviewRow>()).results[0] ?? null;

/** Kiriman otomatis sejak waktu itu (dasar batas per jam) */
export async function countAutoSentSince(db: D1Database, sinceMs: number): Promise<number> {
  const rows = (await db.prepare('SELECT COUNT(*) AS n FROM reviews WHERE sent_auto = 1 AND sent_at >= ?').bind(iso(sinceMs)).all<{ n: number }>()).results;
  return Number(rows[0]?.n ?? 0);
}

/**
 * Klaim atomik sebelum memanggil Google: hanya satu pemanggil yang bisa mengubah status ke 'terkirim'
 * (UPDATE bersyarat; meta.changes === 1). Kiriman ganda dan dua tab admin tidak mungkin lolos berdua.
 */
export async function claimForSend(db: D1Database, id: string, from: ReviewStatus[], draft: string, by: string | null, auto: boolean, now: number): Promise<boolean> {
  const marks = from.map(() => '?').join(', ');
  const res = await db
    .prepare(`UPDATE reviews SET status = 'terkirim', draft = ?, approved_by = ?, approved_at = ?, sent_auto = ?, sent_at = ? WHERE id = ? AND status IN (${marks})`)
    .bind(draft, by, auto ? null : iso(now), auto ? 1 : 0, iso(now), id, ...from)
    .run();
  return res.meta.changes === 1;
}

/** Panggilan Google gagal setelah klaim: tandai gagal (draf tetap, bisa dicoba lagi oleh admin) */
export const markFailed = (db: D1Database, id: string) =>
  db.prepare("UPDATE reviews SET status = 'gagal', sent_at = NULL, sent_auto = 0 WHERE id = ? AND status = 'terkirim'").bind(id).run();

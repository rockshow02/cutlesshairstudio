import type { D1Database } from '../env';

/** Ringkasan antrean untuk bagian atas /ulasan/ dan judul tab. Antrean = ulasan yang menunggu admin: antre, baru, gagal. */

export interface QueueSummary {
  total: number;
  perBranch: { branch: string; name: string; count: number }[];
  oldest: { id: string; branchName: string; reviewedAt: string; rating: number } | null;
}

const WAITING = "status IN ('antre', 'baru', 'gagal')";

export async function summarizeQueue(db: D1Database, branches: Record<string, string>): Promise<QueueSummary> {
  const counts = (await db.prepare(`SELECT branch, COUNT(*) AS n FROM reviews WHERE ${WAITING} GROUP BY branch`).all<{ branch: string; n: number }>()).results;
  const oldest = (await db.prepare(`SELECT id, branch, reviewed_at, rating FROM reviews WHERE ${WAITING} ORDER BY reviewed_at ASC, id ASC LIMIT 1`).all<{ id: string; branch: string; reviewed_at: string; rating: number }>()).results[0];
  const count = new Map(counts.map((c) => [c.branch, Number(c.n)]));
  const known = Object.entries(branches).map(([branch, name]) => ({ branch, name, count: count.get(branch) ?? 0 }));
  // Cabang yang sudah tidak ada di konten tetap terlihat, supaya total selalu cocok dengan daftar
  const unknown = [...count].filter(([branch]) => !(branch in branches)).map(([branch, n]) => ({ branch, name: branch, count: n }));
  return {
    total: [...count.values()].reduce((sum, n) => sum + n, 0),
    perBranch: [...known, ...unknown],
    oldest: oldest ? { id: oldest.id, branchName: branches[oldest.branch] ?? oldest.branch, reviewedAt: oldest.reviewed_at, rating: Number(oldest.rating) } : null,
  };
}

export const queueTitle = (count: number): string => `${count > 0 ? `(${count}) ` : ''}Ulasan – Cutless`;

/** Ulasan dibuat setelah kunjungan terakhir admin (sinceMs null = kunjungan pertama, tanpa penanda) */
export const isNewSince = (createdAtIso: string, sinceMs: number | null): boolean => sinceMs !== null && Date.parse(createdAtIso) > sinceMs;

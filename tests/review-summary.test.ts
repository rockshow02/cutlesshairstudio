import { beforeEach, describe, expect, it } from 'vitest';
import { insertReview, type ReviewStatus } from '../worker/ulasan/db';
import { isNewSince, queueTitle, summarizeQueue } from '../worker/ulasan/summary';
import { testD1 } from './helpers/d1';

const NOW = Date.UTC(2026, 10, 6, 5, 0, 0);
const BRANCHES = { 'bogor-bantarjati': 'Bogor Bantarjati', cibubur: 'Cibubur' };

let ctx: ReturnType<typeof testD1>;
beforeEach(() => {
  ctx = testD1('migrations-ulasan');
});
const seed = (id: string, branch: string, status: ReviewStatus, reviewedAt: string, rating = 3) =>
  insertReview(ctx.d1, { id, branch, reviewer: 'Budi', rating, body: 'x', reviewedAt, status, draft: 'd' }, NOW);

describe('summarizeQueue', () => {
  it('tabel kosong: nol di semua cabang, tanpa ulasan tertua', async () => {
    expect(await summarizeQueue(ctx.d1, BRANCHES)).toEqual({
      total: 0,
      perBranch: [
        { branch: 'bogor-bantarjati', name: 'Bogor Bantarjati', count: 0 },
        { branch: 'cibubur', name: 'Cibubur', count: 0 },
      ],
      oldest: null,
    });
  });

  it('menghitung antre/baru/gagal per cabang; terkirim & dilewati tidak dihitung', async () => {
    await seed('a', 'cibubur', 'antre', '2026-11-05T10:00:00Z');
    await seed('b', 'cibubur', 'gagal', '2026-11-04T10:00:00Z', 1);
    await seed('c', 'bogor-bantarjati', 'baru', '2026-11-06T01:00:00Z');
    await seed('d', 'cibubur', 'terkirim', '2026-10-01T10:00:00Z');
    await seed('e', 'cibubur', 'dilewati', '2026-10-02T10:00:00Z');
    const s = await summarizeQueue(ctx.d1, BRANCHES);
    expect(s.total).toBe(3);
    expect(s.perBranch).toEqual([
      { branch: 'bogor-bantarjati', name: 'Bogor Bantarjati', count: 1 },
      { branch: 'cibubur', name: 'Cibubur', count: 2 },
    ]);
    expect(s.oldest).toEqual({ id: 'b', branchName: 'Cibubur', reviewedAt: '2026-11-04T10:00:00Z', rating: 1 });
  });

  it('cabang tak dikenal di data tetap dihitung di total dan muncul dengan kode slug', async () => {
    await seed('x', 'cabang-lama', 'antre', '2026-11-05T10:00:00Z');
    const s = await summarizeQueue(ctx.d1, BRANCHES);
    expect(s.total).toBe(1);
    expect(s.perBranch.find((b) => b.branch === 'cabang-lama')).toEqual({ branch: 'cabang-lama', name: 'cabang-lama', count: 1 });
  });
});

describe('queueTitle', () => {
  it('judul tab menampilkan jumlah antre', () => {
    expect(queueTitle(0)).toBe('Ulasan – Cutless');
    expect(queueTitle(3)).toBe('(3) Ulasan – Cutless');
  });
});

describe('isNewSince', () => {
  const created = '2026-11-06T02:00:00.000Z';
  const at = Date.parse(created);
  it('tanpa kunjungan sebelumnya tidak ada penanda', () => expect(isNewSince(created, null)).toBe(false));
  it('dibuat setelah kunjungan terakhir → baru', () => expect(isNewSince(created, at - 1)).toBe(true));
  it('dibuat sebelum atau tepat saat kunjungan → bukan baru', () => {
    expect(isNewSince(created, at)).toBe(false);
    expect(isNewSince(created, at + 1)).toBe(false);
  });
});

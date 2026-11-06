import { describe, expect, it } from 'vitest';
import { testD1 } from './helpers/d1';

const insertSql = (verb: string) => `${verb} INTO reviews (id, branch, reviewer, rating, body, reviewed_at, status, created_at) VALUES (?, 'cibubur', 'Budi', ?, 'mantap', '2026-11-06T01:00:00Z', ?, '2026-11-06T02:00:00Z')`;
const insert = insertSql('INSERT OR IGNORE');
const strictInsert = insertSql('INSERT');

describe('migrations-ulasan/0001_ulasan.sql', () => {
  it('menyimpan ulasan sah; id ganda diabaikan (INSERT OR IGNORE → 0 baris berubah)', async () => {
    const { d1 } = testD1('migrations-ulasan');
    expect(((await d1.prepare(insert).bind('r1', 5, 'baru').run()) as { meta: { changes: number } }).meta.changes).toBe(1);
    expect(((await d1.prepare(insert).bind('r1', 1, 'antre').run()) as { meta: { changes: number } }).meta.changes).toBe(0);
    const rows = (await d1.prepare('SELECT rating, status, sent_auto, draft FROM reviews').all<{ rating: number; status: string; sent_auto: number; draft: string }>()).results;
    expect(rows).toEqual([{ rating: 5, status: 'baru', sent_auto: 0, draft: '' }]);
  });

  it('menolak status & bintang di luar aturan', async () => {
    const { d1 } = testD1('migrations-ulasan');
    await expect(d1.prepare(strictInsert).bind('r2', 5, 'aneh').run()).rejects.toThrow();
    await expect(d1.prepare(strictInsert).bind('r3', 6, 'baru').run()).rejects.toThrow();
    await expect(d1.prepare(strictInsert).bind('r4', 0, 'baru').run()).rejects.toThrow();
  });
});

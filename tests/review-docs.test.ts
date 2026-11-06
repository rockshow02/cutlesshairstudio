import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const doc = readFileSync('docs/balasan-ulasan.md', 'utf8');

/** Migrasi tanpa komentar (--) dan baris kosong, digabung dalam satu baris */
const oneLine = readFileSync('migrations-ulasan/0001_ulasan.sql', 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('--'))
  .join(' ');

describe('docs/balasan-ulasan.md', () => {
  it('SQL satu baris untuk Console D1 sama dengan migrasi', () => {
    const sql = doc.match(/```sql\n([\s\S]*?)\n```/)?.[1] ?? '';
    expect(sql).toBe(oneLine);
    expect(sql).not.toContain('\n');
    expect(sql).not.toContain('--');
  });

  it('menjelaskan langkah wajib pemilik', () => {
    expect(doc).toContain('cutless-ulasan');
    expect(doc).toContain('cutless-ulasan-staging');
    expect(doc).toContain('ISI-DATABASE-ID-cutless-ulasan');
    expect(doc).toContain('`ulasan`');
    expect(doc).toContain('GBP_REFRESH_TOKEN');
    expect(doc).toMatch(/Uji → Aktif/);
  });

  it('menyatakan tanpa notifikasi eksternal dan melarang Email Routing di domain utama', () => {
    expect(doc).toMatch(/Jangan\*\* mengaktifkan Cloudflare Email Routing di domain utama/);
    expect(doc).toMatch(/notifikasi bawaan Google/i);
    expect(doc).toContain('Bookmark');
  });

  it('wrangler.jsonc dan dokumen memakai placeholder database_id yang sama', () => {
    const wrangler = readFileSync('wrangler.jsonc', 'utf8');
    for (const name of ['cutless-ulasan', 'cutless-ulasan-staging']) {
      const placeholder = `ISI-DATABASE-ID-${name}`;
      const inWrangler = wrangler.includes(`"${placeholder}"`);
      // Setelah pemilik mengisi ID asli, placeholder hilang dari wrangler.jsonc dan tes ini tetap hijau
      expect(inWrangler || !wrangler.includes('ISI-DATABASE-ID'), name).toBe(true);
      expect(doc).toContain(placeholder);
    }
  });
});

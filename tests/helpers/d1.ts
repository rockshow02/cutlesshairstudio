/** D1 lokal sementara untuk tes: migrasi + seed dari JSON (sama dengan staging). */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getPlatformProxy } from 'wrangler';

/** Pisah file SQL menjadi pernyataan (komentar baris "--" dibuang, ";" di akhir baris = akhir pernyataan) */
export function splitSql(sql: string): string[] {
  return sql
    .split('\n')
    .map((l) => l.replace(/^\s*--.*$/, ''))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** until: terapkan migrasi s.d. file ini saja (mis. '0002_loyalty.sql') untuk menguji migrasi berikutnya di DB berisi data */
export async function createTestDb(opts: { until?: string } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cutless-d1-'));
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: path.resolve('tests/wrangler.test.jsonc'),
    persist: { path: dir },
  });
  const db = proxy.env.DB;
  const run = async (sql: string) => {
    for (const stmt of splitSql(sql)) if (!/^PRAGMA/i.test(stmt)) await db.prepare(stmt).run();
  };
  const files = readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort();
  for (const file of files.filter((f) => !opts.until || f <= opts.until)) {
    await run(readFileSync(path.join('migrations', file), 'utf8'));
  }
  const seedFile = path.join(dir, 'seed.sql');
  execFileSync(process.execPath, ['scripts/seed-d1.mjs', '--out', seedFile, '--test-data', '--dev-admin'], {
    stdio: 'ignore',
  });
  await run(readFileSync(seedFile, 'utf8'));
  return {
    db,
    run,
    /** Terapkan satu file migrasi (untuk tes migrasi) */
    migrate: (file: string) => run(readFileSync(path.join('migrations', file), 'utf8')),
    async dispose() {
      await proxy.dispose();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

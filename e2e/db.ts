import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Jalankan SQL ke D1 LOKAL (wrangler --local). Hanya untuk E2E lokal; tidak pernah ke staging/produksi. */
export function localSql(statements: string[]) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cutless-e2e-'));
  const file = path.join(dir, 'run.sql');
  writeFileSync(file, `${statements.join(';\n')};\n`);
  try {
    execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--env', 'staging', '--local', '--file', file, '--yes'], {
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

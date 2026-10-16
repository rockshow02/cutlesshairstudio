import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Lokal saja: hapus data uji E2E sebelumnya dari D1 lokal (email berawalan e2e-, repro-, dbg-, atau nama berisi "E2E"),
 * agar jadwal tidak penuh oleh sisa run sebelumnya. Tidak pernah dijalankan ke staging/produksi.
 */
export default function globalSetup() {
  if (process.env.E2E_BASE_URL) return;
  const who = `(SELECT id FROM customers WHERE email LIKE 'e2e-%' OR email LIKE 'repro-%' OR email LIKE 'dbg-%' OR name LIKE '%E2E%')`;
  const sql = [
    `DELETE FROM booking_slots WHERE booking_id IN (SELECT id FROM bookings WHERE customer_id IN ${who})`,
    `DELETE FROM bookings WHERE customer_id IN ${who}`,
    `DELETE FROM sessions WHERE customer_id IN ${who}`,
    `DELETE FROM customers WHERE id IN ${who}`,
    `DELETE FROM rate_limits`,
  ].join(';\n');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cutless-e2e-'));
  const file = path.join(dir, 'cleanup.sql');
  writeFileSync(file, `${sql};\n`);
  try {
    execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--env', 'staging', '--local', '--file', file, '--yes'], {
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

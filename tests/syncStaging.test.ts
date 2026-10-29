/**
 * Sinkron main → staging (scripts/sync-staging.mjs) diuji dengan repo git sungguhan di folder sementara: origin (bare),
 * checkout runner, dan clone "orang lain" yang mendorong ke staging di tengah sinkron. Pemeriksaan (npm ci, tes, build)
 * diganti skrip kecil yang bisa disetel lolos / gagal / gagal sekali.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error modul JS tanpa deklarasi tipe
import { MERGE_MESSAGE, reasonOf, sync } from '../scripts/sync-staging.mjs';

type Result = { result: string; attempts: number; files?: string[]; failed?: string; retried?: boolean; flaky: string[]; sha?: string; error?: string };

let dir: string;
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=Uji', '-c', 'user.email=uji@example.com', '-c', 'core.autocrlf=false', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const commit = (cwd: string, file: string, text: string) => {
  writeFileSync(path.join(cwd, file), text);
  git(cwd, 'add', file);
  git(cwd, 'commit', '--quiet', '-m', `ubah ${file}`);
};
/** Skrip pemeriksaan palsu: node <file> → kode keluar dari isi skrip */
const script = (name: string, body: string) => {
  const file = path.join(dir, `${name}.cjs`);
  writeFileSync(file, body);
  return `node "${file}"`;
};
const counter = (name: string) => path.join(dir, `${name}.count`).replace(/\\/g, '/');
const lines = (cwd: string, ref: string) => git(cwd, 'log', '--format=%s', ref).split('\n');

/** origin: main & staging (staging = main + 1 commit fitur); work = checkout runner; other = clone pihak lain */
let origin: string, work: string, other: string;
const logs: string[] = [];
const run = (opts: Record<string, unknown> = {}): Promise<Result> =>
  sync({ cwd: work, checks: [], wait: () => {}, log: (l: string) => logs.push(l), ...opts });

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'sync-staging-'));
  logs.length = 0;
  origin = path.join(dir, 'origin.git');
  const seed = path.join(dir, 'seed');
  git(dir, 'init', '--quiet', '--bare', '--initial-branch=main', origin);
  git(dir, 'clone', '--quiet', origin, seed);
  commit(seed, 'konten.json', '{"v":1}\n');
  git(seed, 'push', '--quiet', 'origin', 'HEAD:main');
  git(seed, 'switch', '--quiet', '-c', 'staging');
  commit(seed, 'fitur.ts', 'export const a = 1;\n');
  git(seed, 'push', '--quiet', 'origin', 'staging');
  work = path.join(dir, 'work');
  other = path.join(dir, 'other');
  git(dir, 'clone', '--quiet', '--branch', 'staging', origin, work);
  git(dir, 'clone', '--quiet', origin, other);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Edit konten di main (seperti Pages CMS) */
const editMain = (file = 'konten.json', text = '{"v":2}\n') => {
  git(other, 'switch', '--quiet', 'main');
  git(other, 'pull', '--quiet', 'origin', 'main');
  commit(other, file, text);
  git(other, 'push', '--quiet', 'origin', 'HEAD:main');
};

describe('sinkron main → staging', { timeout: 60_000 }, () => {
  it('staging sudah memuat main → up-to-date, tidak ada push', async () => {
    const before = git(origin, 'rev-parse', 'staging');
    expect((await run()).result).toBe('up-to-date');
    expect(git(origin, 'rev-parse', 'staging')).toBe(before);
  });

  it('commit baru di main → di-merge & di-push ke staging (commit fitur staging tetap ada)', async () => {
    editMain();
    const r = await run();
    expect(r).toMatchObject({ result: 'synced', attempts: 1, flaky: [] });
    expect(lines(origin, 'staging')[0]).toBe(MERGE_MESSAGE);
    expect(git(origin, 'show', 'staging:konten.json')).toBe('{"v":2}');
    expect(git(origin, 'show', 'staging:fitur.ts')).toContain('a = 1');
    expect(reasonOf(r)).toContain(r.sha);
  });

  it('bentrok (file sama diubah di main & staging) → conflict + daftar file, staging tidak berubah', async () => {
    git(other, 'switch', '--quiet', 'staging');
    commit(other, 'konten.json', '{"v":"staging"}\n');
    git(other, 'push', '--quiet', 'origin', 'staging');
    const before = git(origin, 'rev-parse', 'staging');
    editMain();
    const r = await run();
    expect(r).toMatchObject({ result: 'conflict', files: ['konten.json'] });
    expect(git(origin, 'rev-parse', 'staging')).toBe(before);
    expect(reasonOf(r)).toBe('bentrok di: konten.json');
  });

  it('tes gagal sekali lalu lolos saat diulang → tetap tersinkron, dicatat flaky', async () => {
    editMain();
    const flakyCmd = script('flaky', `
      const fs = require('fs'); const f = '${counter('flaky')}';
      const n = fs.existsSync(f) ? Number(fs.readFileSync(f, 'utf8')) : 0; fs.writeFileSync(f, String(n + 1));
      process.exit(n === 0 ? 1 : 0);`);
    const r = await run({ checks: [{ name: 'Tes unit', cmd: flakyCmd, retry: true }] });
    expect(r).toMatchObject({ result: 'synced', flaky: ['Tes unit'] });
    expect(readFileSync(counter('flaky'), 'utf8')).toBe('2');
    expect(logs.some((l) => l.includes('::warning') && l.includes('Tes unit'))).toBe(true);
  });

  it('tes gagal 2× → checks-failed (kegagalan sungguhan), tidak ada push; pemeriksaan tanpa retry tidak diulang', async () => {
    editMain();
    const before = git(origin, 'rev-parse', 'staging');
    const failCmd = script('fail', `
      const fs = require('fs'); const f = '${counter('fail')}';
      fs.writeFileSync(f, String((fs.existsSync(f) ? Number(fs.readFileSync(f, 'utf8')) : 0) + 1)); process.exit(1);`);
    const r = await run({ checks: [{ name: 'Tes unit', cmd: failCmd, retry: true }] });
    expect(r).toMatchObject({ result: 'checks-failed', failed: 'Tes unit', retried: true, flaky: [] });
    expect(readFileSync(counter('fail'), 'utf8')).toBe('2');
    expect(git(origin, 'rev-parse', 'staging')).toBe(before);
    expect(reasonOf(r)).toBe('pemeriksaan "Tes unit" gagal pada hasil merge main → staging (juga saat diulang)');

    rmSync(counter('fail'));
    const lint = await run({ checks: [{ name: 'Lint', cmd: failCmd }] });
    expect(lint).toMatchObject({ result: 'checks-failed', failed: 'Lint', retried: false });
    expect(readFileSync(counter('fail'), 'utf8')).toBe('1');
  });

  /** Pemeriksaan yang, selama `times` kali pertama, mendorong commit baru ke staging (merge fitur di tengah sinkron) */
  const racer = (times: number) =>
    script('racer', `
      const fs = require('fs'); const { execFileSync } = require('child_process'); const f = '${counter('racer')}';
      const n = fs.existsSync(f) ? Number(fs.readFileSync(f, 'utf8')) : 0; fs.writeFileSync(f, String(n + 1));
      if (n < ${times}) {
        const g = (...a) => execFileSync('git', ['-c', 'user.name=Uji', '-c', 'user.email=uji@example.com', ...a], { cwd: '${other.replace(/\\/g, '/')}' });
        g('fetch', '--quiet', 'origin'); g('switch', '--quiet', '-C', 'staging', 'origin/staging');
        fs.writeFileSync('${other.replace(/\\/g, '/')}/fitur-' + n + '.ts', 'x');
        g('add', '.'); g('commit', '--quiet', '-m', 'fitur baru ' + n); g('push', '--quiet', 'origin', 'staging');
      }`);

  it('staging berubah saat sinkron → push ditolak → fetch ulang & diulang; hasil memuat semuanya', async () => {
    editMain();
    const r = await run({ checks: [{ name: 'Build staging', cmd: racer(1) }] });
    expect(r).toMatchObject({ result: 'synced', attempts: 2 });
    expect(lines(origin, 'staging')).toEqual(expect.arrayContaining([MERGE_MESSAGE, 'fitur baru 0', 'ubah konten.json']));
    expect(existsSync(path.join(work, 'fitur-0.ts'))).toBe(true);
    // Pemeriksaan dijalankan ulang pada hasil merge yang baru
    expect(readFileSync(counter('racer'), 'utf8')).toBe('2');
    expect(logs.some((l) => l.includes('push ditolak') && l.includes('(2/3)'))).toBe(true);
  });

  it('push ditolak terus → berhenti setelah 3× (push-rejected), tanpa memaksa (force) staging', async () => {
    editMain();
    const r = await run({ checks: [{ name: 'Build staging', cmd: racer(99) }] });
    expect(r).toMatchObject({ result: 'push-rejected', attempts: 3 });
    expect(reasonOf(r)).toMatch(/^push ke staging ditolak 3×/);
    // Commit pihak lain tetap utuh; hasil merge sinkron tidak pernah masuk
    expect(lines(origin, 'staging')).toEqual(expect.arrayContaining(['fitur baru 0', 'fitur baru 1', 'fitur baru 2']));
    expect(lines(origin, 'staging')).not.toContain(MERGE_MESSAGE);
  });

  it('CLI seperti di workflow (salinan di luar checkout, --cwd): bentrok → exit 1, GITHUB_OUTPUT & ringkasan terisi', async () => {
    git(other, 'switch', '--quiet', 'staging');
    commit(other, 'konten.json', '{"v":"staging"}\n');
    git(other, 'push', '--quiet', 'origin', 'staging');
    editMain();
    const cli = path.join(dir, 'sync-staging.mjs');
    copyFileSync('scripts/sync-staging.mjs', cli);
    const out = path.join(dir, 'output.txt');
    const summary = path.join(dir, 'summary.md');
    const env = { ...process.env, GITHUB_OUTPUT: out, GITHUB_STEP_SUMMARY: summary };
    const r = spawnSync(process.execPath, [cli, '--cwd', work], { env, encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('::error title=Sinkron main → staging gagal::bentrok di: konten.json');
    expect(readFileSync(out, 'utf8')).toMatch(/^result=conflict$/m);
    expect(readFileSync(out, 'utf8')).toMatch(/^reason=bentrok di: konten\.json$/m);
    expect(readFileSync(summary, 'utf8')).toContain('✗ Sinkron gagal: bentrok di: konten.json');
  });

  it('CLI: error tak terduga (mis. --cwd bukan repo git) → ditangkap: exit 1, reason & ::error terisi, bukan crash', async () => {
    const notRepo = path.join(dir, 'bukan-repo');
    mkdirSync(notRepo);
    const out = path.join(dir, 'output.txt');
    const r = spawnSync(process.execPath, ['scripts/sync-staging.mjs', '--cwd', notRepo], { env: { ...process.env, GITHUB_OUTPUT: out }, encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).not.toMatch(/at .*sync-staging\.mjs/); // tidak ada stack trace crash
    expect(readFileSync(out, 'utf8')).toMatch(/^result=error$/m);
    expect(readFileSync(out, 'utf8')).toMatch(/^reason=skrip sinkron error: git fetch --quiet origin main staging: .+/m);
    expect(r.stdout).toContain('::error title=Sinkron main → staging gagal::skrip sinkron error:');
  });
});

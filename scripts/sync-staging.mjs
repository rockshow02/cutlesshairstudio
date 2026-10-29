#!/usr/bin/env node
/**
 * Sinkron main → staging (dipanggil .github/workflows/sync-staging.yml; aturan: CONTRIBUTING.md §5).
 *
 *   node scripts/sync-staging.mjs [--cwd <checkout>]   # checkout repo (remote "origin", riwayat penuh);
 *                                                       # default: folder repo tempat skrip ini berada
 *
 * Setiap percobaan: fetch main & staging terbaru → merge main ke staging (lokal) → pemeriksaan yang sama dengan
 * CI staging → push ke staging. Push ditolak karena staging berubah di tengah jalan (mis. merge fitur) → ulang dari
 * staging terbaru, maks. 3×. Langkah yang bisa gagal karena kebetulan (install via jaringan, tes unit) diulang sekali;
 * lolos saat diulang → sinkron jalan terus, dicatat "kemungkinan flaky". Gagal 2× → kegagalan sungguhan.
 *
 * Hasil (result): synced | up-to-date | conflict | checks-failed | push-rejected. Di GitHub Actions ditulis ke
 * $GITHUB_OUTPUT (result, attempts, files, failed, flaky, sha, error) & $GITHUB_STEP_SUMMARY; selain synced /
 * up-to-date → exit 1, lalu workflow membuat PR berlabel perlu-dicek. sync() diuji tests/syncStaging.test.ts.
 */
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const DEFAULT_CHECKS = [
  { name: 'Install dependensi', cmd: 'npm ci --no-audit --no-fund', retry: true }, // jaringan
  { name: 'Typecheck', cmd: 'npm run typecheck' },
  { name: 'Lint', cmd: 'npm run lint' },
  { name: 'Tes unit', cmd: 'npm test', retry: true }, // tes flaky: diulang sekali
  { name: 'Validasi konten', cmd: 'npm run check:content' },
  { name: 'Build staging', cmd: 'npm run build:staging' },
];

export const MERGE_MESSAGE = 'Merge main → staging (sinkron otomatis)';
const BOT = ['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Jalankan perintah; stdout+stderr ditampung (pipe) atau langsung ke log (inherit) */
function exec(cmd, args, { cwd, shell = false, inherit = false }) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell, stdio: inherit ? 'inherit' : 'pipe' });
    let out = '';
    child.stdout?.on('data', (d) => (out += d));
    child.stderr?.on('data', (d) => (out += d));
    child.on('error', (e) => resolve({ ok: false, out: String(e) }));
    child.on('close', (code) => resolve({ ok: code === 0, out: out.trim() }));
  });
}

/**
 * @param {object} o
 * @param {string} o.cwd checkout repo (branch apa pun; hasil merge di-push sebagai staging)
 * @param {{name: string, cmd: string, retry?: boolean}[]} [o.checks]
 * @param {number} [o.maxPush] percobaan push maksimal
 * @param {(attempt: number) => Promise<void> | void} [o.wait] jeda sebelum percobaan berikutnya
 * @param {(line: string) => void} [o.log]
 */
export async function sync({ cwd, remote = 'origin', checks = DEFAULT_CHECKS, maxPush = 3, wait = (n) => sleep(n * 5000), log = console.log }) {
  const git = (...args) => exec('git', args, { cwd });
  const must = async (...args) => {
    const r = await git(...args);
    if (!r.ok) throw new Error(`git ${args.join(' ')}: ${r.out}`);
    return r.out;
  };
  const run = async (check) => {
    log(`::group::${check.name}`);
    const r = await exec(check.cmd, [], { cwd, shell: true, inherit: true });
    log('::endgroup::');
    return r.ok;
  };
  const flaky = [];

  for (let attempt = 1; ; attempt++) {
    await must('fetch', '--quiet', remote, 'main', 'staging');
    await must('checkout', '--quiet', '--force', '--detach', `${remote}/staging`);
    const behind = Number(await must('rev-list', '--count', `${remote}/staging..${remote}/main`));
    if (behind === 0) return { result: 'up-to-date', attempts: attempt, flaky };

    if (!(await git(...BOT, 'merge', '--no-ff', '--no-edit', '-m', MERGE_MESSAGE, `${remote}/main`)).ok) {
      const files = (await must('diff', '--name-only', '--diff-filter=U')).split('\n').filter(Boolean);
      await git('merge', '--abort');
      return { result: 'conflict', attempts: attempt, files, flaky };
    }

    for (const check of checks) {
      if (await run(check)) continue;
      if (check.retry) {
        log(`::warning title=Sinkron: diulang::${check.name} gagal; diulang sekali (mungkin kebetulan / flaky)`);
        if (await run(check)) {
          if (!flaky.includes(check.name)) flaky.push(check.name);
          continue;
        }
      }
      return { result: 'checks-failed', attempts: attempt, failed: check.name, retried: Boolean(check.retry), flaky };
    }

    const push = await git('push', '--quiet', remote, 'HEAD:staging');
    if (push.ok) return { result: 'synced', attempts: attempt, sha: await must('rev-parse', '--short', 'HEAD'), flaky };
    if (attempt >= maxPush) return { result: 'push-rejected', attempts: attempt, error: push.out, flaky };
    log(`::warning title=Sinkron: push ditolak::staging berubah saat sinkron; ulang dari staging terbaru (${attempt + 1}/${maxPush})`);
    await wait(attempt);
  }
}

/** Kalimat alasan untuk ringkasan run & komentar PR perlu-dicek */
export function reasonOf(r) {
  switch (r.result) {
    case 'synced': return `main digabung ke staging (${r.sha}); Cloudflare mendeploy staging otomatis.`;
    case 'up-to-date': return 'staging sudah memuat semua commit main.';
    case 'conflict': return `bentrok di: ${r.files.join(', ')}`;
    case 'checks-failed': return `pemeriksaan "${r.failed}" gagal pada hasil merge main → staging${r.retried ? ' (juga saat diulang)' : ''}`;
    case 'push-rejected': return `push ke staging ditolak ${r.attempts}× (staging terus berubah, atau izin/ruleset menolak): ${r.error}`;
    default: return 'langkah sinkron gagal (lihat log run)';
  }
}

/* ---------- CLI ---------- */

async function main() {
  const i = process.argv.indexOf('--cwd');
  const cwd = i > 0 ? path.resolve(process.argv[i + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const r = await sync({ cwd });
  const ok = r.result === 'synced' || r.result === 'up-to-date';
  const output = { result: r.result, attempts: r.attempts, files: r.files?.join(' '), failed: r.failed, flaky: r.flaky.join(', '), sha: r.sha, error: r.error };
  const reason = reasonOf(r);
  const env = process.env;
  if (env.GITHUB_OUTPUT) {
    const lines = Object.entries(output).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${String(v).replace(/\n/g, ' ')}`);
    appendFileSync(env.GITHUB_OUTPUT, `${lines.join('\n')}\nreason=${reason.replace(/\n/g, ' ')}\n`);
  }
  const summary = [ok ? `✓ ${reason}` : `✗ Sinkron gagal: ${reason}`];
  if (r.attempts > 1) summary.push(`Percobaan: ${r.attempts} (staging berubah di tengah sinkron).`);
  if (r.flaky.length) {
    summary.push(`⚠ Gagal lalu lolos saat diulang (kemungkinan flaky, perlu diperiksa): ${r.flaky.join(', ')}.`);
    console.log(`::warning title=Sinkron: kemungkinan flaky::${r.flaky.join(', ')} gagal lalu lolos saat diulang`);
  }
  if (!ok) console.log(`::error title=Sinkron main → staging gagal::${reason.replace(/\n/g, ' ')}`);
  console.log(summary.join('\n'));
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${summary.join('\n\n')}\n`);
  return ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main());

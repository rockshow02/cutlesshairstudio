#!/usr/bin/env node
/**
 * npm run dev:sync: dev server + tarik otomatis perubahan Pages CMS dari branch `staging`.
 *
 * 1. Memastikan branch lokal = staging dan tidak ada perubahan lokal yang belum di-commit
 *    (bila ada: berhenti dengan pesan jelas, TIDAK menimpa apa pun).
 * 2. Menjalankan Vite (mode development) di http://localhost:5173.
 * 3. Setiap 15 detik: git fetch origin staging → git merge --ff-only origin/staging.
 *    Vite mendeteksi file JSON yang berubah lalu me-reload browser; konten tidak valid tampil sebagai overlay.
 *
 * Hanya fast-forward: bila branch lokal punya commit sendiri (belum di-push) atau ada file yang diubah,
 * sinkron dijeda (dev server tetap jalan) sampai kondisinya bersih lagi.
 * Interval bisa diubah: DEV_SYNC_INTERVAL=30 npm run dev:sync (detik). Node saja, lintas OS.
 */
import { spawn, execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';

const BRANCH = 'staging';
const REMOTE = 'origin';
const INTERVAL = Math.max(5, Number(process.env.DEV_SYNC_INTERVAL) || 15) * 1000;
const run = promisify(execFile);

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};
const time = () => new Date().toLocaleTimeString('id-ID', { hour12: false });
const log = (msg) => console.log(`${c.dim(`[sync ${time()}]`)} ${msg}`);

async function git(...args) {
  const { stdout } = await run('git', args, { windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
  return stdout.trim();
}

/** Perubahan file yang dilacak git (file baru yang belum dilacak tidak dihitung; git sendiri menolak menimpanya) */
const dirtyFiles = async () => (await git('status', '--porcelain', '--untracked-files=no')).split('\n').filter(Boolean);
const currentBranch = () => git('rev-parse', '--abbrev-ref', 'HEAD');

function fail(lines) {
  console.error(`\n${c.red('✗ dev:sync dihentikan')}\n${lines.map((l) => `  ${l}`).join('\n')}\n`);
  process.exit(1);
}

/* ---------- Pemeriksaan awal ---------- */

try {
  await git('rev-parse', '--is-inside-work-tree');
} catch {
  fail(['Folder ini bukan repo git.']);
}

const startBranch = await currentBranch();
if (startBranch !== BRANCH) {
  fail([
    `Branch lokal sekarang "${startBranch}", dev:sync hanya untuk branch "${BRANCH}".`,
    `Pindah dulu:  git switch ${BRANCH}`,
    `(Mengerjakan fitur? Pakai "npm run dev" di branch feature/*.)`,
  ]);
}

const startDirty = await dirtyFiles();
if (startDirty.length) {
  fail([
    'Ada perubahan lokal yang belum di-commit. dev:sync tidak akan menimpanya:',
    ...startDirty.slice(0, 10).map((l) => `  ${l}`),
    ...(startDirty.length > 10 ? [`  … dan ${startDirty.length - 10} file lain`] : []),
    'Simpan dulu (git commit / git stash), lalu jalankan lagi.',
  ]);
}

/* ---------- Sinkron ---------- */

let paused = ''; // alasan jeda terakhir (agar pesan yang sama tidak diulang tiap 15 detik)
let busy = false;

function pause(reason, hint) {
  if (paused === reason) return;
  paused = reason;
  log(`${c.yellow('⏸ sinkron dijeda:')} ${reason}${hint ? `\n            ${hint}` : ''}`);
}

async function sync({ initial = false } = {}) {
  if (busy) return;
  busy = true;
  try {
    const branch = await currentBranch();
    if (branch !== BRANCH) return pause(`branch lokal sekarang "${branch}"`, `Kembali ke ${BRANCH} untuk melanjutkan: git switch ${BRANCH}`);
    const dirty = await dirtyFiles();
    if (dirty.length) return pause(`ada ${dirty.length} file yang diubah lokal`, 'Commit/stash dulu; sinkron lanjut otomatis.');

    await git('fetch', '--quiet', REMOTE, BRANCH);
    const [behind, ahead] = (await git('rev-list', '--left-right', '--count', `${REMOTE}/${BRANCH}...HEAD`)).split(/\s+/).map(Number);
    if (ahead > 0 && behind > 0) {
      return pause(`branch lokal & ${REMOTE}/${BRANCH} bercabang (${ahead} commit lokal, ${behind} commit baru di GitHub)`,
        `Gabungkan manual: git pull --rebase ${REMOTE} ${BRANCH}  (lalu git push)`);
    }
    if (behind === 0) {
      if (paused) log(c.green('▶ sinkron berjalan lagi'));
      paused = '';
      if (initial) log(c.green(`✓ sudah sama dengan ${REMOTE}/${BRANCH}`) + (ahead ? c.dim(` (${ahead} commit lokal belum di-push)`) : ''));
      return;
    }

    const before = await git('rev-parse', 'HEAD');
    await git('merge', '--ff-only', '--quiet', `${REMOTE}/${BRANCH}`);
    paused = '';
    const files = (await git('diff', '--name-only', before, 'HEAD')).split('\n').filter(Boolean);
    const subjects = (await git('log', '--format=%s (%an)', `${before}..HEAD`)).split('\n').filter(Boolean);
    log(`${c.green(`↓ ${behind} commit baru dari ${REMOTE}/${BRANCH}`)}\n${subjects.slice(0, 5).map((s) => `            • ${s}`).join('\n')}`);
    log(c.dim(`file berubah: ${files.slice(0, 8).join(', ')}${files.length > 8 ? ` +${files.length - 8}` : ''}`));
    if (files.some((f) => f === 'package.json' || f === 'package-lock.json')) {
      log(c.yellow('⚠ package.json berubah: hentikan (Ctrl+C), jalankan "npm install", lalu "npm run dev:sync" lagi.'));
    }
  } catch (error) {
    pause(`git gagal: ${String(error.stderr || error.message).trim().split('\n')[0]}`, 'Cek koneksi internet / akses GitHub. Dicoba lagi otomatis.');
  } finally {
    busy = false;
  }
}

/* ---------- Jalankan ---------- */

log(`Menarik ${REMOTE}/${BRANCH} setiap ${INTERVAL / 1000} detik. Hentikan dengan Ctrl+C.`);
await sync({ initial: true });

// Vite dijalankan langsung lewat Node (tanpa shell) agar sama di Windows/macOS/Linux
const require = createRequire(import.meta.url);
const viteBin = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
const vite = spawn(process.execPath, [viteBin, '--mode', 'development', ...process.argv.slice(2)], { stdio: 'inherit' });

const timer = setInterval(() => void sync(), INTERVAL);

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  if (vite.exitCode === null) vite.kill();
  process.exit(code);
}
vite.on('exit', (code) => {
  if (!stopping) log(`Vite berhenti (kode ${code ?? 0}).`);
  stop(code ?? 0);
});
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

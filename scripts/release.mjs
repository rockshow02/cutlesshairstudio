#!/usr/bin/env node
/**
 * Versi rilis: package.json "version" (semver) + CHANGELOG.md (format Keep a Changelog) + tag git vX.Y.Z.
 *
 *   node scripts/release.mjs check          # PR staging/hotfix → main (CI) & sebelum membuat rilis:
 *                                           # versi > tag v* terakhir, tag belum ada, bagian CHANGELOG ada & berisi
 *   node scripts/release.mjs notes [versi]  # cetak isi bagian CHANGELOG versi itu (default: versi package.json)
 *   node scripts/release.mjs version        # cetak versi package.json
 *
 * Fungsi di bawah murni (diuji tests/release.test.ts); hanya CLI yang membaca file & tag git.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** "1.2.3" atau "v1.2.3" → [1, 2, 3]; selain itu null */
export function parseVersion(value) {
  const m = SEMVER.exec(String(value).trim().replace(/^v/, ''));
  return m ? m.slice(1).map(Number) : null;
}

/** < 0 bila a < b, 0 bila sama, > 0 bila a > b */
export function compareVersions(a, b) {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  if (!x || !y) throw new Error(`versi tidak valid: ${!x ? a : b}`);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** Tag vX.Y.Z tertinggi dari daftar tag git (tag lain diabaikan); undefined bila belum ada */
export function latestVersionTag(tags) {
  return tags
    .map((t) => t.trim())
    .filter((t) => /^v\d+\.\d+\.\d+$/.test(t))
    .sort((a, b) => compareVersions(b, a))[0];
}

/** Isi bagian "## [X.Y.Z] - tanggal" di CHANGELOG (tanpa judulnya), dipangkas; null bila tidak ada */
export function changelogSection(changelog, version) {
  const lines = changelog.replace(/\r\n/g, '\n').split('\n');
  const escaped = version.replace(/\./g, '\\.');
  const start = lines.findIndex((l) => new RegExp(`^## \\[${escaped}\\](?:\\s|$)`).test(l));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^## /.test(l) || /^\[[^\]]+\]:\s/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

/** Tanggal di judul bagian, mis. "## [1.1.0] - 2026-10-27" → "2026-10-27" */
export function changelogDate(changelog, version) {
  const escaped = version.replace(/\./g, '\\.');
  return new RegExp(`^## \\[${escaped}\\] - (\\d{4}-\\d{2}-\\d{2})`, 'm').exec(changelog)?.[1];
}

/**
 * Masalah yang mencegah rilis versi `version` (kosong = siap). Pesan menjelaskan langkah perbaikannya.
 * `tags` = semua tag git di repo.
 */
export function releaseProblems({ version, changelog, tags }) {
  const problems = [];
  if (!parseVersion(version)) {
    return [`"version" di package.json (${version}) bukan semver X.Y.Z.`];
  }
  const latest = latestVersionTag(tags);
  if (tags.includes(`v${version}`)) {
    problems.push(
      `Tag v${version} sudah ada: versi belum dinaikkan. Naikkan "version" di package.json (fitur: MINOR, mis. 1.2.0 → 1.3.0; hotfix: PATCH, mis. 1.2.0 → 1.2.1), lalu tambahkan bagian "## [versi baru] - YYYY-MM-DD" di CHANGELOG.md.`,
    );
  } else if (latest && compareVersions(version, latest) <= 0) {
    problems.push(`Versi ${version} tidak lebih tinggi dari rilis terakhir ${latest}. Naikkan "version" di package.json di atas ${latest.slice(1)}.`);
  }
  const section = changelogSection(changelog, version);
  if (section === null) {
    problems.push(`CHANGELOG.md belum punya bagian "## [${version}] - YYYY-MM-DD". Pindahkan isi "## [Belum dirilis]" ke bagian itu.`);
  } else if (!section.replace(/^#+.*$/gm, '').trim()) {
    problems.push(`Bagian "## [${version}]" di CHANGELOG.md masih kosong. Tulis perubahan yang dirilis (Ditambahkan / Diubah / Diperbaiki).`);
  } else if (!changelogDate(changelog, version)) {
    problems.push(`Judul bagian "## [${version}]" di CHANGELOG.md belum bertanggal. Tulis "## [${version}] - YYYY-MM-DD".`);
  }
  return problems;
}

/* ---------- CLI ---------- */

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const changelog = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const [command = 'check', arg] = process.argv.slice(2);

  if (command === 'version') {
    console.log(version);
    return 0;
  }
  if (command === 'notes') {
    const v = (arg ?? version).replace(/^v/, '');
    const section = changelogSection(changelog, v);
    if (section === null) {
      console.error(`CHANGELOG.md tidak punya bagian "## [${v}]".`);
      return 1;
    }
    console.log(section);
    return 0;
  }
  if (command === 'check') {
    const tags = execFileSync('git', ['tag', '--list'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
    const problems = releaseProblems({ version, changelog, tags });
    const inActions = process.env.GITHUB_ACTIONS === 'true';
    if (problems.length) {
      console.error(`✗ Belum siap dirilis sebagai v${version}:`);
      for (const p of problems) {
        console.error(`  • ${p}`);
        if (inActions) console.log(`::error file=package.json,title=Versi rilis::${p}`);
      }
      return 1;
    }
    console.log(`✓ Siap dirilis: v${version} (rilis terakhir: ${latestVersionTag(tags) ?? 'belum ada'})`);
    return 0;
  }
  console.error(`Perintah tidak dikenal: ${command}. Pakai: check | notes [versi] | version`);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());

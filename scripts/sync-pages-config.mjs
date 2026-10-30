#!/usr/bin/env node
/**
 * npm run sync-cms
 *
 * Pages CMS hanya bisa merujuk "collection", sedangkan cabang disimpan sebagai daftar di
 * src/content/branches.json. Script ini menyalin daftar cabang ke setiap pilihan cabang di .pages.yml
 * (blok di antara "# @branch-options-start" dan "# @branch-options-end"), sehingga cabang baru
 * otomatis muncul di dropdown Barber / Harga / Promo / Pengumuman.
 * Juga: nama Barber → pilihan "Penulis" Tips & Trik (blok @barber-options) dan nama kartu Layanan → pilihan
 * "Layanan terkait" (blok @service-options).
 *
 * Dijalankan otomatis oleh GitHub Actions setiap kali konten berubah (lihat .github/workflows).
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = path.join(ROOT, '.pages.yml');
const BRANCHES = path.join(ROOT, 'src', 'content', 'branches.json');
const BARBERS = path.join(ROOT, 'src', 'content', 'barbers.json');
const SERVICES = path.join(ROOT, 'src', 'content', 'services.json');

const START = /^(\s*)# @branch-options-start.*$/;
const END = /^\s*# @branch-options-end/;

const quote = (v) => JSON.stringify(String(v));

/**
 * Isi ulang setiap blok pilihan cabang di teks .pages.yml dari daftar cabang (urut "Urutan").
 * Murni (tanpa baca/tulis file): diuji dengan data uji di tests/branch-pricing.test.ts.
 */
export function syncBranchOptions(configText, branchList) {
  const branches = branchList
    .filter((b) => b && typeof b.slug === 'string' && b.slug.trim())
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const lines = configText.split(/\r?\n/);
  const out = [];
  let blocks = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const start = lines[i].match(START);
    if (!start) {
      out.push(lines[i]);
      continue;
    }
    const indent = start[1];
    out.push(lines[i]);
    out.push(`${indent}values:`);
    for (const b of branches) {
      out.push(`${indent}  - name: ${quote(b.slug)}`);
      out.push(`${indent}    label: ${quote(`${b.name}${b.city && !b.name.includes(b.city) ? ` (${b.city})` : ''}`)}`);
    }
    // lewati isi lama sampai penanda akhir
    while (i + 1 < lines.length && !END.test(lines[i + 1])) i += 1;
    blocks += 1;
  }
  return { text: out.join('\n'), branches: branches.length, blocks };
}

/**
 * Isi ulang blok "# @<tag>-options-start" … "# @<tag>-options-end" dengan daftar nama (nilai = label = nama, urut
 * "Urutan", nama ganda sekali saja). Murni: diuji tests/tips.test.ts.
 */
export function syncNameOptions(configText, tag, list) {
  const names = [...new Set(
    list
      .filter((x) => x && typeof x.name === 'string' && x.name.trim())
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((x) => x.name.trim()),
  )];
  const start = new RegExp(`^(\\s*)# @${tag}-options-start.*$`);
  const end = new RegExp(`^\\s*# @${tag}-options-end`);
  const lines = configText.split(/\r?\n/);
  const out = [];
  let blocks = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(start);
    out.push(lines[i]);
    if (!m) continue;
    out.push(`${m[1]}values:`);
    for (const name of names) out.push(`${m[1]}  - name: ${quote(name)}`, `${m[1]}    label: ${quote(name)}`);
    while (i + 1 < lines.length && !end.test(lines[i + 1])) i += 1;
    blocks += 1;
  }
  return { text: out.join('\n'), count: names.length, blocks };
}

async function main() {
  const current = await readFile(CONFIG, 'utf8');
  const read = async (file) => JSON.parse(await readFile(file, 'utf8'));
  const branchesResult = syncBranchOptions(current, await read(BRANCHES));
  const barbersResult = syncNameOptions(branchesResult.text, 'barber', await read(BARBERS));
  const servicesResult = syncNameOptions(barbersResult.text, 'service', await read(SERVICES));
  const next = servicesResult.text;
  const summary = `${branchesResult.branches} cabang di ${branchesResult.blocks} dropdown, ${barbersResult.count} barber, ${servicesResult.count} layanan`;
  if (next.replace(/\r\n/g, '\n') === current.replace(/\r\n/g, '\n')) {
    console.log(`Pilihan di .pages.yml sudah sesuai (${summary}).`);
    return;
  }
  await writeFile(CONFIG, next);
  console.log(`✓ .pages.yml diperbarui: ${summary}.`);
}

// Hanya saat dijalankan langsung (npm run sync-cms), bukan saat diimpor tes
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('Gagal sinkron .pages.yml:', error);
    process.exit(1);
  });
}

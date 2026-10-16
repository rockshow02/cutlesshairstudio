#!/usr/bin/env node
/**
 * Seed D1 (SATU KALI): memindahkan data cabang, hairstylist, dan harga dari Pages CMS
 * (src/content/branches.json, barbers.json, pricing.json) ke database booking, plus nilai default:
 * durasi layanan, jam kerja barber (ikut jam buka cabang, istirahat 13.00–14.00), layanan per barber.
 *
 *   node scripts/seed-d1.mjs [--out seed/seed.sql] [--test-data] [--owner email@bisnis.com] [--dev-admin] [--apply local|staging]
 *
 *   --test-data   tambah akun pelanggan uji (login lewat mock OAuth, hanya lokal/staging)
 *   --owner       email admin pertama (role owner) untuk dashboard /admin
 *   --dev-admin   tambah owner@localhost (hanya untuk wrangler dev lokal)
 *   --apply       langsung jalankan ke D1 lokal atau D1 STAGING (remote). Produksi sengaja tidak tersedia.
 *
 * Lalu jalankan (lihat npm run db:seed:local / db:seed:staging):
 *   wrangler d1 execute DB --env staging --local|--remote --file seed/seed.sql
 *
 * Aman dijalankan ulang: INSERT OR IGNORE (data yang sudah ada tidak ditimpa).
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const ROOT = process.cwd();
const read = async (file) => JSON.parse(await readFile(path.join(ROOT, 'src', 'content', file), 'utf8'));
const branchesJson = await read('branches.json');
const barbersJson = await read('barbers.json');
const pricingJson = await read('pricing.json');

/* ---------- Konversi ---------- */

const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const bool = (v) => (v ? 1 : 0);
const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_/+&]+/g, '-').replace(/-+/g, '-');
const isTodo = (v) => typeof v === 'string' && /\bTODO\b/i.test(v);
const clean = (v) => (v === undefined || v === null || v === '' || isTodo(v) ? null : v);
const num = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const STATUS = { Aktif: 'active', 'Segera Dibuka': 'coming_soon', 'Tutup Sementara': 'closed' };
const DAY = { Minggu: 0, Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5, Sabtu: 6 };

/** Durasi default (menit) sesuai brief; bisa diubah admin di dashboard */
const DURATION = [
  [/signature|^haircut$/i, 45],
  [/skin fade|taper/i, 45],
  [/haircut \+ wash/i, 60],
  [/haircut \+ shave/i, 60],
  [/hot towel shave/i, 30],
  [/beard trim/i, 20],
  [/kids/i, 30],
  [/hair spa/i, 45],
  [/hair tattoo/i, 30],
  [/hair wash & styling|wash & styling/i, 20],
  [/down perm/i, 60],
  [/perming/i, 150],
  [/coloring/i, 120],
  [/highlight|bleach/i, 180],
];
const durationFor = (name) => DURATION.find(([re]) => re.test(name))?.[1] ?? 45;

/** Jam kerja default barber: jam buka cabang, istirahat 13.00–14.00 bila cabang buka melewati jam itu */
function defaultWorkingRanges(open, close) {
  if (open < '13:00' && close > '14:00') return [[open, '13:00'], ['14:00', close]];
  return [[open, close]];
}

/* ---------- Bangun SQL ---------- */

const sql = [
  '-- Dibuat oleh scripts/seed-d1.mjs dari src/content/*.json. Jangan diedit manual.',
  'PRAGMA foreign_keys = ON;',
];
const push = (s) => sql.push(s);

// Cabang + jam buka
const branchId = new Map();
branchesJson
  .slice()
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  .forEach((b, i) => {
    const id = i + 1;
    branchId.set(b.slug, id);
    const whatsapp = /^62\d{8,13}$/.test(String(b.whatsappNumber)) ? b.whatsappNumber : '620000000000';
    push(
      `INSERT OR IGNORE INTO branches (id, slug, name, city, province, address, maps_url, lat, lng, whatsapp, timezone, status, photo, sort_order) VALUES (${[
        id, q(b.slug), q(b.name), q(b.city), q(clean(b.province) ?? ''), q(clean(b.address)), q(clean(b.googleMapsUrl)),
        q(num(b.latitude)), q(num(b.longitude)), q(whatsapp), q(b.timezone || 'Asia/Jakarta'), q(STATUS[b.status] ?? 'active'),
        q(clean(b.photo)), b.order ?? i,
      ].join(', ')});`,
    );
    for (const h of b.openingHours ?? []) {
      if (h.isClosed || !h.openTime || !h.closeTime || !(h.day in DAY)) continue;
      push(`INSERT OR IGNORE INTO branch_hours (branch_id, weekday, open_time, close_time) VALUES (${id}, ${DAY[h.day]}, ${q(h.openTime)}, ${q(h.closeTime)});`);
    }
  });

// Layanan (dari Daftar Harga) + harga per cabang
const serviceIds = [];
pricingJson.forEach((p, i) => {
  const id = i + 1;
  const bookable = p.category !== 'Paket';
  if (bookable) serviceIds.push(id);
  push(
    `INSERT OR IGNORE INTO services (id, slug, name, category, description, duration_min, buffer_min, base_price, price_from, badge, is_bookable, is_active, sort_order) VALUES (${[
      id, q(slugify(p.name)), q(p.name), q(p.category), q(clean(p.description)), durationFor(p.name), 10, p.price,
      bool(p.priceFrom), q(clean(p.badge)), bool(bookable), bool(p.isActive !== false), p.order ?? i,
    ].join(', ')});`,
  );
  const overrides = new Map((p.branchPrices ?? []).map((bp) => [bp.branchSlug, bp.price]));
  for (const [slug, bid] of branchId) {
    push(`INSERT OR IGNORE INTO branch_services (branch_id, service_id, price, is_active) VALUES (${bid}, ${id}, ${q(overrides.get(slug))}, 1);`);
  }
});

// Hairstylist + layanan + jam kerja default
barbersJson.forEach((b, i) => {
  const bid = branchId.get(b.branchSlug);
  if (!bid) {
    console.warn(`⚠ barber "${b.name}" dilewati: cabang "${b.branchSlug}" tidak ada`);
    return;
  }
  const id = i + 1;
  const wa = /^62\d{8,13}$/.test(String(b.whatsappNumber ?? '')) ? b.whatsappNumber : null;
  push(
    `INSERT OR IGNORE INTO barbers (id, branch_id, name, role, photo, specialty, instagram, whatsapp, is_active, sort_order) VALUES (${[
      id, bid, q(b.name), q(clean(b.role)), q(clean(b.photo)), q(clean(b.specialty)), q(clean(b.instagram)), q(wa),
      bool(b.isActive !== false), b.order ?? i,
    ].join(', ')});`,
  );
  for (const sid of serviceIds) push(`INSERT OR IGNORE INTO barber_services (barber_id, service_id) VALUES (${id}, ${sid});`);
  const branch = branchesJson.find((x) => x.slug === b.branchSlug);
  for (const h of branch.openingHours ?? []) {
    if (h.isClosed || !h.openTime || !h.closeTime || !(h.day in DAY)) continue;
    for (const [start, end] of defaultWorkingRanges(h.openTime, h.closeTime)) {
      push(
        `INSERT INTO working_hours (barber_id, weekday, start_time, end_time) SELECT ${id}, ${DAY[h.day]}, ${q(start)}, ${q(end)} ` +
          `WHERE NOT EXISTS (SELECT 1 FROM working_hours WHERE barber_id = ${id} AND weekday = ${DAY[h.day]} AND start_time = ${q(start)});`,
      );
    }
  }
});

// Admin
const owner = option('--owner');
if (owner) push(`INSERT OR IGNORE INTO admin_users (email, name, role) VALUES (${q(owner.toLowerCase())}, 'Owner', 'owner');`);
if (flag('--dev-admin')) {
  push(`INSERT OR IGNORE INTO admin_users (email, name, role) VALUES ('owner@localhost', 'Owner (dev)', 'owner');`);
  const firstBranch = [...branchId.values()][0];
  push(`INSERT OR IGNORE INTO admin_users (email, name, role, branch_id) VALUES ('admin.cabang@localhost', 'Admin Cabang (dev)', 'branch_admin', ${firstBranch});`);
  const firstBarber = barbersJson.findIndex((b) => b.isActive !== false) + 1;
  if (firstBarber > 0) {
    push(`INSERT OR IGNORE INTO admin_users (email, name, role, branch_id, barber_id) VALUES ('barber@localhost', 'Barber (dev)', 'barber', ${firstBranch}, ${firstBarber});`);
  }
}

// Akun pelanggan uji (login lewat mock OAuth: google_sub "mock:<email>")
if (flag('--test-data')) {
  const now = new Date().toISOString();
  const testers = [
    ['test-cust-1', 'budi@test.local', 'Budi Uji', '6281200000001'],
    ['test-cust-2', 'sari@test.local', 'Sari Uji', '6281200000002'],
    ['test-cust-3', 'baru@test.local', '', null], // profil belum lengkap
  ];
  for (const [id, email, name, phone] of testers) {
    push(
      `INSERT OR IGNORE INTO customers (id, google_sub, email, name, phone, privacy_consent_at, created_at) VALUES (${[
        q(id), q(`mock:${email}`), q(email), q(name), q(phone), q(phone ? now : null), q(now),
      ].join(', ')});`,
    );
  }
}

const out = path.join(ROOT, option('--out', 'seed/seed.sql'));
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, sql.join('\n') + '\n');
console.log(
  `✓ ${path.relative(ROOT, out)}: ${branchId.size} cabang, ${pricingJson.length} layanan (${serviceIds.length} bisa dibooking), ` +
    `${barbersJson.length} hairstylist${owner ? `, owner ${owner}` : ''}${flag('--test-data') ? ', akun uji' : ''}`,
);

const apply = option('--apply');
if (apply) {
  if (!['local', 'staging'].includes(apply)) {
    console.error('--apply hanya menerima "local" atau "staging" (produksi menunggu persetujuan klien).');
    process.exit(1);
  }
  const wranglerArgs = ['wrangler', 'd1', 'execute', 'DB', '--env', 'staging', apply === 'local' ? '--local' : '--remote', '--file', out, '--yes'];
  console.log(`→ npx ${wranglerArgs.join(' ')}`);
  const r = spawnSync('npx', wranglerArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
  process.exit(r.status ?? 1);
}

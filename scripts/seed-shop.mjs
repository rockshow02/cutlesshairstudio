#!/usr/bin/env node
/**
 * Seed produk Cutless Shop SEKALI dari src/content/products.json (Pages CMS) ke D1.
 * Tiap produk → 1 varian (nama = ukuran, mis. "100 gr"), foto tetap path media Pages CMS (/uploads/...).
 * Stok TIDAK diisi: owner/admin cabang mengisi stok per cabang di Admin → Toko → Produk.
 *
 *   node scripts/seed-shop.mjs [--out seed/shop.sql] [--weight 200] [--apply local|staging]
 *
 * Aman dijalankan ulang: produk dengan slug yang sudah ada tidak ditimpa (INSERT OR IGNORE / WHERE NOT EXISTS).
 * --apply staging menjalankan perintah --remote → hanya dijalankan owner.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_/+&]+/g, '-').replace(/-+/g, '-');
const clean = (v) => (v === undefined || v === null || v === '' || (typeof v === 'string' && /\bTODO\b/i.test(v)) ? null : v);

const products = JSON.parse(await readFile(path.join(process.cwd(), 'src', 'content', 'products.json'), 'utf8'));
const weight = Number(option('--weight', '200'));
const lines = ['-- Seed Cutless Shop dari src/content/products.json (dibuat scripts/seed-shop.mjs)'];
const used = new Set();

for (const p of products) {
  let slug = slugify(p.name);
  for (let i = 2; used.has(slug); i++) slug = `${slugify(p.name)}-${i}`;
  used.add(slug);
  const sku = slug.toUpperCase().slice(0, 50);
  const compare = clean(p.compareAtPrice) && p.compareAtPrice > p.price ? p.compareAtPrice : null;
  lines.push(
    `INSERT OR IGNORE INTO products (slug, name, category, description, badge, is_active, sort_order) VALUES (${q(slug)}, ${q(p.name)}, ${q(p.category)}, ${q(clean(p.description))}, ${q(clean(p.badge))}, ${p.isActive === false ? 0 : 1}, ${Number(p.order ?? 0)});`,
    `INSERT OR IGNORE INTO product_variants (product_id, sku, name, options, price, compare_at_price, weight_gram, is_active, sort_order)
  SELECT id, ${q(sku)}, ${q(clean(p.size) ?? 'Standar')}, '{}', ${Number(p.price)}, ${q(compare)}, ${weight}, 1, 0 FROM products WHERE slug = ${q(slug)};`,
  );
  if (clean(p.image)) {
    lines.push(
      `INSERT INTO product_images (product_id, path, alt, sort_order)
  SELECT id, ${q(p.image)}, ${q(p.name)}, 0 FROM products WHERE slug = ${q(slug)} AND NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = products.id);`,
    );
  }
}

const out = option('--out', 'seed/shop.sql');
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, `${lines.join('\n')}\n`);
console.log(`✓ ${products.length} produk → ${out}`);

const apply = option('--apply');
if (apply) {
  if (!['local', 'staging'].includes(apply)) {
    console.error('--apply hanya menerima "local" atau "staging".');
    process.exit(1);
  }
  const wranglerArgs = ['wrangler', 'd1', 'execute', 'DB', '--env', 'staging', apply === 'local' ? '--local' : '--remote', '--file', out, '--yes'];
  console.log(`→ npx ${wranglerArgs.join(' ')}`);
  const r = spawnSync('npx', wranglerArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
  process.exit(r.status ?? 1);
}

/**
 * Halaman /produk/ mengikuti Pengaturan Situs → Tampilkan Produk saat build (sama seperti Cuci Sepatu):
 * mati → 301 ke beranda & tidak di sitemap; aktif → tampil & masuk sitemap. Juga: workers.dev produksi mati.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRODUCTS_PATH, productsRedirects, productsVisible } from '../src/content/productsSeo';
import { sitemap } from '../scripts/vite-content-plugin';
import type { ContentBundle } from '../src/content/schema';

const bundle = (showProducts: boolean) =>
  ({
    settings: { siteUrl: 'https://cutlesshairstudio.com', showProducts },
    branches: [{ slug: 'bogor-bantarjati' }],
    shoeCare: { enabled: false, branchSlug: 'bogor-bantarjati', services: [] },
  }) as unknown as ContentBundle;

describe('halaman /produk/ ikut Tampilkan Produk', () => {
  it('mati: /produk & /produk/* dialihkan 301 ke beranda, tidak di sitemap', () => {
    expect(productsVisible({ showProducts: false })).toBe(false);
    expect(productsVisible({ showProducts: null })).toBe(false);
    expect(productsRedirects(false).map((r) => r.split(/\s+/))).toEqual([
      ['/produk', '/', '301'],
      ['/produk/*', '/', '301'],
    ]);
    expect(sitemap(bundle(false))).not.toContain('/produk');
  });

  it('aktif: tanpa redirect, masuk sitemap', () => {
    expect(productsVisible({ showProducts: true })).toBe(true);
    expect(productsRedirects(true)).toEqual([]);
    expect(sitemap(bundle(true))).toContain(`<loc>https://cutlesshairstudio.com${PRODUCTS_PATH}</loc>`);
  });
});

describe('wrangler.jsonc: produksi hanya di custom domain', () => {
  // JSONC → JSON: buang komentar baris (di luar string)
  const config = JSON.parse(
    readFileSync('wrangler.jsonc', 'utf8')
      .split('\n')
      .map((l) => l.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/ [^"]*$/, ''))
      .join('\n'),
  );

  it('Worker produksi: workers.dev & Preview URLs mati; staging tetap memakai workers.dev', () => {
    expect(config).toMatchObject({ name: 'cutlesshairstudio', workers_dev: false, preview_urls: false });
    expect(config.env.staging).toMatchObject({ name: 'cutlesshairstudio-staging', workers_dev: true, preview_urls: false });
  });
});

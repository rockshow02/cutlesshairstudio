/**
 * wrangler.jsonc: binding & variabel hitungan klik WhatsApp. Produksi: Cloudflare Access terisi (team domain & AUD
 * berbentuk benar). Staging: Access sengaja kosong → /statistik/ di staging selalu 403. Database terpisah.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Vars = { ALLOWED_ORIGINS: string; ACCESS_TEAM_DOMAIN: string; ACCESS_AUD: string };
type Db = { binding: string; database_name: string; database_id: string };
type Config = { vars: Vars; d1_databases: Db[]; env: { staging: { vars: Vars; d1_databases: Db[] } } };

// Komentar di file ini selalu satu baris penuh (URL di dalam nilai juga memuat "//")
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, '')) as Config;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('wrangler.jsonc', () => {
  it('produksi: Cloudflare Access untuk /statistik/ terisi', () => {
    expect(config.vars.ACCESS_TEAM_DOMAIN).toMatch(/^[a-z0-9-]+\.cloudflareaccess\.com$/);
    expect(config.vars.ACCESS_AUD).toMatch(/^[0-9a-f]{64}$/);
    expect(config.vars.ALLOWED_ORIGINS.split(',')).toEqual(['https://cutlesshairstudio.com', 'https://www.cutlesshairstudio.com']);
  });

  it('staging: Access sengaja kosong (/statistik/ selalu 403)', () => {
    expect(config.env.staging.vars.ACCESS_TEAM_DOMAIN).toBe('');
    expect(config.env.staging.vars.ACCESS_AUD).toBe('');
  });

  it('database D1 produksi & staging terpisah, ID terisi', () => {
    const [prod] = config.d1_databases;
    const [staging] = config.env.staging.d1_databases;
    expect(prod).toMatchObject({ binding: 'DB', database_name: 'cutless-analytics' });
    expect(staging).toMatchObject({ binding: 'DB', database_name: 'cutless-analytics-staging' });
    expect(prod.database_id).toMatch(UUID);
    expect(staging.database_id).toMatch(UUID);
    expect(prod.database_id).not.toBe(staging.database_id);
  });
});

describe('wrangler.jsonc: balasan ulasan Google', () => {
  type Review = Config & { triggers: { crons: string[] }; assets: { run_worker_first: string[] }; vars: Vars & Record<string, string>; env: { staging: Config['env']['staging'] & { triggers: { crons: string[] }; assets: { run_worker_first: string[] }; vars: Vars & Record<string, string> } } };
  const c = config as unknown as Review;
  const reviewsDb = (list: Db[]) => list.find((d) => d.binding === 'REVIEWS_DB') as (Db & { migrations_dir: string }) | undefined;

  it('database D1 ulasan terpisah (produksi & staging) dengan migrasi di migrations-ulasan', () => {
    const prod = reviewsDb(c.d1_databases);
    const staging = reviewsDb(c.env.staging.d1_databases);
    expect(prod).toMatchObject({ database_name: 'cutless-ulasan', migrations_dir: 'migrations-ulasan' });
    expect(staging).toMatchObject({ database_name: 'cutless-ulasan-staging', migrations_dir: 'migrations-ulasan' });
    expect(prod!.database_id).not.toBe(staging!.database_id);
    // Tidak ikut database hitungan klik
    expect(c.d1_databases[0].database_name).toBe('cutless-analytics');
  });

  it('database_id ulasan: placeholder jelas ATAU UUID (pemilik mengisi sebelum merge)', () => {
    for (const db of [reviewsDb(c.d1_databases)!, reviewsDb(c.env.staging.d1_databases)!]) {
      expect(db.database_id, db.database_name).toMatch(new RegExp(`^(${UUID.source.slice(1, -1)}|ISI-DATABASE-ID-${db.database_name})$`));
    }
  });

  it('Cron Trigger tepat sekali per jam (tidak lebih sering), produksi & staging', () => {
    expect(c.triggers.crons).toEqual(['0 * * * *']);
    expect(c.env.staging.triggers.crons).toEqual(['0 * * * *']);
  });

  it('/ulasan* dijalankan Worker (bukan file statis)', () => {
    expect(c.assets.run_worker_first).toContain('/ulasan*');
    expect(c.env.staging.assets.run_worker_first).toContain('/ulasan*');
  });

  it('staging memakai data contoh (mock); produksi memakai klien sungguhan', () => {
    expect(c.env.staging.vars.GBP_CLIENT).toBe('mock');
    expect(c.vars.GBP_CLIENT).toBe('');
    expect(c.vars.GBP_LOCATIONS).toBe('');
  });

  it('tidak ada secret OAuth di file', () => {
    const text = readFileSync('wrangler.jsonc', 'utf8');
    expect(text).not.toMatch(/GBP_CLIENT_SECRET|GBP_REFRESH_TOKEN|GBP_CLIENT_ID/);
  });
});

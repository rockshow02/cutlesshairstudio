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

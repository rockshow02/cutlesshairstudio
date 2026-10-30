/**
 * Cloudflare Web Analytics: beacon hanya di build produksi dengan token valid (bukan dev server, staging, E2E),
 * ditambahkan (defer) setelah event load lewat skrip kecil sebelum </body>, termasuk halaman 404. Token kosong = tidak dipasang.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyticsTokenFor, applyEnv, withAnalytics } from '../scripts/vite-content-plugin';

const TOKEN = '0123456789abcdef0123456789abcdef';
const PAGE = '<!doctype html>\n<html lang="id">\n  <head>\n    <meta charset="UTF-8" />\n    <title>Uji</title>\n  </head>\n  <body>\n    <main></main>\n  </body>\n</html>\n';
const BEACON = `<script>addEventListener('load',function(){var s=document.createElement('script');s.defer=true;s.src='https://static.cloudflareinsights.com/beacon.min.js';s.setAttribute('data-cf-beacon',"{\\"token\\":\\"${TOKEN}\\"}");document.body.appendChild(s)})</script>`;

/** Nilai variabel di file .env (baris KEY=nilai) */
const envOf = (file: string) => Object.fromEntries(
  readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

describe('analyticsTokenFor', () => {
  it('hanya build produksi dengan token 32 heksadesimal', () => {
    expect(analyticsTokenFor('production', true, TOKEN)).toBe(TOKEN);
    expect(analyticsTokenFor('production', true, `  ${TOKEN}\n`)).toBe(TOKEN);
  });

  it('staging, development, & dev server produksi: tidak dipasang walau token diisi', () => {
    expect(analyticsTokenFor('staging', true, TOKEN)).toBe('');
    expect(analyticsTokenFor('development', true, TOKEN)).toBe('');
    expect(analyticsTokenFor('production', false, TOKEN)).toBe('');
  });

  it('token kosong / tidak valid: tidak dipasang', () => {
    expect(analyticsTokenFor('production', true, undefined)).toBe('');
    expect(analyticsTokenFor('production', true, '')).toBe('');
    expect(analyticsTokenFor('production', true, 'bukan-token')).toBe('');
    expect(analyticsTokenFor('production', true, `${TOKEN}'><script>alert(1)</script>`)).toBe('');
  });
});

describe('withAnalytics / applyEnv', () => {
  it('produksi: satu beacon (defer, dimuat setelah load) tepat sebelum </body>', () => {
    const html = applyEnv(PAGE, 'production', TOKEN);
    expect(html).toContain(`    ${BEACON}\n  </body>`);
    expect(html.match(/cloudflareinsights/g)).toHaveLength(1);
    // Idempoten (prerender memanggil applyEnv pada template yang sudah diproses)
    expect(applyEnv(html, 'production', TOKEN)).toBe(html);
  });

  it('skrip pemuat: baru setelah load menambahkan <script defer> beacon dengan token', () => {
    const js = applyEnv(PAGE, 'production', TOKEN).match(/<script>(.*?)<\/script>/)![1];
    const el: { defer?: boolean; src?: string; attrs: Record<string, string>; setAttribute(k: string, v: string): void } = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
    const appended: unknown[] = [];
    let onLoad: (() => void) | undefined;
    new Function('addEventListener', 'document', js)(
      (event: string, fn: () => void) => { expect(event).toBe('load'); onLoad = fn; },
      { createElement: (tag: string) => (expect(tag).toBe('script'), el), body: { appendChild: (n: unknown) => appended.push(n) } },
    );
    expect(appended).toEqual([]);
    onLoad!();
    expect(appended).toEqual([el]);
    expect(el.defer).toBe(true);
    expect(el.src).toBe('https://static.cloudflareinsights.com/beacon.min.js');
    expect(JSON.parse(el.attrs['data-cf-beacon'])).toEqual({ token: TOKEN });
  });

  it('produksi tanpa token: HTML tidak berubah', () => {
    expect(applyEnv(PAGE, 'production', '')).toBe(PAGE);
  });

  it('staging: tanpa beacon walau token diberikan (tetap noindex)', () => {
    const html = applyEnv(PAGE, 'staging', TOKEN);
    expect(html).not.toContain('cloudflareinsights');
    expect(html).toContain('noindex');
  });

  it('halaman 404 (public/404.html) mendapat beacon', () => {
    const html = withAnalytics(readFileSync('public/404.html', 'utf8'), TOKEN);
    expect(html).toContain(BEACON);
    expect(html.indexOf(BEACON)).toBeLessThan(html.indexOf('</body>'));
  });
});

describe('file .env', () => {
  it('produksi: VITE_APP_ENV=production & token valid', () => {
    const env = envOf('.env.production');
    expect(env.VITE_APP_ENV).toBe('production');
    expect(analyticsTokenFor('production', true, env.VITE_CF_ANALYTICS_TOKEN)).not.toBe('');
  });

  it.each(['.env.staging', '.env.e2e', '.env.e2e-uniform', '.env.development'])('%s: bukan produksi & token kosong', (file) => {
    const env = envOf(file);
    expect(env.VITE_APP_ENV).not.toBe('production');
    expect(env.VITE_CF_ANALYTICS_TOKEN ?? '').toBe('');
  });
});

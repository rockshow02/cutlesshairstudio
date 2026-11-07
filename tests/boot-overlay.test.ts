/**
 * Overlay statis penutup ringkasan prerender (scripts/bootOverlay.ts): ada di HTML hanya bila "Tampilkan animasi pembuka"
 * (enablePreloader) aktif, tampil tanpa JavaScript sejak paint pertama, memudar sendiri lewat CSS (pengaman bila JS gagal),
 * dan tidak menyentuh teks prerender. Data uji (rawFixture + template HTML di repo), bukan isi CMS.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { settingsSchema } from '../src/content/schema';
import { BOOT_FALLBACK_SECONDS, BOOT_OVERLAY_ID } from '../src/lib/bootOverlay';
import { bootOverlayEnabled, withBootOverlay } from '../scripts/bootOverlay';
import { rawFixture } from './helpers/contentFixture';

const MARK = { src: '/images/brand/cutless-mark-white.png', width: 206, height: 240 };
const PAGE =
  '<!doctype html>\n<html lang="id">\n  <head>\n    <meta charset="UTF-8" />\n    <title>Uji</title>\n  </head>\n  <body>\n' +
  '    <div id="root"><div class="prerender"><h1>Cut Less.<br />Style More.</h1><p>Teks prerender uji</p></div></div>\n' +
  '    <noscript>Aktifkan JavaScript</noscript>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>';
const on = (html = PAGE) => withBootOverlay(html, { enabled: true, mark: MARK });

describe('bootOverlayEnabled (Pengaturan Situs → Tampilkan animasi pembuka)', () => {
  it('aktif secara bawaan dan bila true; mati hanya bila false', () => {
    const { enablePreloader: _omit, ...tanpa } = rawFixture.settings as Record<string, unknown>;
    expect(bootOverlayEnabled(settingsSchema.parse(tanpa))).toBe(true);
    expect(bootOverlayEnabled(settingsSchema.parse({ ...rawFixture.settings, enablePreloader: true }))).toBe(true);
    expect(bootOverlayEnabled(settingsSchema.parse({ ...rawFixture.settings, enablePreloader: false }))).toBe(false);
  });
});

describe('withBootOverlay: enablePreloader mati', () => {
  it('HTML tidak berubah sama sekali (perilaku lama, tanpa overlay)', () => {
    const out = withBootOverlay(PAGE, { enabled: false, mark: MARK });
    expect(out).toBe(PAGE);
    expect(out).not.toContain(BOOT_OVERLAY_ID);
  });
});

describe('withBootOverlay: enablePreloader aktif', () => {
  it('overlay = elemen pertama <body>, sebelum #root, aria-hidden, tanpa <script>', () => {
    const out = on();
    const body = out.slice(out.indexOf('<body>') + '<body>'.length);
    expect(body.trimStart().startsWith(`<div id="${BOOT_OVERLAY_ID}" aria-hidden="true"`)).toBe(true);
    expect(out.indexOf(`id="${BOOT_OVERLAY_ID}"`)).toBeLessThan(out.indexOf('<div id="root">'));
    const overlay = out.slice(out.indexOf(`<div id="${BOOT_OVERLAY_ID}"`), out.indexOf('<div id="root">'));
    expect(overlay).not.toMatch(/<script/i);
    expect(overlay).not.toMatch(/\son\w+=/i);
  });

  it('CSS kritis inline di <head> (bukan file luar): position fixed, latar sama dengan preloader, pudar sendiri ±3 detik', () => {
    const out = on();
    const head = out.slice(0, out.indexOf('</head>'));
    const css = head.slice(head.indexOf('<style id="boot-overlay-css">'));
    expect(css).toContain('<style id="boot-overlay-css">');
    expect(css).toMatch(/position:\s*fixed/);
    expect(css).toContain('background:#0c1014');
    expect(css).toMatch(new RegExp(`animation:[^;}]*${BOOT_FALLBACK_SECONDS}s[^;}]*forwards`));
    expect(BOOT_FALLBACK_SECONDS).toBeGreaterThanOrEqual(2.5);
    expect(BOOT_FALLBACK_SECONDS).toBeLessThanOrEqual(3.5);
    expect(css.length).toBeLessThan(2200);
  });

  it('prefers-reduced-motion: tanpa gerakan (pengaman tetap lewat langkah visibility, bukan fade)', () => {
    const css = on().slice(on().indexOf('<style id="boot-overlay-css">'), on().indexOf('</head>'));
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion'));
    expect(reduced).toContain('prefers-reduced-motion:reduce');
    expect(reduced).toMatch(/animation:[^;}]*\b0s\b[^;}]*3s[^;}]*forwards/);
    expect(reduced).not.toMatch(/opacity/);
  });

  it('logo (mark) sama dengan Preloader React: gambar dipreload dan berukuran tetap (tanpa layout shift)', () => {
    const out = on();
    expect(out).toContain(`<link rel="preload" as="image" href="${MARK.src}" />`);
    expect(out).toContain(`<img class="bo-mark" src="${MARK.src}" width="${MARK.width}" height="${MARK.height}" alt="" />`);
  });

  it('teks prerender, <noscript>, dan jumlah <main> tidak berubah; idempoten', () => {
    const out = on();
    expect(out).toContain('<div id="root"><div class="prerender"><h1>Cut Less.<br />Style More.</h1><p>Teks prerender uji</p></div></div>');
    expect(out).toContain('<noscript>Aktifkan JavaScript</noscript>');
    expect((out.match(/<main/g) ?? []).length).toBe((PAGE.match(/<main/g) ?? []).length);
    expect(on(out)).toBe(out);
    expect((out.match(new RegExp(`id="${BOOT_OVERLAY_ID}"`, 'g')) ?? []).length).toBe(1);
  });
});

describe('semua halaman prerender memakai template dengan #root (beranda, cabang, tips, layanan, kabar, produk, cuci sepatu, privasi)', () => {
  const templates = ['index.html', 'cabang/index.html', 'tips/index.html', 'layanan/index.html', 'kabar/index.html', 'produk/index.html', 'cuci-sepatu/index.html', 'kebijakan-privasi/index.html'];
  for (const file of templates) {
    it(file, () => {
      const html = readFileSync(file, 'utf8');
      const out = on(html);
      expect((out.match(new RegExp(`id="${BOOT_OVERLAY_ID}"`, 'g')) ?? []).length).toBe(1);
      expect(out.indexOf(BOOT_OVERLAY_ID)).toBeLessThan(out.indexOf('id="root"'));
      // Isi <head> sebelumnya & semua dari #root ke bawah (termasuk placeholder prerender) tidak berubah
      expect(out).toContain(html.slice(0, html.indexOf('</head>')));
      expect(out).toContain(html.slice(html.indexOf('<div id="root"')));
      expect(withBootOverlay(html, { enabled: false, mark: MARK })).toBe(html);
    });
  }
});

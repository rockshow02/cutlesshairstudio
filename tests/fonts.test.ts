/**
 * Font di-host sendiri (tanpa layout shift karena ganti font): @font-face di CSS utama, file ada di public/fonts/,
 * file latin di-preload di setiap halaman, tidak ada stylesheet Google Fonts yang dimuat async.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PAGES = ['index.html', 'cabang/index.html', 'cuci-sepatu/index.html', 'produk/index.html'];
const fontsCss = readFileSync('src/styles/fonts.css', 'utf8');

describe('font situs', () => {
  it('@font-face Archivo (125%, 700–800) & Plus Jakarta Sans (400–700), font-display swap, file ada', () => {
    const urls = [...fontsCss.matchAll(/url\('(\/fonts\/[\w.-]+\.woff2)'\)/g)].map((m) => m[1]);
    expect(urls).toHaveLength(4);
    for (const url of urls) expect(existsSync(`public${url}`), url).toBe(true);
    expect(fontsCss).toMatch(/font-family: 'Archivo';[\s\S]*?font-weight: 700 800;\s*font-stretch: 125%;/);
    expect(fontsCss).toMatch(/font-family: 'Plus Jakarta Sans';[\s\S]*?font-weight: 400 700;/);
    expect(fontsCss.match(/font-display: swap;/g)).toHaveLength(4);
    // Dimuat lewat CSS utama (render-blocking), bukan stylesheet terpisah
    expect(readFileSync('src/styles/global.css', 'utf8').split('\n')[0]).toBe("@import './fonts.css';");
  });

  it('setiap halaman mem-preload file latin kedua font & tidak memuat Google Fonts', () => {
    for (const page of PAGES) {
      const html = readFileSync(page, 'utf8');
      expect(html, page).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
      for (const file of ['archivo-v1-latin.woff2', 'plus-jakarta-sans-v1-latin.woff2']) {
        expect(html, `${page} → ${file}`).toContain(`<link rel="preload" as="font" type="font/woff2" href="/fonts/${file}" crossorigin />`);
      }
    }
  });

  it('render pertama setiap entri menunggu font (fontsReady) & /fonts/* di-cache lama', () => {
    for (const entry of ['src/main.tsx', 'src/cabang.tsx', 'src/cuciSepatu.tsx', 'src/produk.tsx']) {
      expect(readFileSync(entry, 'utf8'), entry).toMatch(/void fontsReady\(\)\.then\(\(\) =>\s+createRoot\(/);
    }
    expect(readFileSync('public/_headers', 'utf8')).toMatch(/\/fonts\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
  });
});

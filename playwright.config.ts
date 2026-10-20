import { defineConfig } from '@playwright/test';

/**
 * E2E situs statis (booking & pesan lewat WhatsApp) terhadap Worker statis lokal (wrangler dev, dist/ build E2E).
 *   npm run e2e                                   → build E2E (data uji tetap, e2e/fixtures/content.ts) + wrangler dev
 *                                                   otomatis. Server yang sudah jalan di :8787 dipakai ulang: pastikan
 *                                                   isinya hasil `npm run build:e2e`, bukan build:staging.
 *   CI (.github/workflows/ci.yml, job e2e)        → sama, di setiap PR ke staging & main
 *   E2E_BASE_URL=https://…staging… npm run e2e   → uji ke staging
 *     (+ E2E_CF_ACCESS_CLIENT_ID/SECRET bila Worker staging dikunci Cloudflare Access)
 * Proyek "hp" = 360 px (layar sentuh), "desktop" = 1280 px.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8787';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  // Halaman tidak menunggu event load (font Google eksternal bisa lambat): navigasi memakai waitUntil: 'domcontentloaded'
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // CI: ulangi tes yang gagal (maks. 2x) agar gangguan sesaat wrangler dev tidak memblokir PR; tetap dilaporkan "flaky"
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    // Lokal: Google Chrome terpasang. CI: Chromium bawaan Playwright (npx playwright install chromium)
    channel: process.env.CI ? undefined : (process.env.PW_CHANNEL ?? 'chrome'),
    trace: 'retain-on-failure',
    // Situs memakai scroll-behavior: smooth; mode "kurangi gerakan" mematikannya (dan preloader) agar klik
    // Playwright tidak mendarat saat halaman masih bergulir. Animasi diuji terpisah.
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    { name: 'hp', use: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run e2e:server', url: 'http://localhost:8787/', reuseExistingServer: !process.env.CI, timeout: 300_000 },
});

import { defineConfig } from '@playwright/test';

/**
 * E2E booking di lebar 360px terhadap Worker lokal (wrangler dev + D1 lokal + login mock).
 *   npm run db:migrate:local && npm run db:seed:local   (sekali)
 *   npm run e2e
 * E2E_BASE_URL=https://…staging… E2E_MOCK_SECRET=… E2E_CF_ACCESS_CLIENT_ID=… E2E_CF_ACCESS_CLIENT_SECRET=… npm run e2e
 *   → uji ke staging (dikunci Cloudflare Access; lihat docs/booking-setup.md §7)
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8787';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 180_000,
  // Halaman tidak menunggu event load (font Google eksternal bisa lambat)
  // navigasi di tes memakai waitUntil: 'domcontentloaded'
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    viewport: { width: 360, height: 740 },
    isMobile: true,
    hasTouch: true,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    channel: process.env.PW_CHANNEL ?? 'chrome',
    trace: 'retain-on-failure',
    // Situs memakai scroll-behavior: smooth; mode "kurangi gerakan" mematikannya (dan preloader) agar klik
    // Playwright tidak mendarat saat halaman masih bergulir. Animasi diuji terpisah.
    contextOptions: { reducedMotion: 'reduce' },
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev:worker', url: 'http://localhost:8787/api/health', reuseExistingServer: true, timeout: 240_000 },
});

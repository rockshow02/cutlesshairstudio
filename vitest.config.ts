import { defineConfig } from 'vitest/config';

// Tes mesin slot (murni) & tes integrasi D1 lokal (miniflare lewat wrangler getPlatformProxy).
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Tiap file tes memakai database sementara sendiri
    fileParallelism: false,
  },
});

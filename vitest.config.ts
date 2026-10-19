import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Tes unit: skema konten (Zod), srcset otomatis, pesan WhatsApp.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});

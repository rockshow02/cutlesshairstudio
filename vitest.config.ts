import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Tes unit: skema konten (Zod) & kesesuaian .pages.yml, footer dinamis, srcset otomatis, pesan WhatsApp.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'virtual:image-meta': fileURLToPath(new URL('./tests/stubs/image-meta.ts', import.meta.url)),
      'virtual:tips': fileURLToPath(new URL('./tests/stubs/tips.ts', import.meta.url)),
      'virtual:layanan': fileURLToPath(new URL('./tests/stubs/layanan.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});

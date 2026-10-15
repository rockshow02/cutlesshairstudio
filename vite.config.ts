import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { contentPlugin } from './scripts/vite-content-plugin';

export default defineConfig({
  // contentPlugin: validasi konten Pages CMS (Zod) saat build + ukuran gambar untuk frontend
  plugins: [react(), contentPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});

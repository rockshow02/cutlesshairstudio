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
  build: {
    // Satu file CSS untuk semua halaman (lebih sedikit request yang memblokir render)
    cssCodeSplit: false,
    // Multi-halaman statis: / (beranda), /produk/, /cabang/ (+ /cabang/<slug>/ hasil prerender)
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        produk: fileURLToPath(new URL('./produk/index.html', import.meta.url)),
        // Template halaman cabang: diprerender per cabang ke /cabang/<slug>/ oleh contentPlugin
        cabang: fileURLToPath(new URL('./cabang/index.html', import.meta.url)),
      },
    },
  },
});

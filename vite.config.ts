import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { contentPlugin } from './scripts/vite-content-plugin';

export default defineConfig({
  // contentPlugin: validasi konten Pages CMS (Zod) saat build + ukuran gambar untuk frontend
  plugins: [react(), contentPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Satu file CSS untuk semua halaman (lebih sedikit request yang memblokir render)
    cssCodeSplit: false,
    // Multi-halaman statis: / (beranda), /produk/, /cabang/ (+ /cabang/<slug>/ hasil prerender)
    rollupOptions: {
      output: {
        // Library dipisah dari kode situs: chunk sendiri, bisa di-cache lama & tidak menumpuk di chunk section
        // (Lenis & Swiper tetap dimuat dinamis hanya saat dibutuhkan, tidak dimasukkan ke sini)
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (/node_modules\/(motion|framer-motion|motion-dom|motion-utils)\//.test(id)) return 'vendor-motion';
          return undefined;
        },
      },
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        produk: fileURLToPath(new URL('./produk/index.html', import.meta.url)),
        // Template halaman cabang: diprerender per cabang ke /cabang/<slug>/ oleh contentPlugin
        cabang: fileURLToPath(new URL('./cabang/index.html', import.meta.url)),
      },
    },
  },
});

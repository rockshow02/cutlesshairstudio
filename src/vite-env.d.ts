/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Opsional: simulasi latensi konten (ms) untuk menguji state loading */
  readonly VITE_CONTENT_DELAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Disediakan scripts/vite-content-plugin.ts: ukuran asli gambar di public/uploads */
declare module 'virtual:image-meta' {
  const meta: Record<string, { width: number; height: number }>;
  export default meta;
}

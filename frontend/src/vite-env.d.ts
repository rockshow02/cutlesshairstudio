/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL dasar Strapi, mis. http://localhost:1337. Kosong = pakai data statis. */
  readonly VITE_CMS_URL?: string;
  /** Simulasi latensi konten (ms) untuk menguji state loading */
  readonly VITE_CONTENT_DELAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

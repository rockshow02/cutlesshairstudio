/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** development | staging | production (.env.<mode>) */
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production';
  /** Domain per environment; kosong = settings.json → siteUrl */
  readonly VITE_SITE_URL?: string;
  /** Token Cloudflare Web Analytics (hanya produksi) */
  readonly VITE_CF_ANALYTICS_TOKEN?: string;
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

/** Disediakan scripts/vite-content-plugin.ts: masalah "siap tayang" (kosong di produksi) */
declare module 'virtual:content-status' {
  const status: { issues: string[] };
  export default status;
}

/** Disediakan scripts/vite-content-plugin.ts: ringkasan artikel Tips & Trik terbit (kosong bila halaman dimatikan) */
declare module 'virtual:tips' {
  const tips: import('./content/tipsSeo').TipSummary[];
  export default tips;
}

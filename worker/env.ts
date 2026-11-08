/** Binding & variabel Worker (wrangler.jsonc). Tipe D1 minimal (yang dipakai saja), tanpa paket @cloudflare/workers-types. */

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
}

export interface D1PreparedStatement {
  bind(...values: (string | number | null)[]): D1PreparedStatement;
  run(): Promise<{ meta: { changes: number } }>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** D1 cutless-analytics (produksi) / cutless-analytics-staging. Tidak ada = hitungan klik & statistik nonaktif. */
  DB?: D1Database;
  /** Origin situs yang boleh mengirim klik, dipisah koma, mis. "https://cutlesshairstudio.com,https://www.cutlesshairstudio.com" */
  ALLOWED_ORIGINS?: string;
  /** Cloudflare Access: team domain (mis. "cutless.cloudflareaccess.com") & Application Audience (AUD) tag /statistik/ */
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  /** D1 cutless-ulasan (produksi) / cutless-ulasan-staging: antrean balasan ulasan Google. Tidak ada = /ulasan/ 503 & cron tidak berbuat apa-apa. */
  REVIEWS_DB?: D1Database;
  /** Klien Google Business Profile: "mock" = data contoh (staging & tes); kosong = klien sungguhan bila secret OAuth terisi */
  GBP_CLIENT?: string;
  /** JSON slug cabang → nama lokasi Google, mis. {"cibubur":"locations/123"}; kosong = tidak ada ulasan yang diambil */
  GBP_LOCATIONS?: string;
  /** Secret OAuth Google (wrangler secret put): sampai terisi, klien sungguhan tidak aktif */
  GBP_CLIENT_ID?: string;
  GBP_CLIENT_SECRET?: string;
  GBP_REFRESH_TOKEN?: string;
  /** Hanya Worker uji e2e (npm run e2e:server): "1" = header x-e2e-now mengatur jam sekarang (worker/clock.ts). Tidak ada di produksi/staging. */
  E2E_CLOCK?: string;
}

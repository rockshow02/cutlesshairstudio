/** Binding & variabel Worker (wrangler.jsonc). Tipe D1 minimal (yang dipakai saja), tanpa paket @cloudflare/workers-types. */

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
}

export interface D1PreparedStatement {
  bind(...values: (string | number | null)[]): D1PreparedStatement;
  run(): Promise<unknown>;
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
}

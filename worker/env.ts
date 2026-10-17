/** Binding & variabel Worker (wrangler.jsonc + secrets). */
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** production | staging | development */
  APP_ENV: string;
  AUTH_PHONE_PASSWORD_ENABLED: string;
  AUTH_MOCK_ENABLED: string;
  PBKDF2_ITERATIONS: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  TURNSTILE_SITE_KEY: string;
  /** Cutless Stamp: 'true' = fitur tersedia (program tetap perlu diaktifkan owner). Kosong/absen = mati. */
  LOYALTY_ENABLED?: string;
  // Secrets (wrangler secret put … --env staging / .dev.vars lokal)
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  AUTH_MOCK_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  /** Hanya development lokal: email admin tanpa Cloudflare Access */
  ADMIN_DEV_EMAIL?: string;
}

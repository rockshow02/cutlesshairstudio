# Setup booking online: STAGING

Panduan teknis menyiapkan booking online (Worker + D1 + login Google + Turnstile + Cloudflare Access) **hanya untuk staging**.
Produksi (`main`) tidak disentuh sampai klien menyetujui; lihat bagian terakhir.

Semua layanan di bawah gratis: Cloudflare Workers/D1/Turnstile/Access (paket Free), Google OAuth, Telegram Bot.

| Yang dibutuhkan | Dipakai untuk |
|---|---|
| Akun Cloudflare (yang sudah memegang Worker `cutlesshairstudio`) | Worker staging, D1, Turnstile, Access |
| Akun Google **milik bisnis klien** | OAuth client & consent screen "Login dengan Google" |
| Node.js 22 + repo ini, `npx wrangler login` | Membuat database & menjalankan migrasi dari laptop |

---

## 1. Database D1 staging

```bash
npx wrangler login                                   # sekali, buka browser
npx wrangler d1 create cutless-staging               # catat "database_id"
```

1. Tempel `database_id` ke `wrangler.jsonc` → `env.staging.d1_databases[0].database_id` (ganti `00000000-…-0001`), commit ke `feature/booking` / `staging`.
2. Migrasi skema & seed data (dari branches/barbers/pricing.json + akun uji):
   ```bash
   npm run db:migrate:staging
   node scripts/seed-d1.mjs --out seed/seed.staging.sql --test-data --owner email-owner@bisnis.com --apply staging
   ```
   `--owner` = email yang nanti dipakai login dashboard `/admin` (role Owner).
3. Cek: `npx wrangler d1 execute DB --env staging --remote --command "SELECT name FROM branches"`.

> Script sengaja **tidak** punya opsi produksi (`--apply` hanya `local` / `staging`), dan CI tidak pernah menjalankan migrasi.

## 2. Login Google (OAuth client)

Di **Google Cloud Console** memakai akun Google **bisnis klien** (bukan akun pribadi developer):

1. https://console.cloud.google.com → buat project, mis. `Cutless Booking`.
2. **APIs & Services → OAuth consent screen** (Google Auth Platform → Branding):
   - User type **External**.
   - App name **Cutless Hair Studio**, support email & developer contact = **email bisnis klien**, logo Cutless.
   - App domain: homepage = URL staging/produksi, privacy policy = `https://<domain>/kebijakan-privasi`.
   - Scopes: `openid`, `email`, `profile` (tidak perlu verifikasi Google karena tidak memakai scope sensitif).
   - Audience: selama uji coba boleh **Testing** + tambahkan email penguji; sebelum dipakai umum ubah ke **In production**.
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `http://localhost:8787`, `https://cutlesshairstudio-staging.adi-yansyaaah.workers.dev`
   - Authorized redirect URIs:
     - `http://localhost:8787/api/auth/google/callback`
     - `https://cutlesshairstudio-staging.adi-yansyaaah.workers.dev/api/auth/google/callback`
4. Simpan Client ID & Client Secret sebagai **secret Worker staging**:
   ```bash
   npx wrangler secret put GOOGLE_CLIENT_ID --env staging
   npx wrangler secret put GOOGLE_CLIENT_SECRET --env staging
   ```
   Lokal: isi di `.dev.vars` (tidak di-commit).

## 3. Turnstile (anti-bot)

1. Cloudflare dashboard → **Turnstile → Add widget** → nama `Cutless staging`, hostname `cutlesshairstudio-staging.adi-yansyaaah.workers.dev` (+ `localhost` bila ingin uji lokal), mode **Managed**.
2. Site key → `wrangler.jsonc` → `env.staging.vars.TURNSTILE_SITE_KEY` (publik, boleh di-commit).
3. Secret key: `npx wrangler secret put TURNSTILE_SECRET_KEY --env staging`.

Sebelum langkah ini, staging memakai site key uji Cloudflare `1x00000000000000000000AA` (selalu lolos); server menolak semua submit sampai secret diisi.

## 4. Cloudflare Access untuk `/admin` (gratis s.d. 50 pengguna)

1. Cloudflare dashboard → **Zero Trust** (pilih paket Free, buat nama tim, mis. `cutless` → `cutless.cloudflareaccess.com`).
2. **Access → Applications → Add an application → Self-hosted**:
   - Name `Cutless Admin (staging)`, session 24 jam.
   - Domain: `cutlesshairstudio-staging.adi-yansyaaah.workers.dev`, path `admin` dan tambahkan baris kedua path `api/admin`.
   - Policy **Allow**, include **Emails**: email owner & admin cabang (harus sama dengan `admin_users`).
   - Login methods: **One-time PIN** (kode lewat email) dan/atau Google.
3. Salin **Application Audience (AUD) Tag** dari Overview aplikasi.
4. Isi `wrangler.jsonc` → `env.staging.vars`: `ACCESS_TEAM_DOMAIN = "cutless.cloudflareaccess.com"`, `ACCESS_AUD = "<AUD tag>"`, commit.

Worker selalu memverifikasi JWT `Cf-Access-Jwt-Assertion` (tanda tangan, audiens, penerbit) lalu mencocokkan email dengan tabel `admin_users`. Menambah admin = tambahkan email di Access **dan** di dashboard `/admin → Pengaturan → Akun admin`.

## 5. Secrets lain

```bash
# Login uji untuk tes E2E di staging (string acak panjang); tanpa ini login mock ditolak
npx wrangler secret put AUTH_MOCK_SECRET --env staging
# Opsional: notifikasi Telegram (buat bot lewat @BotFather, tambahkan bot ke grup cabang)
npx wrangler secret put TELEGRAM_BOT_TOKEN --env staging
```

ID grup Telegram diisi per cabang di `/admin → Pengaturan → Cabang` (cara mendapatkan ID: tambahkan bot ke grup, kirim pesan, buka `https://api.telegram.org/bot<TOKEN>/getUpdates`, ambil `chat.id`, biasanya diawali `-100`).

## 6. Worker staging (Workers Builds)

Sama seperti di README §5, dengan catatan untuk booking:

- Worker **`cutlesshairstudio-staging`** → Settings → Build: production branch `staging`, build `npm run build:staging`, deploy `npx wrangler deploy --env staging`.
- `wrangler.jsonc` sekarang punya `main: worker/index.ts` (Worker + API). Secrets di atas harus diisi untuk Worker staging.
- Cron Trigger (`*/15 * * * *` dan `0 19 * * *`) otomatis terpasang saat deploy staging. Paket Free mengizinkan 5 cron per akun.
- Matikan **Builds for non-production branches** di Worker **produksi** agar push ke `staging`/`feature/*` tidak memicu build produksi.

## 7. Uji staging

```bash
E2E_BASE_URL=https://cutlesshairstudio-staging.adi-yansyaaah.workers.dev E2E_MOCK_SECRET=<AUTH_MOCK_SECRET> npm run e2e
```
(tes admin hanya lokal karena `/admin` staging dilindungi Access). Uji manual: login Google sungguhan, booking, batal, jadwal ulang, `/admin` dengan email owner.

## 8. Setelah data diubah di /admin

Cabang/hairstylist/harga kini di D1. Halaman `/cabang/<slug>/` (SEO), sitemap, dan pilihan cabang di Pages CMS (Promo/Pengumuman) dibuat saat build dari salinan JSON. Perbarui salinan bila menambah/mengubah cabang:

```bash
npm run export-catalog          # ambil dari staging → src/content/*.json + dropdown .pages.yml
git commit -am "chore: perbarui salinan katalog" && git push
```

## Lokal (developer)

```bash
cp .dev.vars.example .dev.vars      # APP_ENV=development, login mock, admin owner@localhost
npm run db:migrate:local && npm run db:seed:local
npm run dev:worker                  # build staging + wrangler dev → http://localhost:8787
npm test && npm run e2e             # 55 tes unit/integrasi + 7 E2E 360px
```
Atau `npm run dev:api` (wrangler) + `npm run dev` (Vite, proxy /api) untuk hot reload frontend.

## Produksi (NANTI, setelah persetujuan klien)

Belum dilakukan dan tidak boleh dari branch ini. Ringkasnya nanti: `wrangler d1 create cutless-prod` → isi `database_id` blok produksi → `wrangler d1 migrations apply DB --remote` (tanpa `--env`) → seed tanpa `--test-data` → secrets produksi (tanpa `AUTH_MOCK_SECRET`; `AUTH_MOCK_ENABLED` produksi tetap `false`) → OAuth redirect & Turnstile & Access untuk domain produksi → `VITE_BOOKING_ENABLED=true` di `.env.production` → PR `staging → main`.

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

**Status:** staging sudah memakai widget Turnstile **asli** (site key di `wrangler.jsonc`, secret sudah diisi owner). Token palsu/dummy kini ditolak server, termasuk dari tes otomatis. Tes E2E staging memakai jalur khusus, lihat §7. Tanpa `TURNSTILE_SECRET_KEY`, server menolak semua submit (kecuali development lokal).

Ganti/rotasi kunci: buat ulang secret di widget Turnstile, lalu jalankan lagi langkah 3. Site key hanya berubah bila widget dibuat ulang.

## 4. Cloudflare Access (gratis s.d. 50 pengguna)

### Batasan workers.dev (staging)

Staging berjalan di subdomain `*.workers.dev`. Di hostname ini Cloudflare Access **hanya bisa mengunci seluruh Worker**: halaman, aset, dan semua API. Ini juga berlaku bila Access diaktifkan dari tab **Settings → Domains & Routes → workers.dev → Cloudflare Access** di Worker. Aturan per path (`/admin`, `/api/admin`) tidak didukung untuk `workers.dev`.

Akibatnya di staging:
- Landing page, `/booking`, `/masuk`, dan login Google ikut berada di balik Access. Hanya email yang diizinkan policy yang bisa membuka staging. Untuk lingkungan uji, ini justru wajar.
- Tes otomatis (E2E) perlu **Service Token** untuk melewati Access (lihat §7).
- Worker tetap memverifikasi JWT `Cf-Access-Jwt-Assertion` di `/admin` & `/api/admin` (tanda tangan, audiens, penerbit). Setelah itu email dicocokkan dengan tabel `admin_users`. JWT dari Service Token tidak berisi email, jadi `/admin` tetap menolaknya.
- `ACCESS_AUD` di `env.staging.vars` harus berisi **AUD tag aplikasi yang mengunci Worker staging**.

### Pengaturan staging

1. Cloudflare dashboard → **Zero Trust** (paket Free). Buat nama tim, mis. `cutless` → `cutless.cloudflareaccess.com`.
2. Aktifkan Access untuk Worker `cutlesshairstudio-staging` (tab workers.dev di Worker, atau **Access → Applications → Self-hosted** dengan domain `cutlesshairstudio-staging.adi-yansyaaah.workers.dev` tanpa path).
   - Policy **Allow**, include **Emails**: email owner, admin cabang (harus sama dengan `admin_users`), dan penguji.
   - Login methods: **One-time PIN** dan/atau Google. Session 24 jam.
3. Salin **Application Audience (AUD) Tag** dari Overview aplikasi.
4. Isi `wrangler.jsonc` → `env.staging.vars`: `ACCESS_TEAM_DOMAIN = "cutless.cloudflareaccess.com"`, `ACCESS_AUD = "<AUD tag>"`, lalu commit.

Menambah admin: tambahkan email di policy Access **dan** di dashboard `/admin → Pengaturan → Akun admin`.

### Produksi: wajib domain sendiri

Produksi **harus** memakai domain sendiri (mis. `cutlesshairstudio.com`, ditambahkan sebagai zona Cloudflare dan dipasang sebagai Custom Domain Worker), bukan `workers.dev`. Hanya di domain sendiri Access bisa mengunci **per path**: aplikasi Self-hosted dengan path `admin` dan `api/admin`. Dengan begitu landing page, booking, dan login pelanggan tetap publik.

Setelah domain aktif, matikan route `workers.dev` Worker produksi (Settings → Domains & Routes) agar `/admin` tidak bisa diakses lewat hostname lain. Worker tetap memverifikasi JWT Access di `/admin` & `/api/admin` sebagai lapisan kedua.

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

### Service Token untuk tes otomatis (sekali)

Staging dikunci Access seluruhnya (§4), jadi Playwright perlu Service Token:

1. **Zero Trust → Access → Service Auth → Service Tokens → Create Service Token**. Beri nama `cutless-e2e-staging`; masa berlaku mis. 1 tahun.
2. Salin **Client ID** dan **Client Secret** ke pengelola sandi. Client Secret hanya ditampilkan sekali. **Jangan** tulis ke repo, `.env` yang di-commit, atau tiket.
3. Buka aplikasi Access Worker staging → **Policies → Add a policy**:
   - Action **Service Auth** (bukan Allow);
   - Include **Service Token** = `cutless-e2e-staging`;
   - simpan dan pastikan policy aktif di aplikasi itu.

   Policy email (Allow) yang sudah ada tetap dipakai manusia.
4. Rotasi: buat token baru → ganti di policy → hapus token lama. Token yang bocor: **Revoke** di halaman Service Tokens.

### Menjalankan

```bash
# Isi nilai dari pengelola sandi Anda; jangan ditulis ke file repo / riwayat shell bersama
E2E_BASE_URL=https://cutlesshairstudio-staging.adi-yansyaaah.workers.dev E2E_MOCK_SECRET=<AUTH_MOCK_SECRET> E2E_CF_ACCESS_CLIENT_ID=<Client ID> E2E_CF_ACCESS_CLIENT_SECRET=<Client Secret> npm run e2e
```

Header `CF-Access-Client-Id` / `CF-Access-Client-Secret` dikirim Playwright **hanya** ke origin staging (`E2E_BASE_URL`), tidak ke Cloudflare Turnstile, Google Fonts, atau situs lain. Tanpa kedua variabel itu, setiap request staging dialihkan ke halaman login Access dan tes gagal.

Karena staging memakai Turnstile asli (tidak bisa diselesaikan browser otomatis), E2E staging bekerja seperti ini:

- Login memakai `/api/auth/mock?secret=…`.
- Browser uji menambahkan header `x-e2e-secret: <AUTH_MOCK_SECRET>` **hanya** ke request `/api/**` di origin staging.
- Server melewati verifikasi Turnstile hanya bila **semua** syarat ini terpenuhi:
  - `APP_ENV = staging`;
  - `AUTH_MOCK_ENABLED = "true"`;
  - secret `AUTH_MOCK_SECRET` terisi;
  - header cocok (dibandingkan dalam waktu konstan).
- Produksi (`APP_ENV = production`) tidak pernah melewati Turnstile, dan login mock di produksi selalu 404.
- Skrip widget Turnstile di browser uji diganti stub, supaya tombol konfirmasi aktif. Widget asli tetap tampil untuk pengunjung biasa.
- Mengganti `AUTH_MOCK_SECRET` (`wrangler secret put … --env staging`) otomatis membatalkan akses dari secret lama. Mematikan jalur uji sepenuhnya: set `AUTH_MOCK_ENABLED` ke `"false"` di `env.staging.vars`.

Tes admin hanya berjalan lokal: Service Token tidak membawa email, jadi `/admin` staging menolaknya. Uji manual tetap perlu: login Google sungguhan, booking (lewat widget Turnstile asli), batal, jadwal ulang, dan `/admin` dengan email owner.

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

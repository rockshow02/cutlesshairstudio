# Checklist migrasi akun ke klien

Memindahkan repo GitHub, Cloudflare Workers, dan Pages CMS dari akun pengembang (`rockshow02` / subdomain `adi-yansyaaah.workers.dev`) ke akun milik klien. Biaya tetap Rp0: semua layanan memakai paket gratis.

Kerjakan berurutan. Centang setiap langkah.

## 0. Persiapan

- [ ] Klien punya akun **GitHub** dan akun **Cloudflare** (email bisnis, 2FA aktif).
- [ ] Tidak ada Save Pages CMS yang sedang berjalan. Umumkan ke staf: jangan mengedit selama migrasi (±1 jam).
- [ ] Catat versi terakhir yang tayang: commit terbaru `main` dan `staging`.

## 1. Repo GitHub

- [ ] **Transfer repo**: GitHub → repo → **Settings → General → Danger Zone → Transfer ownership** → akun/organisasi klien. GitHub membuat redirect dari URL lama, tetapi jangan mengandalkannya.
- [ ] Pengembang ditambahkan kembali sebagai collaborator (bila masih membantu).
- [ ] **Rulesets** ikut pindah. Periksa **Settings → Rules → Rulesets**: ruleset `main` masih mewajibkan PR + status check, dan *Bypass list* masih berisi *Repository admin*, **Apps → Pages CMS**, dan *GitHub Actions* (lihat `CONTRIBUTING.md` → Branch protection).
- [ ] **Settings → Actions → General → Workflow permissions** → centang **Allow GitHub Actions to create and approve pull requests** (dipakai `sync-staging.yml`).
- [ ] **Secrets Actions**: tidak ada yang perlu dipindah. Ketiga workflow hanya memakai token bawaan `github.token`:

  | Workflow | Pemicu | Izin |
  |---|---|---|
  | `ci.yml` (verify + e2e) | push `main`/`staging`, PR ke `staging`/`main` | `contents: read` |
  | `optimize-images.yml` (WebP + sinkron pilihan cabang) | push `main`/`staging` | `contents: write` |
  | `sync-staging.yml` (PR `main → staging`) | cron 03.00 WIB + manual | `contents: read`, `pull-requests: write` |

- [ ] Jalankan **Actions → Sinkron main → staging → Run workflow** sekali untuk memastikan izin bekerja di akun baru.

## 2. Cloudflare Workers + Workers Builds

Konfigurasi ada di `wrangler.jsonc`. Nama Worker harus sama dengan nama di dashboard:

| | Produksi | Staging |
|---|---|---|
| Worker (`name`) | `cutlesshairstudio` | `cutlesshairstudio-staging` (`env.staging`) |
| Branch | `main` | `staging` |
| Build command | `npm run build` | `npm run build:staging` |
| Deploy command | `npx wrangler deploy` | `npx wrangler deploy --env staging` |
| Binding | `ASSETS` (folder `dist/`) | `ASSETS` (folder `dist/`) |
| Vars / secrets | tidak ada (sisa booking online dihapus Okt 2026) | tidak ada |
| D1 / database | tidak ada (binding D1 sisa booking online dihapus Okt 2026) | tidak ada |

Langkah, oleh klien di akun Cloudflare-nya:

- [ ] Workers & Pages → pilih subdomain `*.workers.dev` akun klien (catat, mis. `namaklien.workers.dev`).
- [ ] **Create → Import a repository** → hubungkan GitHub klien (izinkan aplikasi *Cloudflare Workers and Pages* untuk repo `cutlesshairstudio`).
  - Produksi: project name **`cutlesshairstudio`**, production branch **`main`**, build/deploy command sesuai tabel. Matikan *Builds for non-production branches*. Jangan isi `CONTENT_CHECK`.
  - Staging: project name **`cutlesshairstudio-staging`**, production branch **`staging`**, build/deploy command sesuai tabel. Matikan *Builds for non-production branches*.
- [ ] Deploy pertama keduanya hijau (Workers & Pages → Worker → **Deployments**).
- [ ] (Opsional) Domain sendiri: Worker produksi → **Settings → Domains & Routes → Add → Custom domain**.
- [ ] (Opsional) Cloudflare Access untuk staging dan Web Analytics: lihat `README.md` §5.
- [ ] Database D1 lama (sisa booking online staging) di akun pengembang, bila masih ada: tidak dipakai situs dan tidak perlu dipindah. Hapus hanya dengan persetujuan pemilik (datanya sudah diekspor ke `src/content/*.json`).
- [ ] Worker lama di akun pengembang: **matikan setelah** situs baru terverifikasi (langkah 5). Hapus hanya dengan persetujuan klien.

## 3. URL dan nama akun yang ditulis di repo

Setelah subdomain/domain baru diketahui, ganti lewat alur biasa (`feature/*` → `staging` → `main`):

| File | Isi sekarang | Ganti ke |
|---|---|---|
| `src/content/settings.json` → `siteUrl` (**Pengaturan Situs → Alamat website** di Pages CMS) | `https://cutlesshairstudio.adi-yansyaaah.workers.dev` | domain produksi baru. Dipakai canonical, og, sitemap, robots, JSON-LD |
| `.env.staging` → `VITE_SITE_URL` | `https://cutlesshairstudio-staging.adi-yansyaaah.workers.dev` | URL staging baru |
| `README.md` (tabel lingkungan, §5) | URL `adi-yansyaaah.workers.dev` | URL baru |
| `CONTRIBUTING.md` (tabel branch) | URL `adi-yansyaaah.workers.dev` | URL baru |
| `docs/panduan-admin.md` → *Menambah staf* | `https://app.pagescms.org/rockshow02/cutlesshairstudio/main` | `https://app.pagescms.org/<akun-klien>/cutlesshairstudio/main` |
| `docs/panduan-admin.md` → *Setelah Save* | URL utama & staging `adi-yansyaaah.workers.dev` | URL baru |

Tidak ada `account_id` Cloudflare atau token di repo. Periksa ulang dengan:

```sh
git grep -nE "adi-yansyaaah|rockshow02"
```

## 4. Pages CMS

Pages CMS menyimpan collaborator per repo pemilik. Setelah repo pindah, akses perlu disambung ulang.

- [ ] Klien login **https://app.pagescms.org** → **Sign in with GitHub** (akun klien).
- [ ] Pasang aplikasi GitHub **Pages CMS** di akun klien untuk repo `cutlesshairstudio` (diminta otomatis saat pertama membuka repo; atau GitHub → **Settings → Applications → Pages CMS → Configure**).
- [ ] Buka repo → branch `main` dan `staging` sama-sama terbuka, semua koleksi tampil.
- [ ] Menu **Collaborators** → undang ulang email staf (undangan di akun lama tidak ikut pindah).
- [ ] Pastikan **Apps → Pages CMS** ada di *Bypass list* ruleset `main` (langkah 1), lalu minta satu staf Save perubahan kecil di `main`. Commit harus muncul atas nama staf (`settings.commit.identity: user`).
- [ ] Kirim link panel baru ke staf. Minta semua staf menutup tab Pages CMS lama dan login ulang.
- [ ] Pengembang: hapus akses repo dari aplikasi Pages CMS di akun lama bila tidak dibutuhkan lagi.

## 5. Verifikasi akhir

- [ ] Push kecil ke `staging` → Actions **CI** (verify + e2e) hijau → Worker staging baru ter-deploy → URL staging menampilkan label *STAGING*.
- [ ] PR `staging → main` → CI hijau → merge → Worker produksi ter-deploy.
- [ ] Buka situs produksi baru: beranda, `/cabang/<slug>/`, `/cuci-sepatu/`, tombol WhatsApp membuka nomor yang benar.
- [ ] `view-source:` situs produksi: `<link rel="canonical">` dan `sitemap.xml` memakai domain baru.
- [ ] Staging: `robots.txt` berisi `Disallow: /`.
- [ ] Google Search Console (bila dipakai): daftarkan domain baru, kirim `sitemap.xml`.

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
- [ ] Domain `cutlesshairstudio.com`: ikuti **§2a Domain & DNS** (sesudah Worker produksi berada di akun Cloudflare klien).
- [ ] (Opsional) Cloudflare Access untuk staging dan Web Analytics: lihat `README.md` §5.
- [ ] Database D1 lama (sisa booking online staging) di akun pengembang, bila masih ada: tidak dipakai situs dan tidak perlu dipindah. Hapus hanya dengan persetujuan pemilik (datanya sudah diekspor ke `src/content/*.json`).
- [ ] Worker lama di akun pengembang: **matikan setelah** situs baru terverifikasi (langkah 5). Hapus hanya dengan persetujuan klien.

## 2a. Domain & DNS (`cutlesshairstudio.com`)

Domain + hosting dibeli klien di **Rumahweb**. Pembagian setelah selesai:

| Layanan | Tempat | Catatan |
|---|---|---|
| Website `cutlesshairstudio.com` + `www` | Cloudflare Worker produksi `cutlesshairstudio` (Custom Domain) | SSL otomatis dari Cloudflare; `www` dialihkan 301 ke apex |
| DNS (nameserver) | Cloudflare, paket **Free** | Semua record dikelola di Cloudflare |
| Email (`…@cutlesshairstudio.com`), webmail, cPanel | Hosting Rumahweb | Record email **DNS only** (awan abu-abu), tidak lewat proxy |

Lakukan di akun Cloudflare **tempat Worker produksi berada** (akun klien, setelah §2). Zona dan Worker harus satu akun.
Perkiraan waktu: 1 jam kerja + propagasi nameserver (biasanya < 2 jam, maksimal 24–48 jam). Website lama di workers.dev tetap jalan selama proses.

### Langkah 1. Catat record di cPanel Rumahweb (sebelum apa pun diubah)

- [ ] Login cPanel Rumahweb → **Zone Editor** (atau *Domains → Zone Editor*) → domain `cutlesshairstudio.com` → **Manage**. Screenshot/salin semua record.
- [ ] Catat terutama (nilai persis dari cPanel, jangan menebak):

  | Nama | Jenis | Isi (contoh bentuk) |
  |---|---|---|
  | `cutlesshairstudio.com` | MX | `mail.cutlesshairstudio.com` (prioritas mis. 0) |
  | `mail` | A | IP server hosting Rumahweb |
  | `webmail`, `cpanel`, `webdisk` | A atau CNAME | IP server / `cutlesshairstudio.com` |
  | `autodiscover`, `autoconfig` (bila ada) | A atau CNAME | IP server |
  | `cutlesshairstudio.com` | TXT (SPF) | `v=spf1 +a +mx +ip4:<IP> ~all` (salin persis) |
  | `default._domainkey` | TXT (DKIM) | `v=DKIM1; k=rsa; p=…` (panjang, salin utuh) |
  | `_dmarc` (bila ada) | TXT | `v=DMARC1; …` |
  | `cutlesshairstudio.com`, `www` | A / CNAME | IP hosting (website lama Rumahweb): **nanti dihapus** |

- [ ] Pastikan DKIM aktif: cPanel → **Email Deliverability** → `cutlesshairstudio.com` → status DKIM & SPF *Valid*. Bila belum ada, klik **Install the suggested record** dulu, lalu catat nilainya.
- [ ] Catat **IP server** (cPanel → *General Information / Shared IP Address*).

### Langkah 2. Tambahkan zona ke Cloudflare (paket Free)

- [ ] Cloudflare → **Add a domain** → `cutlesshairstudio.com` → **Quick scan for DNS records** → pilih paket **Free**.
- [ ] Bandingkan hasil impor dengan catatan Langkah 1: tambahkan yang belum ada, perbaiki yang salah.
- [ ] Record email & hosting **DNS only** (klik awan sampai abu-abu): `mail`, `webmail`, `cpanel`, `webdisk`, `autodiscover`, `autoconfig`, dan semua record yang menunjuk ke IP Rumahweb. MX dan TXT memang tidak bisa di-proxy.
  - Alasan: email (SMTP/IMAP/POP) tidak bisa lewat proxy Cloudflare, dan sertifikat SSL cPanel (AutoSSL) untuk `mail`/`webmail` butuh akses langsung ke server.
- [ ] **Hapus** record `A`/`AAAA`/`CNAME` untuk `cutlesshairstudio.com` (apex) dan `www` yang menunjuk ke hosting Rumahweb: nama itu akan dipakai Worker (Langkah 4). Jangan hapus MX/TXT di apex.
- [ ] Catat **dua nameserver** yang diberikan Cloudflare (mis. `xxx.ns.cloudflare.com`, `yyy.ns.cloudflare.com`).

### Langkah 3. Ganti nameserver di member area Rumahweb

- [ ] Bila **DNSSEC** aktif di Rumahweb, nonaktifkan dulu (aktifkan lagi nanti dari Cloudflare → *DNS → Settings → DNSSEC* bila diinginkan).
- [ ] Member area Rumahweb → **Domain** → `cutlesshairstudio.com` → **Kelola/Manage** → **Nameserver** → pilih nameserver kustom → isi dua nameserver Cloudflare (hapus nameserver Rumahweb) → simpan.
- [ ] Tunggu email/status Cloudflare **"Active"** untuk zona (Cloudflare → *Overview*). Selama menunggu, email tetap jalan karena record sudah sama di kedua tempat.

### Langkah 4. Pasang domain ke Worker produksi

- [ ] Workers & Pages → `cutlesshairstudio` (produksi) → **Settings → Domains & Routes → Add → Custom domain** → `cutlesshairstudio.com` → **Add**. Ulangi untuk `www.cutlesshairstudio.com`. Cloudflare membuat record DNS & sertifikat SSL otomatis (status *Active* dalam beberapa menit).
- [ ] **www → apex (301)**: zona `cutlesshairstudio.com` → **Rules → Redirect Rules → Create rule → template "Redirect from WWW to root"** (Single Redirect): bila *Hostname* = `www.cutlesshairstudio.com` → URL dinamis `concat("https://cutlesshairstudio.com", http.request.uri.path)`, status **301**, *Preserve query string* aktif → **Deploy**. Aturan ini berjalan sebelum Worker.
- [ ] **SSL/TLS → Edge Certificates → Always Use HTTPS**: aktif.
- [ ] Jangan ubah Worker staging: tetap di `cutlesshairstudio-staging.<subdomain>.workers.dev`.

### Langkah 5. Verifikasi email & SSL

- [ ] `https://cutlesshairstudio.com` → website tampil, gembok SSL valid (sertifikat Cloudflare).
- [ ] `http://cutlesshairstudio.com`, `https://www.cutlesshairstudio.com/cabang/cibubur/?a=1` → dialihkan **301** ke `https://cutlesshairstudio.com/…` (path & query ikut).
- [ ] DNS dari luar: `nslookup -type=mx cutlesshairstudio.com 1.1.1.1` → `mail.cutlesshairstudio.com`; `nslookup -type=txt cutlesshairstudio.com 1.1.1.1` → SPF; `nslookup -type=txt default._domainkey.cutlesshairstudio.com 1.1.1.1` → DKIM.
- [ ] Buka webmail lewat `https://webmail.cutlesshairstudio.com` (alamat `cutlesshairstudio.com/webmail` atau `:2096` di domain utama tidak bisa lagi, karena domain utama sekarang ke Worker) → login → **kirim** email ke Gmail pribadi dan **balas**: keduanya sampai, tidak masuk spam.
- [ ] cPanel → **Email Deliverability**: SPF & DKIM *Valid*. Bila cPanel menyarankan perubahan, ubah record-nya di **Cloudflare** (bukan di Zone Editor cPanel, yang sudah tidak dipakai).
- [ ] cPanel → **SSL/TLS Status**: `mail.` & `webmail.` tercakup AutoSSL (jalankan *Run AutoSSL* bila belum).
- [ ] Aplikasi email di HP/laptop: server masuk/keluar = `mail.cutlesshairstudio.com` (bukan domain utama).

### Langkah 6. Launch (sesudah Langkah 5 lolos)

- [ ] **Pengaturan Situs → Alamat website** = `https://cutlesshairstudio.com` (tanpa `/` di akhir), lewat alur `staging → main` (lihat §3). Sebelum ini, canonical/sitemap tetap memakai alamat workers.dev.
- [ ] (Opsional) **Pengaturan Situs → Email** diganti ke alamat domain, mis. `halo@cutlesshairstudio.com`, setelah kotak suratnya dibuat di cPanel dan lolos uji kirim/terima.
- [ ] Verifikasi akhir §5.

## 3. URL dan nama akun yang ditulis di repo

Setelah subdomain/domain baru diketahui, ganti lewat alur biasa (`feature/*` → `staging` → `main`):

| File | Isi sekarang | Ganti ke |
|---|---|---|
| `src/content/settings.json` → `siteUrl` (**Pengaturan Situs → Alamat website** di Pages CMS) | `https://cutlesshairstudio.adi-yansyaaah.workers.dev` | `https://cutlesshairstudio.com` **saat launch** (§2a Langkah 6). Dipakai canonical, og, sitemap, robots, JSON-LD |
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
- [ ] Google Search Console (bila dipakai): daftarkan domain `cutlesshairstudio.com` (verifikasi lewat record TXT di Cloudflare), kirim `https://cutlesshairstudio.com/sitemap.xml`.

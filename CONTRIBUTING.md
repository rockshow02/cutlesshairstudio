# Alur kerja: konten → main · fitur → staging → rilis berversi · hotfix → main

| Perubahan | Jalur | Tayang | Versi |
|---|---|---|---|
| **Konten** (harga, foto, FAQ, video, cabang, …) | Pages CMS → branch `main` langsung | otomatis ±3–5 menit, **bila lolos validasi ketat** | tidak berubah |
| **Fitur / perbaikan biasa** | `feat/<nama>` (atau `fix/…`, `chore/…`) → PR ke `staging` → uji → **rilis**: PR `staging` → `main` | saat PR rilis di-merge | MINOR (`1.2.0` → `1.3.0`) atau PATCH |
| **Hotfix** (produksi rusak, tidak bisa menunggu rilis) | `hotfix/<nama>` dari `main` → PR langsung ke `main` | saat PR hotfix di-merge | PATCH (`1.2.0` → `1.2.1`) |

| Branch | Fungsi | Deploy |
|---|---|---|
| `main` | **Produksi** | Worker `cutlesshairstudio` → https://cutlesshairstudio.com (workers.dev produksi mati) |
| `staging` | **Pengujian** fitur sebelum rilis | Worker `cutlesshairstudio-staging` → https://cutlesshairstudio-staging.adi-yansyaaah.workers.dev |
| `feat/*`, `fix/*`, `chore/*` | Pekerjaan baru | tidak dideploy (uji lokal) |
| `hotfix/*` | Perbaikan darurat dari `main` | tidak dideploy sampai di-merge ke main |

```
Pages CMS ─────────────────────────────────────────────▶ main ──▶ cutlesshairstudio.com
feat/x ──PR──▶ staging ──PR rilis vX.Y.Z (CI wajib lolos)──▶ main ──▶ tag vX.Y.Z + GitHub Release
hotfix/y (dari main) ──PR vX.Y.Z+1──────────────────────────▶ main
                  ▲                                            │
                  └──── sinkron otomatis tiap push ke main ────┘  (merge otomatis bila tanpa bentrok)
```

## 1. Mengerjakan fitur

```bash
git switch staging && git pull
git switch -c feat/transisi
npm run dev                         # http://localhost:5173 (badge DEV)
# ... kerjakan, commit ...
npm run typecheck && npm run lint && npm test && npm run check:content   # sama seperti CI
git push -u origin feat/transisi
```

Buka Pull Request **feat/transisi → staging** di GitHub. CI berjalan (konten boleh belum lengkap; masalah "siap tayang" hanya peringatan). Setelah merge, staging otomatis dideploy (±2 menit). Uji di URL staging. Tambahkan catatan di bagian **`## [Belum dirilis]`** CHANGELOG.md (Ditambahkan / Diubah / Diperbaiki) di PR yang sama.

### Aturan: fitur baru wajib punya toggle di CMS, default mati

Setiap bagian/halaman baru yang tampil ke pengunjung **wajib** punya toggle di Pages CMS (mis. *Tampilkan FAQ*, *Tampilkan bagian Video*, *Tampilkan Produk*) dengan **default mati**: `z.boolean().default(false)` di skema, `default: false` di `.pages.yml`, dan nilai awal `false` di file konten.

- Rilis aman walau kontennya belum siap: kode tayang di produksi, bagiannya baru muncul saat pemilik menyalakannya.
- Mati = tidak dirender sama sekali (termasuk HTML statis, JSON-LD, sitemap, menu), bukan disembunyikan dengan CSS.
- Tes unit untuk keadaan mati & aktif; e2e memakai data uji (mis. aktif di build bawaan, mati di varian uniform).
- Aturan launch (`crossCheck` di `src/content/schema.ts`) menandai toggle yang aktif tetapi isinya belum lengkap.

## 2. Edit konten di main (Pages CMS)

Pemilik & staf mengedit konten di branch **`main`** lewat Pages CMS (panduan: `docs/panduan-admin.md`). Setiap Save = 1 commit ke `main`:

1. **Cloudflare Workers Builds** menjalankan `npm run build`: validasi konten **mode ketat**, selalu (variabel `CONTENT_CHECK=warn` diabaikan untuk build produksi). Lolos → deploy. Gagal → **deploy tidak dijalankan, versi sebelumnya tetap tayang**.
2. **CI `verify`** berjalan di push yang sama dengan pemeriksaan yang sama. Bila gagal, ringkasan run menyebut file/entri/kolom yang harus dibetulkan dan bahwa website tidak berubah.
3. **Sinkron main → staging** membawa perubahan itu ke staging (§5).

Simpanan Pages CMS langsung ke `main` diizinkan (bypass ruleset, lihat [Branch protection](#branch-protection-sekali-oleh-admin-repo)); perubahan **kode** tetap wajib lewat PR.

## 3. Rilis versi (staging → main)

1. Pastikan tidak ada PR sinkron `main → staging` berlabel **perlu-dicek** yang terbuka (sinkron lancar tidak membuat PR; ada PR → selesaikan dulu, §5).
2. Uji di URL staging ([checklist](#checklist-sebelum-merge-ke-main)). Badge **STAGING** harus **0 belum siap**.
3. **Naikkan versi** lewat branch kecil ke staging (mis. `chore/rilis-1.3.0`):
   ```bash
   npm version minor --no-git-tag-version   # 1.2.0 → 1.3.0 (fitur). Perbaikan saja: patch. Perubahan besar: major
   node scripts/release.mjs check           # versi > tag terakhir & bagian CHANGELOG ada
   ```
   Di CHANGELOG.md: ganti judul `## [Belum dirilis]` menjadi `## [1.3.0] - YYYY-MM-DD` (tanggal rilis), tambahkan `## [Belum dirilis]` kosong di atasnya, dan perbarui tautan perbandingan di bawah file.
4. Buka PR **staging → main** (judul mis. `Rilis v1.3.0`). CI menjalankan typecheck, lint, tes, validasi konten **ketat**, build produksi, e2e, dan **cek versi** (versi > tag terakhir, tag belum ada, bagian CHANGELOG bertanggal & berisi). Versi belum dinaikkan → CI merah dengan pesan langkah perbaikannya.
5. Merge (pakai **Create a merge commit**) setelah CI hijau. Cloudflare mendeploy produksi; workflow **Rilis versi** (`.github/workflows/release.yml`) membuat tag `v1.3.0` di commit merge dan GitHub Release berisi bagian CHANGELOG versi itu. Bila workflow itu gagal: perbaiki penyebabnya (pesan di log), lalu **Actions → Rilis versi → Run workflow** (ref: `main`).

PR ke `main` dari branch selain `staging` dan `hotfix/*` ditolak CI dengan penjelasan alurnya.

## 4. Hotfix (perbaikan darurat produksi)

Untuk kesalahan **kode** di produksi yang tidak bisa menunggu rilis berikutnya. Kesalahan **konten** cukup dibetulkan lewat Pages CMS.

```bash
git fetch origin && git switch -c hotfix/harga-tidak-tampil origin/main
# ... perbaiki seminimal mungkin + tes ...
npm version patch --no-git-tag-version          # mis. 1.3.0 → 1.3.1
# CHANGELOG.md: tambah "## [1.3.1] - YYYY-MM-DD" + "### Diperbaiki" (di bawah "## [Belum dirilis]")
node scripts/release.mjs check && npm run typecheck && npm run lint && npm test
git push -u origin hotfix/harga-tidak-tampil
```

Buka PR **hotfix/… → main**. CI sama dengan PR rilis. Setelah merge: produksi terdeploy, tag `v1.3.1` + GitHub Release dibuat otomatis, dan sinkron otomatis membawa hotfix ke `staging`. Bila staging sudah menaikkan versi untuk rilis berikutnya, sinkron bisa bentrok di `package.json`/CHANGELOG.md: pertahankan versi staging dan sisipkan bagian hotfix di CHANGELOG (§5).

### Rollback

1. **Segera (detik):** Cloudflare → **Workers & Pages → cutlesshairstudio → Deployments → ⋯ → Rollback** ke versi yang benar (atau `npx wrangler rollback`). Isi GitHub tidak berubah, jadi build berikutnya (mis. Save Pages CMS) menayangkan lagi isi `main`. Lanjutkan ke langkah 2.
2. **Permanen:** batalkan commit-nya di `main` lewat jalur hotfix (tombol *Revert* GitHub membuat branch `revert-…`, yang ditolak CI):
   ```bash
   git fetch origin && git switch -c hotfix/revert-v1.3.0 origin/main
   git revert -m 1 <sha-merge-rilis>      # commit merge PR rilis; commit Pages CMS biasa: git revert <sha>
   npm version patch --no-git-tag-version  # + CHANGELOG "### Diperbaiki: membatalkan …"
   git push -u origin hotfix/revert-v1.3.0  # PR → main
   ```
   Konten yang salah cukup dibetulkan lewat Pages CMS (tanpa revert).

## 5. Sinkron main → staging (otomatis)

Workflow **Sinkron main → staging** (`.github/workflows/sync-staging.yml`) berjalan di **setiap push ke `main`** (edit Pages CMS, rilis, hotfix), plus jadwal harian 03.00 WIB sebagai cadangan dan manual (**Actions → Sinkron main → staging → Run workflow**):

1. Menggabungkan `main` ke `staging` di runner, menjalankan pemeriksaan yang sama dengan CI staging (typecheck, lint, tes, validasi konten, build staging), lalu push ke `staging`. Cloudflare mendeploy staging. Logikanya di `scripts/sync-staging.mjs` (diuji `tests/syncStaging.test.ts`).
2. **Satu sinkron dalam satu waktu** (concurrency `sinkron-staging`): run baru menunggu, tidak berebut push.
3. **Push ditolak karena staging berubah** di tengah sinkron (mis. fitur baru di-merge): fetch ulang, merge & periksa lagi dari staging terbaru, maks. 3×. Tidak pernah *force push*.
4. **Install dependensi & tes unit yang gagal diulang sekali.** Lolos saat diulang → sinkron jalan terus, ringkasan run & anotasi mencatat *kemungkinan flaky* (perlu diperiksa, bukan diabaikan). Gagal 2× → kegagalan sungguhan. Typecheck, lint, validasi konten, dan build tidak diulang (hasilnya selalu sama).
5. **Gagal sungguhan** (bentrok, pemeriksaan gagal, push ditolak 3×): run merah (centang merah di commit `main`), ringkasan run berisi alasannya, dan dibuat PR **main → staging** berlabel **perlu-dicek** dengan alasan + tautan log (sudah ada → diberi label & komentar). Tidak ada yang di-push.

Sinkron yang lancar **tidak** membuat PR. PR buatan bot (`GITHUB_TOKEN`) memicu CI yang menunggu *Approve and run*; begitu sinkron mem-push ke staging, PR itu ter-merge dan run CI-nya kedaluwarsa merah (*"required approval but was not approved before it expired"*), padahal sinkronnya lolos. Karena itu pemeriksaannya dijalankan di dalam workflow sinkron. Di PR **perlu-dicek**, tekan *Approve and run* bila ingin CI lengkap (termasuk e2e).

### Menyelesaikan sinkron yang perlu dicek

**Bentrok:** file yang sama diubah di main (oleh pemilik) dan di staging. Biasanya `src/content/*.json`.

```bash
git switch staging && git pull
git merge origin/main            # muncul konflik
# Buka file yang konflik. Untuk konten: pertahankan versi PRODUKSI (main) kecuali memang sedang diuji di staging.
#   Ambil versi main untuk satu file: git checkout --theirs src/content/pricing.json
npm run check:content            # pastikan JSON tetap valid
git add . && git commit && git push   # PR perlu-dicek tercatat merged otomatis
```

**Pemeriksaan gagal:** buka log run (tautan di PR), perbaiki di `staging` lewat branch kecil, lalu jalankan workflow sinkron lagi (**Actions → Sinkron main → staging → Run workflow**).

**Push ditolak 3×:** staging terus berubah selama sinkron, atau izin/ruleset menolak push bot (alasan lengkap di ringkasan run). Jalankan workflow sinkron lagi; bila tetap ditolak, cek bypass list ruleset staging (§ Branch protection).

## 6. Menguji konten lewat Pages CMS (branch staging)

1. Buka https://app.pagescms.org → repo **cutlesshairstudio** → pilih branch **staging** (menu branch di kiri atas).
2. Edit konten seperti biasa → **Save**. Commit masuk ke `staging`, URL staging terdeploy ±2 menit.
3. Ingin lihat langsung di laptop? Jalankan `npm run dev:sync` (lihat di bawah); perubahan tampil di localhost dalam ±15 detik.
4. Pemilik tetap memakai branch **main**. Konten yang diuji di staging ikut ke produksi saat PR staging → main di-merge.

`.pages.yml` ada di kedua branch (branch staging dibuat dari main). Ubah `.pages.yml` lewat alur fitur → staging → rilis seperti kode.

## 7. Perintah lokal

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Vite mode development, http://localhost:5173, badge **DEV** |
| `npm run dev:sync` | Seperti `dev`, plus menarik `origin/staging` setiap 15 detik (fast-forward saja). Syarat: sedang di branch `staging` dan tidak ada file yang diubah. Bila tidak, berhenti dengan pesan; tidak pernah menimpa perubahan lokal. Bila di tengah jalan Anda mengubah file/commit lokal, sinkron dijeda otomatis. Interval: `DEV_SYNC_INTERVAL=30` |
| `npm run build:staging` | Build mode staging (noindex, siteUrl staging, badge STAGING) |
| `npm run build` | Build produksi (ketat: konten belum siap tayang → gagal) |
| `npm run preview:worker` | Build staging lalu `wrangler dev` di http://localhost:8787: menguji Worker sungguhan (redirect `/cabang/x` → `/cabang/x/`, halaman cabang hasil prerender, `/produk/`, header `_headers`, halaman 404) |
| `npm run check:content` | Validasi konten seperti CI (`CONTENT_CHECK=warn` untuk mode longgar) |
| `npm test` | Vitest: skema konten, srcset otomatis, pesan WhatsApp |
| `npm run e2e` | Playwright 360 px & 1280 px terhadap `wrangler dev` (situs statis): tombol WhatsApp per cabang, pita logo partner (5 logo uji), Daftar Harga 3 kategori (format K), booking per kapster, halaman `/cuci-sepatu/` + teaser + lightbox (partner uji), `/partner` dicabut, tanpa request `/api/*`, rute lama → beranda/404. Menjalankan `npm run e2e:server` otomatis bila port 8787 kosong |
| `npm run build:e2e` / `npm run e2e:server` | Build E2E (`--mode e2e`, `.env.e2e`): seperti staging, tetapi cabang & barber memakai **data uji tetap** dari `e2e/fixtures/content.ts`, sehingga perubahan di Pages CMS (mis. status cabang) tidak membuat tes gagal. Hanya untuk tes, tidak pernah di-deploy. Bila `wrangler dev` sudah jalan di 8787, pastikan isinya hasil `build:e2e` |
| `npm run dev:worker` | Build staging + `wrangler dev` (pratinjau situs dengan data CMS asli) |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |

Konten tidak valid di dev (mis. commit Pages CMS yang salah) tampil sebagai **overlay error** di browser, berisi nama file, entri, dan kolomnya.

## 8. Environment

| | development | staging | production |
|---|---|---|---|
| File | `.env.development` | `.env.staging` | `.env.production` |
| `VITE_SITE_URL` (canonical, og, sitemap, JSON-LD) | http://localhost:5173 | URL workers.dev staging | kosong → **Pengaturan Situs → Alamat website** |
| Badge di layar | DEV | STAGING | tidak ada (kodenya tidak ikut ter-build) |
| Judul tab | `[DEV] …` | `[STAGING] …` | normal |
| Mesin pencari | – | `robots.txt` Disallow: /, `<meta name="robots" content="noindex">`, header `X-Robots-Tag: noindex, nofollow` | normal |
| Cloudflare Web Analytics | mati | mati | aktif bila `VITE_CF_ANALYTICS_TOKEN` diisi |
| Konten belum siap tayang | peringatan + badge | peringatan + badge | **build gagal** |

Tidak ada rahasia di file `.env.*` (semua `VITE_*` terbaca di browser). Override pribadi: `.env.local` / `.env.development.local` (di-ignore git).

## Checklist sebelum merge ke main

- [ ] Badge STAGING: **0 belum siap**
- [ ] Tampilan mobile **360 px**: tidak ada scroll horizontal, teks/tombol tidak bertumpuk (DevTools → 360 × 740)
- [ ] Semua link WhatsApp mengarah ke **nomor cabang yang benar**: pilih tiap cabang → tombol booking hero, navbar, harga, barber, promo, tombol WA melayang, halaman `/cabang/<slug>/`
- [ ] `/cabang/<slug>/` tiap cabang bisa di-**refresh** (dan `/cabang/<slug>` tanpa garis miring diarahkan) di URL staging
- [ ] Transisi/animasi aman dengan **prefers-reduced-motion** (DevTools → Rendering → Emulate CSS prefers-reduced-motion: reduce → tidak ada animasi besar, konten tetap tampil)
- [ ] **Lighthouse mobile ≥ 85** (Performance, Accessibility, Best Practices, SEO) di URL staging. SEO staging memang turun karena noindex; nilai SEO dicek di `npm run preview`
- [ ] Fitur baru punya **toggle di CMS, default mati** ([aturan](#aturan-fitur-baru-wajib-punya-toggle-di-cms-default-mati))
- [ ] Tidak ada PR sinkron `main → staging` yang terbuka / berlabel **perlu-dicek**
- [ ] **Versi dinaikkan** di `package.json` + bagian `## [X.Y.Z] - tanggal` di CHANGELOG.md (`node scripts/release.mjs check`)
- [ ] CI hijau

## Branch protection (sekali, oleh admin repo)

Gratis untuk repo publik. **Settings → Rules → Rulesets → New ruleset → New branch ruleset**:

- **Name:** `main produksi` · **Enforcement:** Active
- **Bypass list → Add bypass:** *Repository admin* (agar edit Pages CMS pemilik tetap langsung tayang) **Apps → Pages CMS** (collaborator Pages CMS tanpa akun GitHub menyimpan lewat GitHub App ini; tanpa bypass, simpanan mereka di `main` ditolak) dan *GitHub Actions* bila tersedia di daftar (agar workflow **Sinkron konten** bisa meng-commit WebP ke main). Bila *GitHub Actions* tidak bisa ditambahkan, gambar tetap dikompres saat build Cloudflare (`prebuild`); hanya commit WebP otomatis di main yang tertolak.
- **Target branches:** Include default branch (`main`)
- **Rules:** ✅ Restrict deletions · ✅ Require a pull request before merging (Required approvals: **0**, karena developer tunggal tidak bisa menyetujui PR sendiri) · ✅ Require status checks to pass → **Add checks → `verify` dan `e2e`** · ✅ Block force pushes
- **Create**.

PR ke `main` hanya diterima dari `staging` dan `hotfix/*` (dicek CI `verify`, yang wajib lolos). Commit Pages CMS ke `main` lewat bypass di atas tetap langsung masuk.

Lalu **Settings → Actions → General → Workflow permissions**: **biarkan default "Read repository contents and packages permissions"** dan centang **Allow GitHub Actions to create and approve pull requests** → Save. Izin tulis tidak diberikan lewat default repo, melainkan eksplisit per workflow (blok `permissions`, minimum; yang tidak disebut = `none`):

| Workflow | Izin `GITHUB_TOKEN` | Untuk |
|---|---|---|
| CI (`ci.yml`) | `contents: read` | checkout saja |
| Sinkron konten (`optimize-images.yml`) | `contents: write` | commit WebP & dropdown cabang `.pages.yml` |
| Sinkron main → staging (`sync-staging.yml`) | `contents: write`, `pull-requests: write` | push ke staging; PR, label `perlu-dicek`, komentar (endpoint label/komentar menerima izin *Pull requests*) |
| Rilis versi (`release.yml`) | `contents: write` | push tag & GitHub Release |

Workflow baru wajib menulis blok `permissions` sendiri (mulai dari `contents: read`).

Bila `staging` juga diberi ruleset (opsional), tambahkan *GitHub Actions* ke bypass list-nya agar sinkron otomatis bisa push ke staging; tanpa itu PR sinkron tetap dibuat tetapi harus di-merge manual.

> **Konsekuensi:** setelah launch, pengeditan harian konten dilakukan di branch `main` lewat Pages CMS. Pemilik (admin repo) dan collaborator Pages CMS (lewat bypass aplikasi **Pages CMS**) bisa langsung menyimpan; akun GitHub *non-admin* lain akan ditolak (wajib PR). Nama & email pengedit tercatat di commit (`settings.commit.identity: user` di `.pages.yml`).

## Tentang Decap CMS (alternatif offline): tidak dipasang

Decap CMS dengan `local_backend` sempat dipertimbangkan untuk mengedit konten tanpa internet, tetapi **tidak diimplementasikan**:

- Semua konten (`pricing.json`, `barbers.json`, …) berupa **array di level atas file**. Koleksi *file* di Decap selalu menulis **objek** (`{ "items": [...] }`) dan belum mendukung array di akar file. Koleksi *folder* butuh satu file per entri. Memakai Decap berarti mengubah format semua file konten, sehingga Pages CMS, skema Zod, dan `src/lib/content.ts` ikut berubah.
- Konfigurasi hasil generate dari `.pages.yml` akan kehilangan fitur yang tidak punya padanan di Decap (dropdown cabang yang disinkronkan, `pattern`, format tanggal Pages CMS), sehingga validasinya berbeda dari panel yang dipakai pemilik.

Untuk uji offline cukup edit file `src/content/*.json` langsung (`npm run dev`); validasi Zod dan overlay error tetap berjalan.

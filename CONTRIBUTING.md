# Alur kerja: feature → staging → main

| Branch | Fungsi | Deploy | Siapa yang menulis |
|---|---|---|---|
| `main` | **Produksi** | Worker `cutlesshairstudio` → https://cutlesshairstudio.adi-yansyaaah.workers.dev | Merge PR dari `staging`; edit konten harian pemilik lewat Pages CMS |
| `staging` | **Pengujian** | Worker `cutlesshairstudio-staging` → https://cutlesshairstudio-staging.adi-yansyaaah.workers.dev | Merge dari `feature/*`; uji konten lewat Pages CMS (branch staging); PR sinkron `main → staging` |
| `feature/<nama>` | Pekerjaan baru (mis. `feature/transisi`) | tidak dideploy (uji di lokal) | Developer |

```
feature/transisi ──PR──▶ staging ──PR (CI wajib lolos)──▶ main
                             ▲                              │
                             └──── PR otomatis harian ──────┘  (edit konten pemilik di produksi)
```

## 1. Mengerjakan fitur

```bash
git switch staging && git pull
git switch -c feature/transisi
npm run dev                         # http://localhost:5173 (badge DEV)
# ... kerjakan, commit ...
npm run typecheck && npm run lint && npm run check:content   # sama seperti CI
git push -u origin feature/transisi
```

Buka Pull Request **feature/transisi → staging** di GitHub. CI berjalan (konten boleh belum lengkap; masalah "siap tayang" hanya peringatan). Setelah merge, staging otomatis dideploy (±2 menit). Uji di URL staging.

## 2. Rilis ke produksi

1. Uji di URL staging (lihat [checklist](#checklist-sebelum-merge-ke-main)). Badge **STAGING** di pojok kiri bawah menunjukkan konten yang belum siap tayang. Angkanya harus **0**.
2. Buka PR **staging → main**. CI menjalankan typecheck, lint, validasi konten **ketat** (tidak ada nomor contoh 6281234567890, kata "contoh", TODO, branchSlug tidak dikenal, cabang Aktif tanpa WA/jam), dan build produksi.
3. Merge (pakai **Create a merge commit**) setelah CI hijau. Cloudflare mendeploy produksi otomatis.

PR ke `main` dari branch selain `staging` otomatis ditolak CI. Hotfix pun lewat staging dulu (cepat: buat `feature/hotfix-…` → staging → main).

## 3. Sinkron main → staging (otomatis)

Pemilik mengedit konten langsung di `main` lewat Pages CMS. Workflow **Sinkron main → staging** (`.github/workflows/sync-staging.yml`) berjalan setiap hari 03.00 WIB (atau manual: **Actions → Sinkron main → staging → Run workflow**) dan membuka/memperbarui PR **main → staging**.

- Merge PR itu dengan **Create a merge commit** (jangan squash/rebase).
- PR yang dibuat bot tidak memicu CI (batasan GitHub untuk `GITHUB_TOKEN`); itu tidak masalah karena isinya sudah ada di produksi.
- **Selalu merge PR sinkron sebelum membuat PR staging → main**, agar edit pemilik tidak tertimpa.

### Menyelesaikan konflik sinkron

PR berlabel **conflict** berarti file yang sama diubah di main (oleh pemilik) dan di staging. Biasanya `src/content/*.json`.

```bash
git switch staging && git pull
git merge origin/main            # muncul konflik
# Buka file yang konflik. Untuk konten: pertahankan versi PRODUKSI (main) kecuali memang sedang diuji di staging.
#   Ambil versi main untuk satu file: git checkout --theirs src/content/pricing.json
npm run check:content            # pastikan JSON tetap valid
git add . && git commit && git push   # PR sinkron otomatis tertutup sebagai merged
```

## 4. Menguji konten lewat Pages CMS (branch staging)

1. Buka https://app.pagescms.org → repo **cutlesshairstudio** → pilih branch **staging** (menu branch di kiri atas).
2. Edit konten seperti biasa → **Save**. Commit masuk ke `staging`, URL staging terdeploy ±2 menit.
3. Ingin lihat langsung di laptop? Jalankan `npm run dev:sync` (lihat di bawah); perubahan tampil di localhost dalam ±15 detik.
4. Pemilik tetap memakai branch **main**. Konten yang diuji di staging ikut ke produksi saat PR staging → main di-merge.

`.pages.yml` ada di kedua branch (branch staging dibuat dari main). Ubah `.pages.yml` lewat alur feature → staging → main seperti kode.

## 5. Perintah lokal

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Vite mode development, http://localhost:5173, badge **DEV** |
| `npm run dev:sync` | Seperti `dev`, plus menarik `origin/staging` setiap 15 detik (fast-forward saja). Syarat: sedang di branch `staging` dan tidak ada file yang diubah. Bila tidak, berhenti dengan pesan; tidak pernah menimpa perubahan lokal. Bila di tengah jalan Anda mengubah file/commit lokal, sinkron dijeda otomatis. Interval: `DEV_SYNC_INTERVAL=30` |
| `npm run build:staging` | Build mode staging (noindex, siteUrl staging, badge STAGING) |
| `npm run build` | Build produksi (ketat: konten belum siap tayang → gagal) |
| `npm run preview:worker` | Build staging lalu `wrangler dev` di http://localhost:8787: menguji Worker sungguhan (redirect `/cabang/x` → `/cabang/x/`, halaman cabang hasil prerender, `/produk/`, header `_headers`, halaman 404) |
| `npm run check:content` | Validasi konten seperti CI (`CONTENT_CHECK=warn` untuk mode longgar) |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |

Konten tidak valid di dev (mis. commit Pages CMS yang salah) tampil sebagai **overlay error** di browser, berisi nama file, entri, dan kolomnya.

## 6. Environment

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
- [ ] PR sinkron `main → staging` (bila ada) sudah di-merge
- [ ] CI hijau

## Branch protection (sekali, oleh admin repo)

Gratis untuk repo publik. **Settings → Rules → Rulesets → New ruleset → New branch ruleset**:

- **Name:** `main produksi` · **Enforcement:** Active
- **Bypass list → Add bypass:** *Repository admin* (agar edit Pages CMS pemilik tetap langsung tayang) dan *GitHub Actions* bila tersedia di daftar (agar workflow **Sinkron konten** bisa meng-commit WebP ke main). Bila *GitHub Actions* tidak bisa ditambahkan, gambar tetap dikompres saat build Cloudflare (`prebuild`); hanya commit WebP otomatis di main yang tertolak.
- **Target branches:** Include default branch (`main`)
- **Rules:** ✅ Restrict deletions · ✅ Require a pull request before merging (Required approvals: **0**, karena developer tunggal tidak bisa menyetujui PR sendiri) · ✅ Require status checks to pass → **Add checks → `verify`** · ✅ Block force pushes
- **Create**.

Lalu **Settings → Actions → General → Workflow permissions** → centang **Allow GitHub Actions to create and approve pull requests** → Save (dibutuhkan workflow sinkron main → staging).

> **Konsekuensi:** kolaborator *non-admin* yang memakai Pages CMS di branch `main` akan ditolak (wajib PR). Staff sebaiknya memakai branch `staging`, atau jadikan admin hanya orang yang boleh mengubah produksi langsung.

## Tentang Decap CMS (alternatif offline): tidak dipasang

Decap CMS dengan `local_backend` sempat dipertimbangkan untuk mengedit konten tanpa internet, tetapi **tidak diimplementasikan**:

- Semua konten (`pricing.json`, `barbers.json`, …) berupa **array di level atas file**. Koleksi *file* di Decap selalu menulis **objek** (`{ "items": [...] }`) dan belum mendukung array di akar file. Koleksi *folder* butuh satu file per entri. Memakai Decap berarti mengubah format semua file konten, sehingga Pages CMS, skema Zod, dan `src/lib/content.ts` ikut berubah.
- Konfigurasi hasil generate dari `.pages.yml` akan kehilangan fitur yang tidak punya padanan di Decap (dropdown cabang yang disinkronkan, `pattern`, format tanggal Pages CMS), sehingga validasinya berbeda dari panel yang dipakai pemilik.

Untuk uji offline cukup edit file `src/content/*.json` langsung (`npm run dev`); validasi Zod dan overlay error tetap berjalan.

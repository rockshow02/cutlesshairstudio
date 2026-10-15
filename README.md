# Cutless Hair Studio, website (biaya Rp0)

Landing page Vite + React 18 + TypeScript + CSS Modules. Konten yang sering berubah dikelola lewat **[Pages CMS](https://pagescms.org)**: CMS berbasis Git, konten disimpan sebagai file JSON di repo ini. Tidak ada server, database, atau API.

| Kebutuhan | Layanan | Biaya |
|---|---|---|
| Kode & konten | GitHub (repo ini) | Gratis |
| Panel admin | Pages CMS (app.pagescms.org) | Gratis |
| Hosting + CDN + HTTPS | Cloudflare Pages (`*.pages.dev`) | Gratis |
| Kompres gambar otomatis | GitHub Actions | Gratis (lihat kuota di bawah) |
| Peta & booking | Google Maps embed, link `wa.me` | Gratis |

> Versi lama dengan Strapi diarsipkan di branch [`archive/strapi`](../../tree/archive/strapi).

---

## 1. Menjalankan lokal

Kebutuhan: Node.js 20.19+ (disarankan 22, lihat `.node-version`). **Tidak ada variabel env yang wajib.**

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # optimasi gambar → type-check → validasi konten → build ke dist/
npm run preview    # cek hasil build
```

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server. Konten tidak valid ditampilkan sebagai overlay error |
| `npm run build` | Build produksi. **Gagal** bila ada konten JSON yang tidak sesuai skema |
| `npm run optimize-images` | Kompres gambar baru di `public/uploads/` ke WebP & perbarui path di JSON |
| `npm run typecheck` | Cek TypeScript |

Opsional: `VITE_CONTENT_DELAY=1500 npm run dev` untuk mensimulasikan loading.

## 2. Struktur konten

```
.pages.yml                  konfigurasi panel admin Pages CMS (label & bantuan bahasa Indonesia)
src/content/
  pricing.json              Daftar Harga        ← diedit lewat Pages CMS
  barbers.json              Barber              ← Pages CMS
  gallery.json              Galeri              ← Pages CMS
  promos.json               Promo               ← Pages CMS
  announcements.json        Pengumuman          ← Pages CMS
  settings.json             Pengaturan Situs    ← Pages CMS
  schema.ts                 skema Zod keenam file di atas (acuan tunggal)
  *.ts                      teks statis: hero, about, layanan, testimoni, label UI, SEO, judul section
public/uploads/
  barbers/  gallery/  promos/  site/    gambar dari Pages CMS (WebP)
src/lib/content.ts          lapisan data: getPricing(), getBarbers(), ... (signature tidak berubah)
src/lib/contentTransforms.ts  filter isActive, urut order, gabung dengan teks statis
scripts/optimize-images.mjs   kompres gambar (sharp)
scripts/vite-content-plugin.ts  validasi konten saat build + ukuran gambar
```

### Skema

| File | Field |
|---|---|
| `pricing.json` | `name`, `category` (Haircut \| Shaving \| Coloring \| Treatment \| Kids \| Paket), `price` (integer Rupiah), `priceFrom`, `description`, `badge` (Best Seller \| Baru \| Promo \| kosong), `order`, `isActive` |
| `barbers.json` | `name`, `role`, `photo`, `specialty` (dipisah koma), `whatsappNumber` (opsional, `62xxxx`), `instagram`, `order`, `isActive` |
| `gallery.json` | `image`, `altText`, `styleCategory` (Fade \| Pompadour \| Crop \| Coloring \| Perming \| Lainnya), `caption`, `order`, `isActive` |
| `promos.json` | `title`, `description`, `image`, `ctaLabel`, `waMessage`, `startDate`, `endDate`, `isActive` |
| `announcements.json` | `message` (maks. 160), `type` (Info \| Tutup \| Jam Khusus), `startDate`, `endDate`, `isActive` |
| `settings.json` | `logo`, `siteName`, `mainWhatsappNumber`, `defaultWaMessage`, `instagramUrl`, `tiktokUrl`, `googleMapsUrl`, `address`, `footerText`, `openingHours[]` (`day`, `openTime`, `closeTime`, `isClosed`) |

### Aturan

- **Validasi saat build (Zod).** JSON yang salah (harga bukan angka, nomor WA bukan `62…`, pesan > 160 karakter, tanggal selesai sebelum mulai, gambar tidak ada, dll.) membuat build **gagal** dengan pesan seperti:
  ```
  ✗ Konten tidak valid (1 masalah). Perbaiki lewat Pages CMS atau file di src/content/:
    • pricing.json: entri #1 ("Signature Haircut") → price: harga harus angka
  ```
  Cloudflare tetap menayangkan versi terakhir yang berhasil, jadi kesalahan input tidak pernah tayang.
- `isActive: false` disembunyikan; urutan memakai `order` (kecil → besar).
- **Tanggal promo & pengumuman** disimpan tanpa zona waktu (`2026-10-20T10:00`) dan dibaca sebagai **WIB**. Filternya dijalankan **di browser saat halaman dibuka**, jadi promo muncul/hilang tepat waktu tanpa build ulang.
- Hanya-tanggal (`2026-10-20`) sebagai tanggal selesai berarti sampai 23:59:59 WIB.

## 3. Gambar

- Upload lewat Pages CMS masuk ke `public/uploads/<jenis>/`.
- Workflow **`.github/workflows/optimize-images.yml`** berjalan otomatis saat ada file baru di `public/uploads/**`: kompres ke **WebP** (maks. 1600 px galeri/promo, 800 px barber/logo), hapus file asli, perbarui path di JSON, lalu commit.
- `npm run build` juga menjalankan optimasi (`prebuild`), jadi situs yang dideploy selalu memakai gambar teroptimasi walau workflow belum selesai.
- Ukuran asli gambar dibaca saat build (modul `virtual:image-meta`) → tidak ada layout shift, layout galeri tegak/lebar otomatis. Semua gambar tetap lazy-load dengan alt text dari data.
- Kuota GitHub Actions: repo **publik** gratis tanpa batas; repo **privat** 2.000 menit/bulan (satu run ±1 menit).

## 4. Deploy ke Cloudflare Pages (gratis)

1. Login [dash.cloudflare.com](https://dash.cloudflare.com) (akun gratis) → **Workers & Pages → Create → Pages → Connect to Git**.
2. Pilih repo `cutlesshairstudio`, branch produksi **`main`**.
3. Build settings:
   - Framework preset: **None** (atau Vite)
   - Build command: **`npm run build`**
   - Build output directory: **`dist`**
   - Environment variables: **tidak perlu** (versi Node dibaca dari `.node-version`)
4. **Save and Deploy**. Situs tersedia di `https://<nama-proyek>.pages.dev`.
5. Setiap commit ke `main`, termasuk setiap "Save" di Pages CMS, otomatis build & deploy (±1–2 menit).
   Kuota gratis: 500 build/bulan.
6. Setelah domain final diketahui, ganti `https://cutlesshairstudio.id/` di `index.html` (canonical, og:url, og:image) dan `src/content/site.ts` (`seo.url`).

**Opsional: Web Analytics (gratis, tanpa cookie):** Pages project → **Metrics → Web Analytics → Enable**. Cloudflare menyisipkan skrip otomatis; tidak perlu mengubah kode.

**Opsional: custom domain nanti:** Pages project → **Custom domains → Set up a custom domain** → masukkan domain (mis. `cutlesshairstudio.id`) → ikuti instruksi DNS (paling mudah bila DNS domain dikelola Cloudflare, juga gratis). Domain sendiri dibeli terpisah (biaya registrar). HTTPS otomatis.

`public/_headers` mengatur cache file statis di CDN Cloudflare.

## 5. Menambah admin

1. Admin membuat akun GitHub gratis (github.com/signup).
2. Pemilik repo: **Settings → Collaborators → Add people** → masukkan username/email admin.
3. Admin menerima undangan (email dari GitHub).
4. Admin buka **[app.pagescms.org](https://app.pagescms.org)** → **Sign in with GitHub** → pilih repo `cutlesshairstudio` → branch `main`.
5. Panduan non-teknis: [`docs/panduan-admin.md`](docs/panduan-admin.md).

### Keterbatasan hak akses (dibanding Strapi)

Pages CMS mengikuti izin GitHub: siapa pun yang bisa menulis ke repo bisa mengedit **semua** konten. Tidak ada pembagian per menu seperti Owner/Staff di Strapi.

| Peran | Saran pengaturan |
|---|---|
| **Owner** | Pemilik/admin repo GitHub (bisa mengundang/mencabut admin, mengatur Cloudflare) |
| **Staff** | Kolaborator biasa (Write). Disepakati hanya mengubah Harga, Galeri, Pengumuman |

Pengamannya: **setiap perubahan tercatat sebagai commit** (siapa, kapan, apa) dan bisa di-rollback; validasi build menolak data rusak.
Bila butuh kontrol lebih ketat (gratis): aktifkan **branch protection** pada `main` dan minta Staff bekerja di branch lain + pull request yang disetujui Owner. Konsekuensinya, perubahan Staff baru tayang setelah disetujui.

## 6. Rollback konten

Semua perubahan dari Pages CMS adalah commit Git:

- **Lihat riwayat:** GitHub → repo → **Commits** (atau buka file, mis. `src/content/pricing.json` → **History**). Tiap commit menunjukkan siapa mengubah apa.
- **Batalkan satu perubahan:** buka commit → **⋯ → Revert** (atau `git revert <sha>` lalu push). Cloudflare otomatis deploy ulang.
- **Kembali ke versi lama satu file:** buka file di commit lama → salin isinya → edit file sekarang → commit.
- **Darurat (situs rusak):** Cloudflare Pages → **Deployments** → pilih deploy lama yang baik → **Rollback to this deployment** (instan, tanpa build).

## 7. Arsitektur

```
Admin ─▶ Pages CMS ─commit─▶ GitHub (src/content/*.json, public/uploads/*)
                                 │                │
                                 │                └─▶ GitHub Actions: kompres gambar → commit WebP
                                 ▼
                       Cloudflare Pages: npm run build
                       (optimasi gambar → tsc → validasi Zod → vite build) ─▶ CDN *.pages.dev
                                 ▼
             Browser: src/lib/content.ts (data JSON ter-bundle; filter tanggal WIB saat runtime)
```

Kredit template Colorlib di footer wajib dipertahankan (lisensi CC BY 3.0). `brber-master/` adalah arsip template HTML asal.

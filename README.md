# Cutless Hair Studio, website multi-cabang (biaya Rp0)

Website Vite + React 18 + TypeScript + CSS Modules untuk beberapa cabang (saat ini Bogor & Cibubur). Konten yang sering berubah dikelola lewat **[Pages CMS](https://pagescms.org)**, CMS berbasis Git yang menyimpan konten sebagai file JSON di repo ini. Tanpa server/database: booking & pesan produk lewat WhatsApp cabang (lihat §13).

| Kebutuhan | Layanan | Biaya |
|---|---|---|
| Kode & konten | GitHub (repo ini) | Gratis |
| Panel admin | Pages CMS (app.pagescms.org) | Gratis |
| Hosting + CDN + HTTPS | Cloudflare Workers, static assets (`*.workers.dev`) | Gratis |
| Kompres gambar & sinkron dropdown CMS | GitHub Actions | Gratis (lihat kuota di bawah) |
| Peta, booking, lokasi terdekat | Google Maps embed, link `wa.me`, Geolocation API browser | Gratis |

| Environment | Branch | URL |
|---|---|---|
| **Produksi** | `main` | https://cutlesshairstudio.adi-yansyaaah.workers.dev |
| **Staging** (noindex) | `staging` | https://cutlesshairstudio-staging.adi-yansyaaah.workers.dev |
| Lokal | apa saja | http://localhost:5173 (`npm run dev`) · http://localhost:8787 (`npm run preview:worker`) |

Alur kerja **feature → staging → main**, sinkron konten main → staging, dan checklist rilis: **[CONTRIBUTING.md](CONTRIBUTING.md)**.

> Versi lama dengan Strapi diarsipkan di branch [`archive/strapi`](../../tree/archive/strapi).

---

## 1. Menjalankan lokal

Kebutuhan: Node.js 20.19+ (Cloudflare & CI memakai 22, lihat `.node-version`). Variabel environment sudah ada di `.env.development` / `.env.staging` / `.env.production` (tanpa rahasia, lihat `.env.example`).

```bash
npm install
npm run dev              # http://localhost:5173, badge DEV
npm run dev:sync         # dev + tarik perubahan Pages CMS dari branch staging tiap 15 detik
npm run preview:worker   # build staging + Worker lokal (wrangler dev) di http://localhost:8787
```

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server (mode development). Konten tidak valid tampil sebagai overlay error di browser |
| `npm run dev:sync` | Hanya di branch `staging` tanpa perubahan lokal: `git fetch` + `git merge --ff-only origin/staging` setiap 15 detik sambil menjalankan Vite. Edit di Pages CMS (branch staging) tampil di localhost dalam ±15 detik. Tidak pernah menimpa perubahan lokal |
| `npm run preview:worker` | Menguji Worker sungguhan: redirect `/cabang/x` → `/cabang/x/`, halaman cabang prerender, `/produk/`, `_headers`, halaman 404 |
| `npm run build` | Build **produksi**. Gagal bila konten tidak valid atau belum siap tayang (lihat §2 Aturan) |
| `npm run build:staging` | Build **staging**: siteUrl staging, noindex, badge STAGING; masalah siap tayang hanya peringatan |
| `npm run check:content` | Validasi konten tanpa build (dipakai CI). `CONTENT_CHECK=warn` = longgar |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| `npm run optimize-images` | Kompres gambar baru di `public/uploads/` ke WebP & perbarui path di JSON |
| `npm run sync-cms` | Menyalin daftar cabang dari `branches.json` ke dropdown cabang di `.pages.yml` |

Opsional: `VITE_CONTENT_DELAY=1500 npm run dev` untuk mensimulasikan loading.

## 2. Struktur konten

```
.pages.yml                  konfigurasi panel admin Pages CMS (label & bantuan bahasa Indonesia)
src/content/
  branches.json             Cabang              ← diedit lewat Pages CMS
  pricing.json              Daftar Harga        ← Pages CMS (harga dasar + harga khusus cabang)
  barbers.json              Barber              ← Pages CMS (wajib punya cabang)
  gallery.json              Galeri              ← Pages CMS
  promos.json               Promo               ← Pages CMS (bisa khusus cabang)
  announcements.json        Pengumuman          ← Pages CMS (bisa khusus cabang)
  testimonials.json         Testimoni           ← Pages CMS
  products.json             Produk              ← Pages CMS
  settings.json             Pengaturan Situs    ← Pages CMS (data merek saja)
  hero.json                 Hero                ← Pages CMS (teks, label tombol, foto desktop/HP, teks berjalan)
  about.json                Tentang Kami        ← Pages CMS (teks, poin nilai, slideshow 1–8 foto, jeda, efek)
  studio.json               Kartu Studio        ← Pages CMS (foto opsional + tagline)
  cta.json                  CTA Penutup         ← Pages CMS (teks, label tombol, foto latar opsional)
  schema.ts                 skema Zod semua file di atas + cek relasi & siap tayang (acuan tunggal)
  *.ts                      teks statis: layanan, label UI, SEO, judul section, label statistik
public/uploads/
  branches/  barbers/  gallery/  promos/  products/  site/  hero/  about/  studio/  cta/  partner-logos/  shoe-care/    gambar dari Pages CMS (WebP)
src/lib/content.ts          lapisan data: getBranches(), getBranchBySlug(), getBarbers(slug?), getPricing(slug?), ...
src/lib/contentTransforms.ts  filter isActive, urut order, harga per cabang, gabung dengan teks statis
src/lib/BranchContext.tsx   cabang pilihan pengunjung (localStorage) + pemilih cabang
src/lib/branchHours.ts      status "Buka hari ini / Tutup / Buka besok" di zona waktu cabang
scripts/vite-content-plugin.ts  validasi konten, ukuran gambar, isi meta HTML, sitemap/robots, prerender /cabang/
scripts/sync-pages-config.mjs   sinkron dropdown cabang di .pages.yml
scripts/optimize-images.mjs     kompres gambar (sharp)
```

### Skema

| File | Field |
|---|---|
| `branches.json` | `slug` (huruf kecil-strip, unik), `name`, `city`, `province`, `address`, `googleMapsUrl`, `latitude`, `longitude`, `whatsappNumber` (wajib, `62xxxx`), `timezone` (Asia/Jakarta \| Asia/Makassar \| Asia/Jayapura), `openingHours[]` (`day`, `openTime`, `closeTime`, `isClosed`), `status` (Aktif \| Segera Dibuka \| Tutup Sementara), `photo`, `order` |
| `pricing.json` | `name`, `category` (Haircut \| Shaving \| Coloring \| Treatment \| Kids \| Paket), `price` (harga dasar, integer Rupiah), `priceFrom`, `description`, `badge`, `branchPrices[]` (`branchSlug`, `price`), `order`, `isActive` |
| `barbers.json` | `name`, `role`, `photo`, `branchSlug` (wajib), `specialty`, `whatsappNumber` (opsional, fallback ke WA cabang), `instagram`, `order`, `isActive` |
| `gallery.json` | `image`, `altText`, `styleCategory`, `caption`, `order`, `isActive` |
| `promos.json` | `title`, `description`, `image`, `ctaLabel`, `waMessage`, `startDate`, `endDate`, `branchSlugs[]` (kosong = semua cabang), `isActive` |
| `announcements.json` | `message` (maks. 160), `type` (Info \| Tutup \| Jam Khusus), `startDate`, `endDate`, `branchSlugs[]` (kosong = semua cabang), `isActive` |
| `testimonials.json` | `author`, `rating` (1–5), `text`, `date`, `source` (Google \| Instagram \| TikTok \| Langsung), `order`, `isActive` |
| `products.json` | `name`, `category`, `price`, `compareAtPrice`, `size`, `description`, `image`, `badge`, `inStock`, `shopeeUrl`, `tokopediaUrl`, `order`, `isActive` |
| `settings.json` | `logo`, `siteName`, `siteUrl`, `mainWhatsappNumber` (pusat), `defaultWaMessage`, `instagramUrl`, `tiktokUrl`, `footerText`, `stats` (`customers`, `foundedYear`, `rating`, `reviewCount`, `reviewsUrl` + toggle `show*` masing-masing), `showTestimonials`, `showProducts`, `showBeforeAfter` |

Jam buka dan alamat **hanya** ada di data cabang. `settings.json` berisi data merek.

### Aturan

- **Validasi saat build (Zod).** JSON yang salah (harga bukan angka, nomor WA bukan `62…`, tanggal selesai sebelum mulai, gambar tidak ada, dll.) membuat build **gagal**:
  ```
  ✗ Konten tidak valid (1 masalah). Perbaiki lewat Pages CMS atau file di src/content/:
    • pricing.json: entri #1 ("Signature Haircut") → price: harga harus angka
  ```
  Cloudflare tetap menayangkan versi terakhir yang berhasil, jadi kesalahan input tidak pernah tayang.
- **Relasi.** Slug cabang yang tidak dikenal di `barbers.branchSlug`, `pricing.branchPrices`, `promos/announcements.branchSlugs`, atau slug cabang ganda → build gagal.
- **Siap tayang.** Build **produksi** dan CI untuk PR ke `main` juga gagal bila konten yang tayang masih berisi nomor contoh `6281234567890`, kata `TODO` atau `contoh`; bila ada cabang **Aktif** tanpa nomor WA, jam buka, atau alamat; bila tidak ada satu pun cabang Aktif; bila toggle section aktif tetapi datanya kosong; atau bila angka statistik ditampilkan tetapi kosong. (`isActive: false` tidak ikut dicek.) Di development/staging masalah ini hanya peringatan dan tampil di badge DEV/STAGING (klik untuk melihat daftarnya).
- Cabang **Segera Dibuka** / **Tutup Sementara** tetap tampil dengan badge, tetapi tidak bisa dipilih untuk booking.
- `isActive: false` disembunyikan; urutan memakai `order` (kecil → besar).
- **Tanggal promo & pengumuman** dibaca sebagai **WIB** dan difilter **di browser**, jadi muncul/hilang tepat waktu tanpa build ulang. Hanya-tanggal sebagai tanggal selesai berarti sampai 23:59:59 WIB.
- Pengumuman **Tutup** / **Jam Khusus** yang sedang berlaku untuk suatu cabang mengalahkan jadwal jam buka cabang itu.

### Dropdown cabang di Pages CMS

Pages CMS belum bisa membuat dropdown dari isi file lain, jadi daftar cabang disalin ke `.pages.yml` oleh `npm run sync-cms`. Workflow **Sinkron konten** menjalankannya otomatis setiap kali `src/content/*.json` berubah. Setelah menambah cabang, tunggu ±1 menit lalu refresh Pages CMS agar cabang baru muncul di pilihan Barber/Harga/Promo/Pengumuman.

## 3. Multi-cabang

- **Cabang pilihan pengunjung** disimpan di `localStorage` (`cutless:branch`). Bila penyimpanan diblokir, situs tetap jalan dan pengunjung cukup memilih ulang.
- **Pemilih cabang** (kota → cabang) ada di navbar, hero, section Lokasi, dan muncul otomatis saat tombol booking diklik sebelum cabang dipilih. Tombol **Cabang terdekat** memakai Geolocation hanya setelah pengunjung memberi izin. Posisi tidak dikirim ke mana pun; jarak dihitung di browser. Tombol ini muncul bila ada ≥2 cabang yang punya latitude/longitude.
- **Pesan booking:** `Halo Cutless Hair Studio cabang [nama], saya mau booking [layanan] untuk [hari/jam].` dikirim ke WA cabang (atau WA barber bila diisi).
- **Harga:** harga dasar berlaku di semua cabang, kecuali ada **Harga khusus cabang**. Sebelum cabang dipilih, harga yang berbeda antarcabang tampil sebagai "mulai" harga terendah. Daftar Harga: 3 kategori aktif (Haircut, Special Treatment, Woman Haircut & Treatment), harga tampil format "K" (100000 → 100K, `formatThousandsK`) + label "Start from". Kartu Layanan (`src/content/services.json`, Pages CMS → **Kartu Layanan**) deskriptif tanpa harga; kategori harga opsional hanya untuk tautan "Lihat harga". Meta description beranda & halaman cabang dibangun dari kategori Daftar Harga yang aktif (`src/content/serviceSeo.ts`, maks. 160 karakter).
- **Statistik:** jumlah cabang & hairstylist dihitung otomatis; angka lain dari Pengaturan Situs, masing-masing dengan toggle.

## 4. Gambar

- Upload lewat Pages CMS masuk ke `public/uploads/<jenis>/`. Lebar maks.: hero & CTA penutup 1920 px (+ versi 1280 px), galeri, promo, cabang & studio 1600 px, slideshow Tentang Kami 1200 px (+ versi HP 600 px), produk 1000 px, barber & logo 800 px.
- Versi kecil (`nama-1280.webp`, `nama-600.webp`) dibuat otomatis oleh `npm run optimize-images` dan dipakai sebagai `srcset` (`src/lib/responsiveImage.ts`). Preload foto hero di `index.html` dibuat saat build dari `hero.json`.
- **Jangan menautkan gambar langsung ke Google Drive** (lambat, bisa diblokir, dan ditolak validasi). Unduh dulu, lalu upload lewat Pages CMS atau salin ke `public/uploads/<jenis>/` dan jalankan `npm run optimize-images`.
- Workflow **`.github/workflows/optimize-images.yml`** (*Sinkron konten*) berjalan saat ada perubahan di `public/uploads/**` atau `src/content/*.json`: kompres ke **WebP**, hapus file asli, perbarui path di JSON, sinkron dropdown cabang, lalu commit.
- `npm run build` juga menjalankan optimasi (`prebuild`), jadi situs yang dideploy selalu memakai gambar teroptimasi walau workflow belum selesai.
- Ukuran asli gambar dibaca saat build (`virtual:image-meta`), sehingga tidak ada layout shift.
- Kuota GitHub Actions: repo **publik** gratis tanpa batas; repo **privat** 2.000 menit/bulan (satu run ±1 menit).

## 5. Deploy ke Cloudflare Workers (gratis)

Dua Worker terpisah dari repo yang sama (`wrangler.jsonc` → environment `staging`). URL, versi, dan pengaturan tidak tercampur.

| | Produksi | Staging |
|---|---|---|
| Worker | `cutlesshairstudio` | `cutlesshairstudio-staging` |
| Branch | `main` | `staging` |
| Build command | `npm run build` | `npm run build:staging` |
| Deploy command | `npx wrangler deploy` | `npx wrangler deploy --env staging` |
| URL | https://cutlesshairstudio.adi-yansyaaah.workers.dev | https://cutlesshairstudio-staging.adi-yansyaaah.workers.dev |

**Setup Workers Builds (sekali):**

1. **Produksi** (sudah ada): Workers & Pages → `cutlesshairstudio` → **Settings → Build**:
   - Branch control → production branch **`main`**; matikan **Builds for non-production branches** (agar push ke staging/feature tidak ikut dibuild di Worker produksi).
   - Build command `npm run build`, deploy command `npx wrangler deploy`. Environment variable **tidak perlu** (ada di `.env.production`); **jangan** isi `CONTENT_CHECK`.
2. **Staging** (baru): **Workers & Pages → Create → Import a repository** → repo `cutlesshairstudio`:
   - Project name **`cutlesshairstudio-staging`** (harus sama dengan `env.staging.name`).
   - Production branch **`staging`**, matikan builds for non-production branches.
   - Build command **`npm run build:staging`**, deploy command **`npx wrangler deploy --env staging`**.
   - **Save and Deploy**. URL: `https://cutlesshairstudio-staging.<subdomain-workers>.workers.dev`. Bila subdomain akun berbeda dari `adi-yansyaaah`, sesuaikan `VITE_SITE_URL` di `.env.staging`.
3. Setiap push/merge ke `main` → produksi, ke `staging` → staging (±1–2 menit). Build yang gagal tidak mengganti versi yang sedang tayang.

**Domain produksi:** ubah **Pengaturan Situs → Alamat website**. Canonical, `og:url`, `og:image`, `twitter:image`, `sitemap.xml`, `robots.txt`, dan JSON-LD dibuat dari kolom ini saat build produksi (`.env.production` → `VITE_SITE_URL` kosong). Domain sendiri: Worker → **Settings → Domains & Routes → Add → Custom domain**.

**Staging tidak terindeks:** `robots.txt` → `Disallow: /`, `<meta name="robots" content="noindex, nofollow">`, dan header `X-Robots-Tag: noindex, nofollow` dari Worker (`dist/_headers` versi staging). Judul tab diawali `[STAGING]`.

**Opsional: kunci staging dengan Cloudflare Access** (Zero Trust, gratis s.d. 50 pengguna): Worker staging → **Settings → Domains & Routes** → pada baris `workers.dev` klik **Enable Cloudflare Access** → **Manage Cloudflare Access** → policy *Allow* dengan *Emails* = email tim → metode login **One-time PIN** (kode dikirim ke email). Cloudflare meminta login sebelum halaman staging tampil. Produksi tidak terpengaruh.

**Opsional: Web Analytics (gratis, tanpa cookie), hanya produksi:** Cloudflare → **Analytics & Logs → Web Analytics → Add a site** → salin token → isi `VITE_CF_ANALYTICS_TOKEN` di `.env.production` → commit lewat alur staging → main. Skrip hanya disisipkan pada build produksi.

`public/_headers` mengatur cache file statis di CDN Cloudflare.

**Deploy lewat GitHub Actions (alternatif, bila tidak memakai Workers Builds):** buat API token Cloudflare (template *Edit Cloudflare Workers*), simpan di **GitHub → Settings → Secrets and variables → Actions** sebagai `CLOUDFLARE_API_TOKEN` (+ `CLOUDFLARE_ACCOUNT_ID`), lalu jalankan `npm run build:staging && npx wrangler deploy --env staging` di workflow. Repo ini memakai Workers Builds, jadi tidak ada token yang perlu disimpan.

## 6. Menambah admin

**Staf (disarankan): collaborator Pages CMS, tanpa akun GitHub**
1. Pemilik login di **[app.pagescms.org](https://app.pagescms.org)** (Sign in with GitHub) → repo `cutlesshairstudio` → menu **Collaborators** → undang email staf.
2. Staf login dengan **Continue with email** (kode 6 digit lewat email, berlaku 5 menit) → branch `main`.
3. Collaborator bisa mengedit konten & media, tetapi tidak bisa mengubah `.pages.yml` atau mengelola collaborator. Nama & email pengedit tercatat di commit (`settings.commit.identity: user`).
4. Sekali saja: tambahkan aplikasi **Pages CMS** ke *Bypass list* ruleset `main` (lihat `CONTRIBUTING.md` → Branch protection), agar simpanan collaborator di `main` tidak ditolak.

**Admin dengan akun GitHub** (mis. pemilik kedua): buat akun GitHub → pemilik repo **Settings → Collaborators → Add people** → terima undangan → **Sign in with GitHub** di app.pagescms.org → branch `main`.

Panduan non-teknis: [`docs/panduan-admin.md`](docs/panduan-admin.md).

### Keterbatasan hak akses

Pages CMS mengikuti izin GitHub: siapa pun yang bisa menulis ke repo bisa mengedit **semua** konten, termasuk semua cabang. Belum ada pembagian per cabang atau per menu.

| Peran | Saran pengaturan |
|---|---|
| **Owner** | Pemilik/admin repo GitHub (mengundang/mencabut admin, Cloudflare, Cabang, Pengaturan Situs) |
| **Staff** | Kolaborator biasa (Write). Disepakati hanya mengubah Harga, Galeri, Pengumuman cabangnya sendiri |

Pengamannya: **setiap perubahan tercatat sebagai commit** dan bisa di-rollback; validasi build menolak data rusak. Kontrol lebih ketat (gratis): **branch protection** pada `main` + pull request yang disetujui Owner.

## 7. Rollback konten

(Untuk perubahan kode, pakai alur di [CONTRIBUTING.md](CONTRIBUTING.md); konten produksi tetap bisa di-rollback seperti di bawah.)


- **Lihat riwayat:** GitHub → repo → **Commits** (atau buka file → **History**).
- **Batalkan satu perubahan:** buka commit → **⋯ → Revert** (atau `git revert <sha>` lalu push). Cloudflare otomatis deploy ulang.
- **Darurat (situs rusak):** Cloudflare → Worker → **Deployments** → pilih versi lama → **Rollback** (instan, tanpa build).

## 8. Halaman

| URL | Isi | Entry |
|---|---|---|
| `/` | Landing page | `index.html` → `src/main.tsx` → `App.tsx` |
| `/cabang/` | Daftar semua cabang | `cabang/index.html` → `src/cabang.tsx` |
| `/cabang/<slug>/` | Halaman cabang: alamat, peta, status hari ini, jam, barber, harga, promo, booking. **Diprerender** (title/meta/JSON-LD `HairSalon` unik, isi teks terbaca tanpa JavaScript) | template `cabang/index.html`, dibuat oleh `vite-content-plugin.ts` |
| `/produk/` | Semua produk (bila **Tampilkan Produk** aktif) | `produk/index.html` → `src/produk.tsx` |
| `/cuci-sepatu/` | Halaman partner cuci sepatu (Pages CMS → **Partner Cuci Sepatu**): hero, About Us, layanan tanpa harga, galeri + lightbox, catatan, lokasi cabang. **Diprerender** (title/meta/OG dari data). Mati → dihapus & `/cuci-sepatu` 301 ke beranda, tidak di sitemap | `cuci-sepatu/index.html` → `src/cuciSepatu.tsx` |
| `/sitemap.xml`, `/robots.txt` | Dibuat saat build dari `siteUrl` + daftar cabang | `vite-content-plugin.ts` |

Situs statis multi-halaman (Vite multi-page, tanpa router). Kerangka bersama (navbar, footer, pemilih cabang, tombol WA) ada di `src/components/layout/SiteShell.tsx`. Section Testimoni, Produk (+ menu), dan Before/After hanya tampil bila toggle-nya aktif. Pita **Logo Partner** (sebelum CTA penutup, `src/content/partners.json`) hanya tampil bila diaktifkan dan ada logo yang ditampilkan. `/partner` (dicabut, arsip `archive/partner-page` / tag `partner-page-v1`) diarahkan ke beranda. **Cuci Sepatu**: halaman `/cuci-sepatu/` + kartu teaser setelah Daftar Harga (beranda & halaman cabang partner); anchor lama `#cuci-sepatu` diarahkan ke halaman.

## 9. Kesiapan migrasi ke database

Struktur JSON sudah 1:1 dengan tabel di bawah. Komponen hanya membaca lewat `src/lib/content.ts` (`getBranches()`, `getBranchBySlug()`, `getBarbers(branchSlug?)`, `getPricing(branchSlug?)`, …), jadi bila suatu saat pindah ke database (mis. Cloudflare D1/Supabase), cukup ganti isi fungsi-fungsi itu; komponen tidak berubah.

```sql
CREATE TABLE branches (
  slug            TEXT PRIMARY KEY,                 -- 'bogor-bantarjati'
  name            TEXT NOT NULL,
  city            TEXT NOT NULL,
  province        TEXT NOT NULL,
  address         TEXT,
  google_maps_url TEXT,
  latitude        NUMERIC(9,6),
  longitude       NUMERIC(9,6),
  whatsapp_number TEXT NOT NULL CHECK (whatsapp_number ~ '^62[0-9]{8,13}$'),
  timezone        TEXT NOT NULL DEFAULT 'Asia/Jakarta'
                  CHECK (timezone IN ('Asia/Jakarta','Asia/Makassar','Asia/Jayapura')),
  status          TEXT NOT NULL DEFAULT 'Aktif'
                  CHECK (status IN ('Aktif','Segera Dibuka','Tutup Sementara')),
  photo           TEXT,
  sort_order      INT  NOT NULL DEFAULT 0
);

CREATE TABLE branch_opening_hours (
  branch_slug TEXT NOT NULL REFERENCES branches(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  day         TEXT NOT NULL CHECK (day IN ('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu')),
  open_time   TIME,
  close_time  TIME,
  is_closed   BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (branch_slug, day)
);

CREATE TABLE barbers (
  id              SERIAL PRIMARY KEY,
  branch_slug     TEXT NOT NULL REFERENCES branches(slug) ON UPDATE CASCADE,
  name            TEXT NOT NULL,
  role            TEXT,
  photo           TEXT,
  specialty       TEXT,
  whatsapp_number TEXT,                              -- NULL → pakai WA cabang
  instagram       TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE pricing_items (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,                         -- Haircut | Shaving | Coloring | Treatment | Kids | Paket
  price       INT  NOT NULL CHECK (price >= 0),      -- harga dasar
  price_from  BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  badge       TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE branch_prices (                         -- harga khusus cabang (override harga dasar)
  pricing_item_id INT  NOT NULL REFERENCES pricing_items(id) ON DELETE CASCADE,
  branch_slug     TEXT NOT NULL REFERENCES branches(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  price           INT  NOT NULL CHECK (price >= 0),
  PRIMARY KEY (pricing_item_id, branch_slug)
);

-- Promo & pengumuman: tabel penghubung; tidak ada baris = berlaku di semua cabang
CREATE TABLE promo_branches        (promo_id INT REFERENCES promos(id) ON DELETE CASCADE,
                                    branch_slug TEXT REFERENCES branches(slug) ON DELETE CASCADE,
                                    PRIMARY KEY (promo_id, branch_slug));
CREATE TABLE announcement_branches (announcement_id INT REFERENCES announcements(id) ON DELETE CASCADE,
                                    branch_slug TEXT REFERENCES branches(slug) ON DELETE CASCADE,
                                    PRIMARY KEY (announcement_id, branch_slug));
```

Harga efektif satu layanan di satu cabang: `COALESCE(bp.price, pi.price)` dari `pricing_items pi LEFT JOIN branch_prices bp ON bp.pricing_item_id = pi.id AND bp.branch_slug = :slug`.

## 10. Checklist konten sebelum launch

`npm run build` menolak deploy sampai butir bertanda ⛔ selesai.

- [ ] ⛔ **Pengaturan Situs → Nomor WhatsApp pusat**: ganti `6281234567890` dengan nomor asli
- [ ] ⛔ **Cabang Bogor Bantarjati → Nomor WhatsApp cabang**: ganti `6281234567890`
- [ ] ⛔ **Cabang Cibubur**: isi provinsi, alamat lengkap, nomor WA, jam buka (atau ubah status ke *Segera Dibuka* bila belum beroperasi)
- [ ] Latitude/longitude kedua cabang (untuk tombol "Cabang terdekat" dan peta yang lebih tepat): Google Maps → klik kanan titik lokasi → klik angka koordinat untuk menyalin
- [ ] Link Google Maps & foto cabang Cibubur
- [ ] Tiap barber: cabang yang benar, foto asli; barber yang tidak bekerja lagi dinonaktifkan
- [ ] Daftar Harga: cek harga dasar; isi **Harga khusus cabang** bila Cibubur berbeda
- [ ] **Alamat website** sudah domain final (bila memakai domain sendiri)
- [ ] Statistik: isi angka asli lalu nyalakan toggle yang ingin ditampilkan (rating/ulasan sesuai Google)
- [ ] Testimoni asli (minimal 3) → nyalakan **Tampilkan section Testimoni**
- [ ] Produk dengan harga & foto asli → nyalakan **Tampilkan Produk**
- [ ] ⛔ **Data demo** dihapus/dimatikan: Partner Cuci Sepatu (*Cuci Sepatu Bogor (Demo)*) & Logo Partner (*Partner Demo A–D*). Build produksi gagal selama data demo tayang (panduan admin §3g)
- [ ] Coba booking dari HP untuk tiap cabang: pesan WA menyebut cabang yang benar dan masuk ke nomor yang benar
- [ ] Buka `/cabang/<slug>/` tiap cabang, `/sitemap.xml`, lalu daftarkan sitemap di Google Search Console (gratis)

## 11. Alur kerja & staging (ringkas)

Detail lengkap: **[CONTRIBUTING.md](CONTRIBUTING.md)**.

1. **Fitur:** `feature/<nama>` dari `staging` → `npm run dev` → PR ke `staging` (CI: typecheck, lint, validasi konten, build).
2. **Uji:** merge ke `staging` → otomatis tayang di URL staging (badge STAGING, tidak diindeks).
3. **Rilis:** PR `staging → main`. CI **wajib lolos** (konten ketat + build produksi), lalu merge → produksi.
4. **Sinkron balik:** workflow harian membuka PR `main → staging` berisi edit konten pemilik; bentrok → label `conflict`.

**Menguji konten lewat Pages CMS di staging:** app.pagescms.org → repo → pilih branch **staging** → edit → Save. Hasilnya tayang di URL staging ±2 menit, atau di laptop dalam ±15 detik dengan `npm run dev:sync` (branch lokal `staging`). Pemilik tetap di branch **main**.

**Checklist sebelum merge ke main:**
- [ ] Badge STAGING menunjukkan 0 konten belum siap tayang
- [ ] Tampilan mobile 360 px rapi (tanpa scroll horizontal / elemen bertumpuk)
- [ ] Semua link WhatsApp mengarah ke nomor cabang yang benar (tiap cabang, tiap tombol booking)
- [ ] `/cabang/<slug>/` tiap cabang bisa di-refresh di URL staging
- [ ] Transisi aman dengan `prefers-reduced-motion: reduce`
- [ ] Lighthouse mobile ≥ 85
- [ ] PR sinkron `main → staging` sudah di-merge, CI hijau

## 12. Animasi & transisi

Library: **Motion for React** (`motion`, LazyMotion + `domAnimation`) dan **Lenis** (smooth scroll, desktop saja, dimuat dinamis). Library dipisah ke chunk sendiri (`vendor-motion` 32,7 KB gzip, `vendor-react` 44,6 KB, Lenis 7,7 KB hanya di desktop) → tambahan JS animasi ±40 KB gzip. Swiper (±30 KB gzip) hanya dimuat bila section Testimoni aktif.

- **Pengaturan rasa animasi** (durasi, easing, stagger, jarak, intensitas parallax, skala kartu, kecepatan marquee): `src/styles/motion.ts`.
- **Komponen** di `src/components/motion/`: `Reveal`, `TextReveal`, `Parallax`, `Marquee`, `CountUp`, `ExpandingCard`, `PageTransition`, `Preloader`, `ToneShift`, `MotionProvider` (+ `smoothScroll.ts`, `useScrollProgress.ts`). Semua teks & gambar tetap dari `src/lib/content.ts`.

| Pola | Dipakai di |
|---|---|
| Preloader: logo naik dari balik garis + penghitung 0–100% → tirai membuka (≤ 1,5 dtk, sekali per sesi) | Semua halaman (kunjungan pertama). Toggle & video opsional: Pengaturan Situs |
| Judul per baris dari balik garis, subjudul & tombol menyusul, foto zoom 1.1 → 1 + parallax, indikator "Scroll" | Hero |
| Editorial: foto portrait + judul besar menumpuk, parallax beda kecepatan, paragraf muncul bertahap | Tentang Kami |
| Kartu foto membesar jadi lebar penuh (radius → 0) + tagline crossfade, scroll-linked | Section `#studio` (foto = foto cabang pertama di CMS) |
| Chip cabang + panel info berganti (fade + geser), kolom foto hairstylist berjalan berlawanan arah (HP: satu baris) | Lokasi |
| Muncul saat di-scroll (Reveal) | HANYA judul section, paragraf Tentang Kami, kartu galeri. Harga, info cabang, jam buka, tombol booking langsung tampil |
| Hover kartu terangkat + ikon membesar | Layanan, Harga |
| Hitung naik sekali (nilai final tetap untuk screen reader) | Statistik Tentang, rating Testimoni |
| Warna latar berpindah halus gelap ↔ terang (CSS scroll-driven) | Antar-section |
| Navbar ikut warna section di bawahnya, sembunyi saat scroll turun & muncul saat naik | Semua halaman |
| Tirai antarhalaman (≤ 400 ms) | Beranda ↔ /cabang/… ↔ /produk/ |
| Tombol isi warna saat hover & mengecil saat ditekan; tombol WA berdenyut sekali | Semua tombol |

**Reveal:** satu IntersectionObserver bersama, muncul saat tepi atas elemen melewati garis 10% dari bawah layar (threshold 0, aman untuk elemen lebih tinggi dari layar). Elemen yang sudah terlewati (scroll cepat, buka di tengah halaman) dan semua yang muncul ±1,5 detik setelah klik menu/anchor langsung tampil tanpa animasi.

**Marquee** (strip teks hero, foto hairstylist) dijeda saat di luar layar dan saat "kurangi gerakan".

**Aturan:** hanya `transform` & `opacity`; animasi masuk viewport sekali (`once`); scroll snap `y proximity` hanya di hero, Tentang Kami, dan kartu studio; `prefers-reduced-motion` → tanpa preloader, parallax, marquee, scroll-linked, dan tirai (fade sederhana saja).

**Performa (HP):** section di bawah hero dirender bertahap setelah hero tampil (`components/ui/Deferred.tsx`); semua `Reveal` memakai satu IntersectionObserver bersama + transisi CSS; parallax/kartu membesar memakai satu sumber scroll bersama (`useScrollProgress`) karena `useScroll({ target })` membuat ViewTimeline per elemen yang memaksa layout ulang. Google Fonts dimuat tanpa memblokir render; CSS digabung jadi satu file.

**Aset yang perlu disiapkan:** logo SVG (untuk animasi garis/stroke preloader), foto portrait studio resolusi tinggi (≥ 1200 × 1500 px) untuk Tentang Kami, foto lanskap studio (≥ 1920 px) untuk kartu membesar (upload sebagai foto cabang), dan opsional video preloader (MP4/WebM tanpa suara, ≤ 500 KB, ±1,5 detik).

## 13. Booking lewat WhatsApp (fitur online diarsipkan)

Keputusan klien (19 Okt 2026): **booking lewat WhatsApp cabang**, katalog produk dengan **pesan via WhatsApp** (tanpa keranjang/checkout/pembayaran), **tanpa akun pelanggan, login, atau database**. Staging menjadi dasar produksi.

- Semua tombol booking & pesan (hero, navbar *Booking Sekarang*, kartu layanan/harga/paket, hairstylist, `/cabang/<slug>/`, CTA penutup, tombol melayang, produk) memakai `useBooking()` (`src/lib/useBooking.ts`): WhatsApp **cabang terpilih** dengan pesan yang menyebut cabang (+ layanan, paket, hairstylist, atau produk & ukuran). Belum memilih cabang → pemilih cabang dulu. Footer tetap ke WhatsApp **pusat** (pertanyaan umum).
- Worker staging hanya melayani file statis (`worker/index.ts` meneruskan ke aset; tanpa D1, vars, secrets, Cron). `public/_redirects`: `/booking*` & `/shop*` (pernah ditautkan dari landing page) → beranda; rute lain yang dicabut (`/masuk`, `/profil`, `/pesanan`, `/admin`, `/kebijakan-privasi`, `/api/*`) → 404.
- Data cabang, hairstylist, layanan & harga kembali di `src/content/*.json` (Pages CMS: **Cabang, Daftar Harga, Barber**), diekspor dari D1 staging 19 Okt 2026.
- **Arsip:** booking online, akun pelanggan, dashboard `/admin`, Cutless Stamp, dan Cutless Shop (Worker Hono + D1, beserta tes & dokumentasinya) disimpan utuh di branch **`archive/booking-online-dan-toko`** (dari `staging` `c8d086a`). README branch itu menjelaskan cara mengaktifkannya kembali.

## 14. Arsitektur

```
Admin ─▶ Pages CMS ─commit─▶ GitHub (src/content/*.json, public/uploads/*)
                                 │                │
                                 │                └─▶ GitHub Actions "Sinkron konten":
                                 │                     kompres gambar + dropdown cabang → commit
                                 ▼
     Cloudflare Workers Builds: main → npm run build → Worker cutlesshairstudio (produksi)
                                staging → npm run build:staging → Worker cutlesshairstudio-staging
     (optimasi gambar → tsc → validasi Zod + relasi + siap tayang → vite build
      → sitemap/robots → prerender /cabang/<slug>/) ─▶ CDN *.workers.dev
                                 ▼
   Browser: src/lib/content.ts (JSON ter-bundle) + cabang pilihan (localStorage)
            + filter tanggal WIB & status buka per zona waktu cabang saat runtime
```

Kredit template Colorlib di footer wajib dipertahankan (lisensi CC BY 3.0); teksnya di `src/content/site.ts` (`footer.credit`). Template HTML asal (dulu `brber-master/`) sudah dihapus dari repo dan diarsipkan di tag `archive/brber-template`: `git checkout archive/brber-template -- brber-master` untuk melihatnya lagi.

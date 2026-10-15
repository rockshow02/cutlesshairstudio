# Cutless Hair Studio, website multi-cabang (biaya Rp0)

Website Vite + React 18 + TypeScript + CSS Modules untuk beberapa cabang (saat ini Bogor & Cibubur). Konten yang sering berubah dikelola lewat **[Pages CMS](https://pagescms.org)**, CMS berbasis Git yang menyimpan konten sebagai file JSON di repo ini. Tidak ada server, database, atau API.

| Kebutuhan | Layanan | Biaya |
|---|---|---|
| Kode & konten | GitHub (repo ini) | Gratis |
| Panel admin | Pages CMS (app.pagescms.org) | Gratis |
| Hosting + CDN + HTTPS | Cloudflare Workers, static assets (`*.workers.dev`) | Gratis |
| Kompres gambar & sinkron dropdown CMS | GitHub Actions | Gratis (lihat kuota di bawah) |
| Peta, booking, lokasi terdekat | Google Maps embed, link `wa.me`, Geolocation API browser | Gratis |

> Versi lama dengan Strapi diarsipkan di branch [`archive/strapi`](../../tree/archive/strapi).

---

## 1. Menjalankan lokal

Kebutuhan: Node.js 20.19+ (disarankan 22, lihat `.node-version`). **Tidak ada variabel env yang wajib.**

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # optimasi gambar → type-check → validasi konten → build + prerender ke dist/
npm run preview    # cek hasil build (http://localhost:4173)
```

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server. Konten tidak valid ditampilkan sebagai overlay error |
| `npm run build` | Build produksi. **Gagal** bila konten tidak sesuai skema atau belum siap tayang (lihat §2 Aturan) |
| `CONTENT_CHECK=warn npm run build` | Khusus uji lokal dengan data belum lengkap: masalah "siap tayang" hanya diberi peringatan. **Jangan dipakai di Cloudflare** |
| `npm run optimize-images` | Kompres gambar baru di `public/uploads/` ke WebP & perbarui path di JSON |
| `npm run sync-cms` | Menyalin daftar cabang dari `branches.json` ke dropdown cabang di `.pages.yml` |
| `npm run typecheck` | Cek TypeScript |

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
  schema.ts                 skema Zod semua file di atas + cek relasi & siap tayang (acuan tunggal)
  *.ts                      teks statis: hero, about, layanan, label UI, SEO, judul section
public/uploads/
  branches/  barbers/  gallery/  promos/  products/  site/    gambar dari Pages CMS (WebP)
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
- **Siap tayang.** Build juga gagal bila konten yang tayang masih berisi nomor contoh `6281234567890`, kata `TODO` atau `contoh`; bila ada cabang **Aktif** tanpa nomor WA, jam buka, atau alamat; bila tidak ada satu pun cabang Aktif; bila toggle section aktif tetapi datanya kosong; atau bila angka statistik ditampilkan tetapi kosong. (`isActive: false` tidak ikut dicek.)
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
- **Harga:** harga dasar berlaku di semua cabang, kecuali ada **Harga khusus cabang**. Sebelum cabang dipilih, harga yang berbeda antarcabang tampil sebagai "mulai" harga terendah. Kartu Layanan menghitung "mulai Rp…" dari kategori harga (`pricingCategory` di `src/content/services.ts`); kategori tanpa harga tampil sebagai "Tanya harga" lewat WA.
- **Statistik:** jumlah cabang & hairstylist dihitung otomatis; angka lain dari Pengaturan Situs, masing-masing dengan toggle.

## 4. Gambar

- Upload lewat Pages CMS masuk ke `public/uploads/<jenis>/`. Lebar maks.: galeri, promo & cabang 1600 px, produk 1000 px, barber & logo 800 px.
- Workflow **`.github/workflows/optimize-images.yml`** (*Sinkron konten*) berjalan saat ada perubahan di `public/uploads/**` atau `src/content/*.json`: kompres ke **WebP**, hapus file asli, perbarui path di JSON, sinkron dropdown cabang, lalu commit.
- `npm run build` juga menjalankan optimasi (`prebuild`), jadi situs yang dideploy selalu memakai gambar teroptimasi walau workflow belum selesai.
- Ukuran asli gambar dibaca saat build (`virtual:image-meta`), sehingga tidak ada layout shift.
- Kuota GitHub Actions: repo **publik** gratis tanpa batas; repo **privat** 2.000 menit/bulan (satu run ±1 menit).

## 5. Deploy ke Cloudflare Workers (gratis)

Situs saat ini: **https://cutlesshairstudio.adi-yansyaaah.workers.dev**

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Import a repository** → pilih `cutlesshairstudio`, branch **`main`**.
2. Build command **`npm run build`**, deploy command **`npx wrangler deploy`** (bawaan). Environment variable **tidak perlu**. **Jangan** isi `CONTENT_CHECK`.
3. `wrangler.jsonc` menyajikan `dist/` sebagai static assets:
   - `auto-trailing-slash`: `/cabang/cibubur` → `dist/cabang/cibubur/index.html` (hasil prerender), aman di-refresh.
   - `404-page`: URL tidak dikenal → `dist/404.html` (bukan beranda).
4. Setiap commit ke `main`, termasuk setiap **Save** di Pages CMS, otomatis build & deploy (±1–2 menit).
5. **Domain:** cukup ubah **Pengaturan Situs → Alamat website**. Canonical, `og:url`, `og:image`, `twitter:image`, `sitemap.xml`, `robots.txt`, dan JSON-LD semuanya dibuat dari kolom ini saat build. Domain sendiri: Worker → **Settings → Domains & Routes → Add → Custom domain** (DNS di Cloudflare, gratis; domain dibeli terpisah).

`public/_headers` mengatur cache file statis di CDN Cloudflare.

## 6. Menambah admin

1. Admin membuat akun GitHub gratis (github.com/signup).
2. Pemilik repo: **Settings → Collaborators → Add people** → masukkan username/email admin.
3. Admin menerima undangan (email dari GitHub).
4. Admin buka **[app.pagescms.org](https://app.pagescms.org)** → **Sign in with GitHub** → pilih repo `cutlesshairstudio` → branch `main`.
5. Panduan non-teknis: [`docs/panduan-admin.md`](docs/panduan-admin.md).

### Keterbatasan hak akses

Pages CMS mengikuti izin GitHub: siapa pun yang bisa menulis ke repo bisa mengedit **semua** konten, termasuk semua cabang. Belum ada pembagian per cabang atau per menu.

| Peran | Saran pengaturan |
|---|---|
| **Owner** | Pemilik/admin repo GitHub (mengundang/mencabut admin, Cloudflare, Cabang, Pengaturan Situs) |
| **Staff** | Kolaborator biasa (Write). Disepakati hanya mengubah Harga, Galeri, Pengumuman cabangnya sendiri |

Pengamannya: **setiap perubahan tercatat sebagai commit** dan bisa di-rollback; validasi build menolak data rusak. Kontrol lebih ketat (gratis): **branch protection** pada `main` + pull request yang disetujui Owner.

## 7. Rollback konten

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
| `/sitemap.xml`, `/robots.txt` | Dibuat saat build dari `siteUrl` + daftar cabang | `vite-content-plugin.ts` |

Situs statis multi-halaman (Vite multi-page, tanpa router). Kerangka bersama (navbar, footer, pemilih cabang, tombol WA) ada di `src/components/layout/SiteShell.tsx`. Section Testimoni, Produk (+ menu), dan Before/After hanya tampil bila toggle-nya aktif.

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
- [ ] Coba booking dari HP untuk tiap cabang: pesan WA menyebut cabang yang benar dan masuk ke nomor yang benar
- [ ] Buka `/cabang/<slug>/` tiap cabang, `/sitemap.xml`, lalu daftarkan sitemap di Google Search Console (gratis)

## 11. Arsitektur

```
Admin ─▶ Pages CMS ─commit─▶ GitHub (src/content/*.json, public/uploads/*)
                                 │                │
                                 │                └─▶ GitHub Actions "Sinkron konten":
                                 │                     kompres gambar + dropdown cabang → commit
                                 ▼
                   Cloudflare Workers Builds: npm run build
     (optimasi gambar → tsc → validasi Zod + relasi + siap tayang → vite build
      → sitemap/robots → prerender /cabang/<slug>/) ─▶ CDN *.workers.dev
                                 ▼
   Browser: src/lib/content.ts (JSON ter-bundle) + cabang pilihan (localStorage)
            + filter tanggal WIB & status buka per zona waktu cabang saat runtime
```

Kredit template Colorlib di footer wajib dipertahankan (lisensi CC BY 3.0). `brber-master/` adalah arsip template HTML asal.

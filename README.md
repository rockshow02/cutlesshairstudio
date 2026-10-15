# Cutless Hair Studio: website + CMS

Monorepo:

| Folder | Isi |
|---|---|
| `frontend/` | Landing page: Vite + React 18 + TypeScript + CSS Modules |
| `cms/` | Headless CMS: Strapi v5 (TypeScript), SQLite lokal / PostgreSQL production |
| `docs/panduan-admin.md` | Panduan non-teknis untuk pemilik |
| `brber-master/` | Template HTML asal (arsip, tidak dipakai lagi) |

Kebutuhan: **Node.js 20.19+ atau 22.x** (Strapi 5 belum mendukung Node 23+), npm 10.

---

## 1. Menjalankan lokal

```bash
# Terminal 1: CMS
cd cms
cp .env.example .env          # lalu ganti semua secret (lihat bagian Env)
npm install
npm run develop               # http://localhost:1337/admin

# Terminal 2: Frontend
cd frontend
cp .env.example .env.local    # VITE_CMS_URL=http://localhost:1337
npm install
npm run dev                   # http://localhost:5173
```

Pertama kali membuka `http://localhost:1337/admin`, Strapi meminta membuat akun **Super Admin**. Itu akun developer/pemilik utama.

Saat start, CMS otomatis (idempoten):
- mengatur role **Public** menjadi read-only (`find`/`findOne`) untuk 6 tipe konten, dan mencabut izin tulis bila ada;
- membuat/menyinkronkan role admin **Owner** dan **Staff**;
- memasang label & bantuan field berbahasa Indonesia di panel admin.

Frontend tetap jalan **tanpa CMS**: kosongkan `VITE_CMS_URL`, atau biarkan CMS mati. Bila CMS gagal atau lebih dari 5 detik, frontend memakai data statis di `frontend/src/content/`.

## 2. Seed data awal

Mengimpor harga, barber, galeri, dan pengaturan situs dari `frontend/src/content/` (plus upload gambar dari `frontend/public/images`):

```bash
cd cms
# hentikan `npm run develop` dulu bila memakai SQLite (database dikunci)
npm run seed              # hanya membuat data yang belum ada
npm run seed -- --force   # menimpa data yang ada dengan isi file statis
```

Aman dijalankan berulang: entri dicocokkan dengan kunci alami (nama + kategori, nama barber, alt text galeri, nama file), sehingga tidak ada data ganda. Tanpa `--force`, editan pemilik di panel tidak pernah tertimpa.

## 3. Variabel environment

### `cms/.env` (contoh lengkap di `cms/.env.example`)

| Variabel | Keterangan |
|---|---|
| `HOST`, `PORT` | Default `0.0.0.0:1337` |
| `PUBLIC_URL` | URL publik CMS di production, mis. `https://cms.cutlesshairstudio.id` |
| `IS_PROXIED` | `true` bila di belakang reverse proxy (Railway/Render/Nginx) |
| `CORS_ORIGINS` | Domain frontend yang boleh memanggil API, dipisah koma |
| `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY` | **Wajib unik & rahasia.** Buat dengan `node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"` |
| `DATABASE_CLIENT` | `sqlite` (lokal) atau `postgres` (production) |
| `DATABASE_URL` atau `DATABASE_HOST/PORT/NAME/USERNAME/PASSWORD` | Koneksi Postgres; `DATABASE_SSL=true` untuk DB terkelola |
| `CLOUDINARY_NAME`, `CLOUDINARY_KEY`, `CLOUDINARY_SECRET`, `CLOUDINARY_FOLDER` | Isi → media otomatis ke Cloudinary. Kosong → disimpan lokal di `cms/public/uploads` |
| `SEED_FRONTEND_DIR` | Lokasi folder frontend untuk seed (default `../frontend`) |

### `frontend/.env.local`

| Variabel | Keterangan |
|---|---|
| `VITE_CMS_URL` | URL dasar Strapi tanpa `/api`, mis. `http://localhost:1337`. Kosong = data statis |
| `VITE_CONTENT_DELAY` | Opsional: simulasi latensi (ms) untuk menguji loading |

## 4. Akun Owner & Staff

1. Login sebagai Super Admin → **Settings → Administration Panel → Users → Invite new user**.
2. Isi nama & email, pilih role **Owner** (pemilik) atau **Staff** (karyawan).
3. Kirim link undangan yang muncul ke orang tersebut. Ia membuka link dan membuat password.

| Role | Bisa mengelola | Tidak bisa |
|---|---|---|
| **Owner** | Daftar Harga, Barber, Galeri, Promo, Pengumuman, Pengaturan Situs, Media Library | Pengaturan teknis Strapi (user, role, API) → tetap Super Admin |
| **Staff** | Daftar Harga, Galeri, Pengumuman, Media Library | Barber, Promo, Pengaturan Situs |

Hak akses role ditulis ulang dari kode setiap CMS start (`cms/src/bootstrap/admin-roles.ts`), jadi perubahan izin dilakukan di kode, bukan dicentang manual di panel.
Bahasa panel admin bisa diganti ke Bahasa Indonesia lewat **Profil → Interface language**.

## 5. Arsitektur integrasi

```
komponen React ──useContent(getX)──▶ frontend/src/lib/content.ts ──▶ lib/cms/client.ts (fetch, timeout 5 dtk)
                                          │  TanStack Query (staleTime 5 menit)        │
                                          │                                            ▼
                                          ├── lib/cms/mappers.ts ◀── JSON Strapi REST v5
                                          └── fallback: src/content/*.ts (data statis)
```

- Signature `getSite()`, `getPricing()`, `getBarbers()`, `getGallery()`, `getLocations()`, `getSocials()` **tidak berubah**. Ditambah `getPromos()` & `getAnnouncements()`.
- Query Strapi memakai `filters[isActive][$eq]=true`, `sort=order:asc`, `fields[...]`, dan `populate` hanya untuk relasi media yang dibutuhkan (tidak `populate=*`).
- Promo & Pengumuman: hanya yang **dipublikasikan** (Draft & Publish), `isActive`, dan dalam rentang tanggal. Perbandingan memakai waktu absolut (UTC), tampilan tanggal di zona **Asia/Jakarta (WIB)**.
- Tahap 1 hanya harga, barber, galeri, promo, pengumuman, pengaturan situs. Hero, about, layanan, testimoni, lokasi lain, dan SEO tetap statis di `frontend/src/content/`.

## 6. Deploy singkat

**CMS** (Railway / Render / VPS dengan Node 20/22):
1. Buat database PostgreSQL (mis. Railway Postgres, Neon, Supabase). Isi `DATABASE_CLIENT=postgres` + `DATABASE_URL` (+ `DATABASE_SSL=true` bila diminta).
2. Buat akun Cloudinary, isi `CLOUDINARY_*` (disk server cloud biasanya tidak permanen, jadi upload lokal akan hilang).
3. Isi semua secret baru (jangan pakai nilai lokal), `PUBLIC_URL`, `IS_PROXIED=true`, `CORS_ORIGINS=https://domain-frontend`.
4. Build & start: `npm ci && npm run build && npm run start`.
5. Buka `/admin`, buat Super Admin, undang Owner/Staff. Opsional: jalankan `npm run seed` sekali (dengan env production) untuk data awal.

**Frontend** (Vercel / Netlify / Cloudflare Pages):
1. Root directory `frontend`, build `npm run build`, output `dist`.
2. Env: `VITE_CMS_URL=https://cms.domain-anda`.
3. Pastikan domain frontend sudah ada di `CORS_ORIGINS` CMS.
4. Ganti domain di `frontend/index.html` (canonical, og:url, og:image) dan `frontend/src/content/site.ts` (`seo.url`).

Catatan: perubahan konten di CMS tampil di website tanpa build ulang; pengunjung melihatnya maksimal 5 menit kemudian (cache klien) atau saat memuat ulang halaman.

## 7. Perintah berguna

| Folder | Perintah | Fungsi |
|---|---|---|
| cms | `npm run develop` | Dev server + panel admin (auto-reload) |
| cms | `npm run build && npm run start` | Mode production |
| cms | `npm run seed [-- --force]` | Impor data awal |
| cms | `npm run typecheck` | Cek TypeScript (CMS + seed script) |
| frontend | `npm run dev` / `build` / `preview` / `typecheck` | Pengembangan frontend |

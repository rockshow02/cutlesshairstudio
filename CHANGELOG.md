# Catatan perubahan

Semua perubahan penting pada website Cutless Hair Studio dicatat di sini.
Format: [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/), penomoran: [Semantic Versioning](https://semver.org/lang/id/).

- **MAYOR** (2.0.0): perubahan besar yang mengubah cara kerja situs atau CMS (mis. format file konten berubah).
- **MINOR** (1.2.0): fitur baru dari `feat/*` lewat staging.
- **PATCH** (1.2.1): perbaikan kecil / hotfix tanpa fitur baru.

Edit konten lewat Pages CMS (harga, foto, FAQ, video, dst.) **tidak** dicatat di sini dan tidak menaikkan versi.
Cara menaikkan versi & merilis: [CONTRIBUTING.md → Rilis versi](CONTRIBUTING.md#3-rilis-versi-staging--main).

## [Belum dirilis]

## [1.2.0] - 2026-10-29

### Ditambahkan
- Alur rilis berversi: rilis = PR `staging` → `main` dengan versi di `package.json` dan bagian CHANGELOG ini; tag `vX.Y.Z` & GitHub Release dibuat otomatis setelah PR di-merge (`.github/workflows/release.yml`).
- Hotfix: branch `hotfix/*` dari `main` → PR langsung ke `main` (rilis PATCH).
- CI `verify` juga berjalan di setiap push ke `main` (termasuk simpanan Pages CMS) dengan ringkasan langkah perbaikan bila konten tidak valid.

### Diubah
- PR ke `main` hanya dari `staging` atau `hotfix/*`; PR dari branch lain ditolak CI dengan penjelasan alurnya. Simpanan Pages CMS langsung ke `main` tetap diizinkan.
- Sinkron `main` → `staging` berjalan di setiap push ke `main` (jadwal harian tetap sebagai cadangan): PR otomatis di-merge bila tanpa konflik dan pemeriksaan lolos; bila konflik/gagal diberi label **perlu-dicek**.
- Build produksi selalu memakai validasi konten mode ketat, walau variabel `CONTENT_CHECK=warn` terpasang di Cloudflare.

## [1.1.0] - 2026-10-27

### Ditambahkan
- FAQ di beranda dari Pages CMS (default mati) dengan JSON-LD `FAQPage`.
- Bagian Video di beranda dari Reel/postingan Instagram (facade: Instagram baru dimuat saat kartu ditekan), dikelola di Pages CMS (default mati).
- Kolom **Kode pos** cabang; alamat di JSON-LD `HairSalon` dipecah (jalan/kelurahan/kecamatan, kota, provinsi, kode pos).
- `/llms.txt`, konten statis beranda & `/cabang/` yang sama dengan teks yang terlihat pengunjung, `sameAs` cabang, `lastmod` di sitemap.
- Favicon & logo `Organization` untuk hasil pencarian Google.

### Diubah
- `/produk/` mengikuti **Tampilkan Produk** saat build (mati → 301 ke beranda & keluar dari sitemap); alamat `workers.dev` produksi dimatikan.
- Link Instagram di CMS menerima bentuk tanpa `www.`, `m.instagram.com`, dan `/reels/`; dirapikan otomatis.
- Tes unit & e2e memakai data uji, sehingga edit konten yang valid di Pages CMS tidak membuat CI gagal.

### Diperbaiki
- Bar pengumuman tidak lagi menggeser navbar & hero saat halaman dimuat (layout shift), termasuk mode "kurangi gerakan".
- Lightbox foto di `/cuci-sepatu/`: tombol Tutup tidak lagi tertutup bar pengumuman.

## [1.0.0] - 2026-10-24

Launch https://cutlesshairstudio.com.

### Ditambahkan
- Website multi-cabang (Bogor Bantarjati & Cibubur): beranda, `/cabang/` & halaman per cabang (diprerender), booking & pesan lewat WhatsApp cabang.
- Konten dikelola lewat Pages CMS: cabang, Daftar Harga (harga per cabang & "Tersedia di cabang"), hairstylist, galeri, promo, pengumuman, testimoni, produk, hero, Tentang Kami, kartu studio, CTA, logo partner.
- Halaman `/cuci-sepatu/` untuk partner cuci sepatu (layanan, harga, daftar menu PDF, galeri) dan teaser di beranda.
- Validasi konten saat build (skema & aturan siap tayang), kompres gambar otomatis, SEO dasar (title/meta, JSON-LD, sitemap), staging terpisah, CI (typecheck, lint, tes, e2e).

[Belum dirilis]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.2.0...staging
[1.2.0]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/rockshow02/cutlesshairstudio/releases/tag/v1.0.0

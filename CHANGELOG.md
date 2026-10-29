# Catatan perubahan

Semua perubahan penting pada website Cutless Hair Studio dicatat di sini.
Format: [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/), penomoran: [Semantic Versioning](https://semver.org/lang/id/).

- **MAYOR** (2.0.0): perubahan besar yang mengubah cara kerja situs atau CMS (mis. format file konten berubah).
- **MINOR** (1.2.0): fitur baru dari `feat/*` lewat staging.
- **PATCH** (1.2.1): perbaikan kecil / hotfix tanpa fitur baru.

Edit konten lewat Pages CMS (harga, foto, FAQ, video, dst.) **tidak** dicatat di sini dan tidak menaikkan versi.
Cara menaikkan versi & merilis: [CONTRIBUTING.md → Rilis versi](CONTRIBUTING.md#3-rilis-versi-staging--main).

## [Belum dirilis]

### Ditambahkan
- Halaman **Tips & Trik** (`/tips/`): artikel gaya rambut, perawatan, & grooming yang ditulis di Pages CMS (satu file Markdown per artikel, status Draf/Terbit). Daftar dengan filter kategori & paginasi, halaman artikel dengan daftar isi otomatis, penulis (kapster), waktu baca, CTA WhatsApp, layanan terkait, & artikel terkait; menu **Tips** dan bagian **Tips Terbaru** di beranda. SEO: title/meta/canonical/og per artikel, JSON-LD `BlogPosting`, `BreadcrumbList`, `CollectionPage` + `ItemList`, sitemap & llms.txt. Toggle **Pengaturan Situs → Tampilkan Tips & Trik** (default mati: halaman 301 ke beranda). 2 artikel contoh berstatus Draf.

## [1.2.3] - 2026-10-29

### Diperbaiki
- Sinkron main → staging gagal sebelum skrip berjalan (v1.2.2): workflow men-checkout `staging`, yang belum memuat `scripts/sync-staging.mjs`. Skrip kini selalu diambil dari `main` (`git show origin/main:…`); diuji dengan menjalankan langkah workflow apa adanya di repo uji yang staging-nya tanpa skrip.
- Sinkron yang gagal selalu menyebut alasan spesifik: skrip tidak ditemukan di main, checkout / fetch / setup Node gagal, atau error tak terduga di skrip (ditangkap, ditulis sebagai alasan + `::error`, bukan crash).

## [1.2.2] - 2026-10-29

### Diperbaiki
- Sinkron main → staging tidak lagi meninggalkan run CI merah palsu: PR sinkron buatan bot memicu CI yang menunggu persetujuan lalu kedaluwarsa (*"required approval but was not approved before it expired"*) saat sinkron me-merge PR itu. Sinkron yang lancar kini tidak membuat PR.
- Sinkron lebih tangguh: satu run dalam satu waktu (`sinkron-staging`), push yang ditolak karena staging berubah diulang dari staging terbaru (maks. 3×), install & tes unit yang gagal diulang sekali (lolos → dicatat *kemungkinan flaky*).
- Sinkron yang gagal sungguhan selalu terlihat: run merah + ringkasan alasan + PR `main → staging` berlabel `perlu-dicek` (termasuk bentrok, yang sebelumnya berakhir hijau).

## [1.2.1] - 2026-10-29

### Diperbaiki
- Teks tidak lagi bergeser saat font dimuat (layout shift; paling terasa di Android & Linux, yang tidak punya font cadangan Arial Black): font Archivo & Plus Jakarta Sans di-host sendiri (bukan Google Fonts yang dimuat async), file latin di-preload, dan render pertama menunggu font maks. 1,5 detik.
- Tes e2e CLS halaman Cuci Sepatu tidak lagi flaky: menunggu `document.fonts.ready` & frame tergambar (bukan jeda waktu tetap), batas CLS diperketat ke < 0,005.

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

[Belum dirilis]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.2.3...staging
[1.2.3]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/rockshow02/cutlesshairstudio/releases/tag/v1.0.0

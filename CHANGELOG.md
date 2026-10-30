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
- **Halaman layanan** (`/layanan/` & `/layanan/<slug>/`) dari Pages CMS (*Halaman Layanan*, satu file Markdown per layanan, status Draf/Terbit): ringkasan pembuka, harga "mulai" per cabang & *Tersedia di cabang* yang **diambil dari Daftar Harga** (harga per cabang, tidak diketik ulang), cocok untuk, proses, durasi, foto, isi tambahan, FAQ (akordeon tanpa JavaScript), tombol booking WhatsApp lewat pemilih cabang (pesan menyebut nama layanan), link ke halaman cabang, layanan terkait, breadcrumb. `/layanan/` dikelompokkan per kategori Daftar Harga. SEO: JSON-LD `Service` (provider = `HairSalon` cabang, `areaServed`, `offers` per cabang dalam IDR), `FAQPage`, `BreadcrumbList`, `CollectionPage` + `ItemList`; sitemap (lastmod) & llms.txt (harga mulai per cabang). Link **Selengkapnya** di Daftar Harga & Kartu Layanan; menu **Layanan** mengarah ke `/layanan/` (jumlah menu tetap). Toggle **Pengaturan Situs → Tampilkan halaman layanan** (default mati: `/layanan*` 301 ke beranda, tanpa menu/sitemap/llms.txt/link). 4 halaman awal berstatus Draf (Haircut pria, Potong rambut wanita, Hair treatment, Potong rambut anak).
- **Halaman cabang diperkaya** (Pages CMS → Cabang, opsional; tampil walau halaman layanan mati): deskripsi cabang, area yang dilayani, patokan & cara menuju, fasilitas & pembayaran (ikon), FAQ cabang, penanda jam buka *Buka sampai 21.00*, dan daftar layanan di cabang itu (bila halaman layanan aktif). JSON-LD `HairSalon` dilengkapi `description`, `areaServed`, `amenityFeature`, `paymentAccepted`, `hasOfferCatalog` (harga cabang), dan `FAQPage` cabang; llms.txt memuat area & fasilitas. Fasilitas & area yang sudah pasti diisi untuk kedua cabang.
- Hitungan klik WhatsApp: jenis tombol baru *Halaman layanan*.

## [1.3.0] - 2026-10-30

### Ditambahkan
- **Ditahan di rilis ini:** Tips & Trik di bawah sudah ikut terpasang, tetapi *Pengaturan Situs → Tampilkan Tips & Trik* mati (`/tips/` dialihkan 301 ke beranda, tidak ada menu/bagian Tips). Tampil setelah toggle dinyalakan, tanpa rilis baru.
- Halaman **Tips & Trik** (`/tips/`): artikel gaya rambut, perawatan, & grooming yang ditulis di Pages CMS (satu file Markdown per artikel, status Draf/Terbit). Daftar dengan filter kategori & paginasi, halaman artikel dengan daftar isi otomatis, penulis (kapster), waktu baca, CTA WhatsApp, layanan terkait, & artikel terkait; menu **Tips** dan bagian **Tips Terbaru** di beranda. SEO: title/meta/canonical/og per artikel, JSON-LD `BlogPosting`, `BreadcrumbList`, `CollectionPage` + `ItemList`, sitemap & llms.txt. Toggle **Pengaturan Situs → Tampilkan Tips & Trik** (default mati: halaman 301 ke beranda). 2 artikel contoh berstatus Draf.
- Tips & Trik: halaman kategori statis `/tips/kategori/<slug>/` (berpaginasi, title/description/canonical sendiri, JSON-LD `CollectionPage` + `BreadcrumbList`, masuk sitemap; chip kategori = link, jalan tanpa JavaScript).
- Artikel Tips & Trik: kotak **Poin penting** (2–5 butir), **FAQ artikel** (akordeon + JSON-LD `FAQPage`), kotak penulis (foto, keahlian, pengalaman, bio, tombol *Booking dengan [nama]*; JSON-LD `Person` lengkap), tombol **Bagikan ke WhatsApp** & **Salin link**, pesan CTA WhatsApp menyebut judul artikel.
- Barber: kolom opsional **Bio singkat** & **Pengalaman** (kotak penulis artikel).
- Tampilan Tips & Trik di HP: kartu ringkas (thumbnail di kiri), chip kategori satu baris yang bisa digeser, breadcrumb satu baris dengan judul terpotong.
- **Cloudflare Web Analytics** (gratis, tanpa cookie, tanpa data pribadi) di semua halaman website utama termasuk 404, hanya di build produksi (staging, E2E, & dev tidak). Beacon dimuat `defer` setelah halaman selesai dimuat, jadi tidak menunda LCP & tidak menggeser tata letak. Token kosong/tidak valid = tidak dipasang; CI memeriksa hasil build produksi & staging. Panduan admin: *Melihat statistik pengunjung*.
- **Hitungan klik WhatsApp**: setiap klik tombol WhatsApp (booking umum, cabang, kapster, CTA artikel Tips, partner Cuci Sepatu, produk, promo) dikirim `sendBeacon` (cadangan `fetch` keepalive) ke `POST /api/klik-wa` tanpa menunda pembukaan WhatsApp. Worker memvalidasi Origin & isian (hanya dari daftar `klik-wa.json` hasil build), lalu menambah penghitung harian di D1 `cutless-analytics` (staging: `cutless-analytics-staging`; tabel `migrations/0001_wa_clicks.sql`). Tanpa IP, nomor HP, isi pesan, cookie, atau ID pengunjung.
- Halaman **/statistik/** (dirender Worker, noindex, tanpa JavaScript): klik 7/30 hari, per cabang, jenis tombol, kapster, halaman asal, asal kunjungan, grafik harian, filter rentang tanggal, ekspor CSV. Dikunci Cloudflare Access dan Worker sendiri memverifikasi JWT Access (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`): tanpa JWT valid = 403. Langkah pemasangan: `docs/statistik-klik-wa.md`; cara membaca: panduan admin *Statistik klik WhatsApp*.

### Diperbaiki
- Tombol berbentuk `<button>` (mis. *Salin link*) tidak lagi memakai latar abu-abu bawaan browser di bawah teks terang: gaya tombol me-reset latar, bingkai, & huruf bawaan. Tes e2e baru memeriksa kontras ≥ 4,5:1 semua tombol situs (normal, terpilih, fokus, hover) di 360 px & desktop.
- Halaman `/cuci-sepatu/` sempat memiliki dua `<main>` (bersarang) selama data partner dimuat: placeholder loading kini `<div>`, bukan `<main>` kedua di dalam `<main>` SiteShell. Tes e2e baru memastikan setiap halaman hanya punya satu `<main>` sepanjang pemuatan (CPU dilambatkan 4×).

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

[Belum dirilis]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.3.0...staging
[1.3.0]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.2.3...v1.3.0
[1.2.3]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/rockshow02/cutlesshairstudio/releases/tag/v1.0.0

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
- **Kabar, Promo & Acara: kolom opsional "Acara: pengisi acara"** (Pages CMS, teks maks. 80 karakter, hanya untuk jenis Acara; diabaikan untuk jenis lain seperti kolom Acara lainnya). Bila terisi: baris **Pengisi acara** di halaman acara (HTML statis dan React) dan `performer` (`PerformingGroup`) di JSON-LD `Event`; kosong = tidak ada performer. Tanpa `offers` (tidak ada data harga tiket).

### Diubah
- **Gambar di halaman item Kabar/Promo/Acara tampil utuh**, tidak lagi dipotong ke 16:9: poster tegak (mis. 4:5 Instagram) terlihat penuh, selebar kolom, tinggi maks. 80vh (`object-fit: contain`), tanpa layout shift (`width`/`height` asli dari pipeline gambar). Kartu di /kabar/ dan kotak cabang tetap dipotong 16:9 tetapi rata atas (`object-position: top`) supaya judul poster lebih sering terlihat. Deskripsi kolom **Gambar** di Pages CMS dan panduan admin diperbarui (poster tegak didukung, minimal 1200 px sisi panjang).
- JSON-LD `BlogPosting` (Kabar/Promo), temuan Rich Results Test: `datePublished` lengkap dengan zona waktu WIB (mis. `2026-11-07T00:00:00+07:00`) dan `author` = Organization yang sama dengan `publisher` (`#organization`). Kabar tidak punya tanggal diperbarui, jadi tanpa `dateModified`.

### Diperbaiki
- **Teks polos tidak lagi sempat terlihat saat kunjungan pertama / hard refresh.** Ringkasan prerender (`<div class="prerender">`, font sistem) tergambar sebentar (±0,4–0,5 detik di Slow 4G dengan CPU 4× lebih lambat; sama di v1.4.2) sebelum React menggantinya, karena Preloader React baru ada setelah JS termuat dan font siap. Bila **Tampilkan animasi pembuka** aktif, semua halaman prerender kini memuat overlay statis (logo + latar sama dengan Preloader, CSS kritis inline kecil, `position: fixed`, tanpa JavaScript untuk tampil) yang menutup ringkasan sejak paint pertama. Dilepas mulus saat React siap: serah-terima langsung ke Preloader React bila tampil, atau pudar singkat bila tidak (sudah sekali per sesi / kurangi gerakan). Pengaman tanpa JS: overlay memudar sendiri ±3 detik lewat animasi CSS (≤ 4 detik) sehingga teks tetap terbaca; **kurangi gerakan** tanpa fade. Teks prerender tetap di HTML (SEO/GEO), tidak ada `<main>` tambahan, CLS tidak berubah, LCP tidak berubah bermakna. Animasi pembuka mati = tanpa overlay (perilaku lama). Tes: `tests/boot-overlay.test.ts`, `e2e/boot-overlay.spec.ts`.

## [1.5.0] - 2026-11-07

### Ditambahkan
- **Kabar, Promo & Acara** (`/kabar/` & `/kabar/<slug>/`) dari Pages CMS (*Kabar, Promo & Acara*, satu file Markdown per item di `src/content/kabar/`, status Draf/Terbit). Tiga jenis: **Kabar** (pengumuman), **Promo** (wajib *berlaku sampai*, opsional *berlaku mulai*), **Acara** (mulai, selesai, lokasi *Di cabang* atau *Tempat lain* dengan nama & alamat tempat, link pendaftaran https opsional); kolom milik jenis lain diabaikan sehingga mengganti jenis aman. Cabang: *Semua cabang* atau satu/beberapa cabang. Tiga status (akan datang, berlangsung, berakhir), semua jam dalam WIB: promo aktif sampai 23.59 WIB hari terakhir, acara berakhir tepat di jam selesai. /kabar/ dikelompokkan *Sedang berlangsung & akan datang*, *Kabar terbaru*, *Sudah berakhir*, dengan saringan cabang & jenis. Kotak **Promo & acara** di halaman cabang dan **banner** di beranda (tanpa saringan cabang; hanya bila kedua toggle menyala). Tombol WhatsApp di halaman detail: satu tombol (pemilih cabang) untuk *Semua cabang*, satu tombol untuk satu cabang, satu per cabang untuk beberapa cabang; tanpa tombol setelah berakhir.
- **Kedaluwarsa tanpa edit**: item yang lewat disembunyikan langsung oleh jam browser pengunjung (kotak cabang & banner, termasuk penyembunyian sebelum halaman tergambar), halaman detail tetap ada dengan label *Promo telah berakhir* / *Acara telah selesai*. HTML statis, JSON-LD, sitemap, dan `llms.txt` disegarkan saat build; **build harian opsional** (`.github/workflows/build-harian.yml`, 00.05 WIB lewat Deploy Hook Cloudflare; tanpa setelan tidak merah) dengan panduan `docs/build-harian-kabar.md`.
- **SEO**: JSON-LD `BlogPosting` (Kabar/Promo), `Event` (Acara), `CollectionPage` + `ItemList` dan `BreadcrumbList`; `lastmod` di sitemap; item aktif di `llms.txt`. Panduan: *Menerbitkan kabar, promo & acara* di `docs/panduan-admin.md` (bagian 6c), batas karakter kolom baru ikut ditambahkan.
- **Toggle default mati** di Pengaturan Situs: *Tampilkan Kabar, Promo & Acara* (mati → `/kabar*` 301 ke beranda, tanpa menu/sitemap/llms.txt/kotak cabang) dan *Tampilkan banner Kabar di beranda* (hanya berlaku bila yang pertama menyala). Menu **Kabar** ada di menu HP dan footer, tidak di menu atas desktop (tidak muat).
- Hitungan klik WhatsApp: klik tombol dari halaman Kabar/Promo/Acara dicatat sebagai jenis *promo* (`docs/statistik-klik-wa.md`).

## [1.4.2] - 2026-11-07

### Diperbaiki
- **Tes e2e balasan ulasan tidak lagi bergantung pada isi CMS.** `e2e/review-replies.spec.ts` mengandalkan "Contoh Dua" (bintang 5, "Bagus, tapi antrinya lama sekali.") masuk antrean karena kata keluhan; sejak pemilik mengosongkan kata keluhan di Pages CMS, ulasan itu terkirim otomatis, tombol *Lewati* tidak pernah muncul, dan CI merah. Build E2E kini menimpa `reviewReplies.json` dengan template dan kata keluhan tetap milik tes (`E2E_REVIEW_REPLIES` di `e2e/fixtures/content.ts`, seperti `settings.json`). Hanya sumber data tes yang berubah: isi `src/content/` (kata keluhan yang sengaja dikosongkan pemilik), `worker/`, logika, dan ekspektasi tes tidak diubah. Tes unit baru: `tests/e2e-review-replies-fixture.test.ts`.

## [1.4.1] - 2026-11-06

### Diubah
- **Kata keluhan balasan ulasan boleh kosong** (Pages CMS → *Template balasan ulasan*; skema dan CMS tidak lagi mewajibkan minimal 1 kata, default daftar kosong). Daftar kosong + mode **Aktif** = SEMUA ulasan bintang 5 dibalas otomatis; bintang 1–4 tetap masuk antrean, mode Uji/Mati tidak mengirim apa pun. Isi `reviewReplies.json` tidak diubah (pemilik mengosongkan sendiri lewat CMS setelah rilis). Dokumentasi: `docs/balasan-ulasan.md` dan *Membalas ulasan Google* di panduan admin (keputusan kirim/antre dibuat sekali saat ulasan diambil; pencocokan berbasis potongan kata; salam diisi saat draf dibuat).

## [1.4.0] - 2026-11-06

### Ditambahkan
- **Balasan ulasan Google** (akses Google Business Profile API sudah disetujui; staging memakai data tiruan, produksi memakai klien Google sungguhan setelah secret OAuth diisi): ulasan bintang 5 tanpa kata keluhan dibalas otomatis dari template, ulasan bintang 1–4 dan ulasan berkata keluhan **tidak pernah** terkirim otomatis: masuk antrean di halaman **/ulasan/** (dirender Worker, noindex, ramah HP, dikunci Cloudflare Access dan JWT diverifikasi Worker sendiri; tidak di sitemap/llms.txt) untuk disunting, **Kirim**, atau **Lewati**. Cron Trigger tiap jam mengambil ulasan baru lewat antarmuka `GbpClient` (`MockGbpClient` untuk staging & tes; klien Google sungguhan aktif setelah secret OAuth diisi), disimpan idempoten di D1 terpisah (`cutless-ulasan`, migrasi `migrations-ulasan/`); batas 10 kiriman otomatis per jam. Template di Pages CMS (*Template balasan ulasan*: 3–6 variasi per kategori, placeholder `{nama}`, `{cabang}`, `{salam_waktu}`, kalimat tambahan per kata kunci, daftar kata keluhan) divalidasi saat build. Toggle **Pengaturan Situs → Mode balasan ulasan Google** (Mati / Uji / Aktif, **default Mati**). Tanpa notifikasi email/chat: ringkasan antrean per cabang, ulasan tertua, penanda *Baru*, dan jumlah antrean di judul tab; antarmuka `Notifier` (bawaan no-op) disiapkan untuk penyedia nanti. Pemasangan: `docs/balasan-ulasan.md` (database D1 `cutless-ulasan` dan `cutless-ulasan-staging` dibuat pemilik; ID terisi di wrangler.jsonc); panduan admin: *Membalas ulasan Google*.
- **Halaman layanan** (`/layanan/` & `/layanan/<slug>/`) dari Pages CMS (*Halaman Layanan*, satu file Markdown per layanan, status Draf/Terbit): ringkasan pembuka, harga "mulai" per cabang & *Tersedia di cabang* yang **diambil dari Daftar Harga** (harga per cabang, tidak diketik ulang), cocok untuk, proses, durasi, foto, isi tambahan, FAQ (akordeon tanpa JavaScript), tombol booking WhatsApp lewat pemilih cabang (pesan menyebut nama layanan), link ke halaman cabang, layanan terkait, breadcrumb. `/layanan/` dikelompokkan per kategori Daftar Harga. SEO: JSON-LD `Service` (provider = `HairSalon` cabang, `areaServed`, `offers` per cabang dalam IDR), `FAQPage`, `BreadcrumbList`, `CollectionPage` + `ItemList`; sitemap (lastmod) & llms.txt (harga mulai per cabang). Link **Selengkapnya** di Daftar Harga & Kartu Layanan; menu **Layanan** mengarah ke `/layanan/` (jumlah menu tetap). Toggle **Pengaturan Situs → Tampilkan halaman layanan** (default mati: `/layanan*` 301 ke beranda, tanpa menu/sitemap/llms.txt/link).
- **Halaman cabang diperkaya** (Pages CMS → Cabang, opsional; tampil walau halaman layanan mati): deskripsi cabang, area yang dilayani, patokan & cara menuju, fasilitas & pembayaran (ikon), FAQ cabang, penanda jam buka *Buka sampai 21.00*, dan daftar layanan di cabang itu (bila halaman layanan aktif). JSON-LD `HairSalon` dilengkapi `description`, `areaServed`, `amenityFeature`, `paymentAccepted`, `hasOfferCatalog` (harga cabang), dan `FAQPage` cabang; llms.txt memuat area & fasilitas. Fasilitas & area yang sudah pasti diisi untuk kedua cabang.
- Hitungan klik WhatsApp: jenis tombol baru *Halaman layanan*.
- **Konfigurasi Google produksi**: `GBP_LOCATIONS` berisi lokasi Bogor Bantarjati & Cibubur (dijaga tes agar cocok dengan daftar cabang). Mode balasan ulasan tetap **Mati** sampai diubah di Pages CMS.

## [1.3.1] - 2026-11-06

### Ditambahkan
- Halaman **Kebijakan Privasi** (`/kebijakan-privasi/`), dibutuhkan Google OAuth consent screen: statis, terprerender (terbaca tanpa JavaScript), masuk sitemap, tertaut di footer semua halaman. Isinya hanya fakta situs ini: Cloudflare Web Analytics, hitungan klik WhatsApp (kolom yang disimpan), percakapan WhatsApp, ulasan Google (dibaca lewat Google Business Profile API untuk membalas ulasan), embed Instagram setelah tombol putar, penyimpanan di Cloudflare, hak & cara meminta penghapusan data. Teksnya di `src/content/privacyPolicy.ts` (nomor WhatsApp, email, & cabang dari konten situs). Tanpa toggle CMS: halaman hukum yang harus selalu ada.

### Diubah
- `/kebijakan-privasi` tidak lagi 404 (dihapus dari daftar rute dicabut di `public/_redirects`).

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

[Belum dirilis]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.5.0...staging
[1.5.0]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.4.2...v1.5.0
[1.4.2]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.2.3...v1.3.0
[1.2.3]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/rockshow02/cutlesshairstudio/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/rockshow02/cutlesshairstudio/releases/tag/v1.0.0

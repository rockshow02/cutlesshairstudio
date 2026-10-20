# Panduan Admin Website Cutless Hair Studio

Panduan ini untuk pemilik dan staf. Tidak perlu keahlian teknis.

> **Booking lewat WhatsApp:** semua tombol booking dan pesan produk membuka WhatsApp cabang yang dipilih pengunjung. Cabang, Barber, Daftar Harga, dan Produk diedit di Pages CMS seperti di bawah.

**Panel admin:** https://app.pagescms.org
**Login:** pakai akun **GitHub** Anda (gratis).

> **Kapan perubahan tampil?** Setiap kali Anda klik **Save**, website diperbarui otomatis dalam **sekitar 1–2 menit**. Setelah itu buka website dan tekan *refresh*.

---

## Sebelum mulai (sekali saja)

1. **Buat akun GitHub** di https://github.com/signup (gratis). Catat username Anda.
2. Kirim username/email GitHub ke pemilik/developer. Anda akan diundang sebagai **kolaborator**.
3. Buka email dari GitHub berjudul *"invited you to collaborate"* → klik **View invitation** → **Accept invitation**.

## Cara login

1. Buka **https://app.pagescms.org**.
2. Klik **Sign in with GitHub** → izinkan akses (sekali saja).
3. Pilih repo **cutlesshairstudio** → branch **main**.
   Branch **main** = website asli. Branch **staging** hanya untuk uji coba (hasilnya tampil di alamat staging berlabel *STAGING*, tidak dilihat pelanggan). Bila ragu, pakai **main**.
4. Menu konten ada di kiri: **Cabang, Daftar Harga, Barber, Galeri, Hero, Tentang Kami, Kartu Studio, CTA Penutup, Promo, Pengumuman, Testimoni, Produk, Pengaturan Situs**.

Tips umum:
- Setiap kolom punya keterangan kecil di bawahnya. Baca dulu bila ragu.
- Daftar berisi beberapa entri (mis. harga). Klik entri untuk membuka, **Add an entry** untuk menambah, ikon tempat sampah untuk menghapus, tarik ikon titik-titik untuk mengubah urutan tampilan di panel.
- Jangan lupa klik **Save** di kanan atas.
- Ingin menyembunyikan sesuatu sementara? Matikan **Tampilkan di website** / **Aktif**. Datanya tidak hilang.

---

## 0. Mengelola cabang *(Owner)*

Semua alamat, jam buka, dan nomor WhatsApp booking ada di menu **Cabang**, satu entri per cabang.

**Menambah cabang:**
1. Klik **Cabang** → **Add an entry**.
2. **Kode URL (slug)**: huruf kecil dan strip, mis. `depok-margonda`. Menjadi alamat halaman `/cabang/depok-margonda/`. **Jangan diubah setelah tayang**, karena barber, harga, dan promo menautkan cabang lewat kode ini.
3. Isi **Nama cabang**, **Kota**, **Provinsi**, **Alamat lengkap**, **Link Google Maps**.
4. **Latitude / Longitude** (disarankan): buka Google Maps → klik kanan titik lokasi → klik angka koordinat paling atas (otomatis tersalin), mis. `-6.5717, 106.8061`. Tempel angka pertama ke Latitude dan angka kedua ke Longitude. Dipakai untuk tombol **Cabang terdekat** dan peta.
5. **Nomor WhatsApp cabang** *(wajib)*: format `628xxxxxxxxxx`. Semua booking cabang ini masuk ke nomor ini.
6. **Zona waktu**: WIB untuk Jawa/Sumatra, WITA untuk Bali/Kalimantan Timur/Sulawesi, WIT untuk Papua/Maluku.
7. **Jam buka**: satu baris per hari (format 24 jam, `10:00`, `21:00`). Centang **Tutup seharian** untuk hari libur.
8. **Status**:
   - **Aktif**: tampil dan bisa dibooking.
   - **Segera Dibuka**: tampil dengan label *Segera Dibuka*, tanpa tombol booking. Cocok untuk cabang yang belum beroperasi.
   - **Tutup Sementara**: tampil dengan label, tanpa tombol booking (mis. renovasi panjang).
9. **Foto cabang** (opsional): foto lebar tampak depan/interior.
10. **Save**.

Cabang baru muncul sebagai pilihan di menu Barber, Harga, Promo, dan Pengumuman **±1 menit setelah Save** (refresh Pages CMS).

> Website menolak tayang bila ada cabang **Aktif** yang belum punya nomor WA, jam buka, atau alamat, atau bila masih ada tulisan `TODO`. Bila datanya belum lengkap, pakai status **Segera Dibuka** dulu.

---

## 1. Mengubah harga

1. Klik **Daftar Harga** → buka layanan yang mau diubah, misalnya *Signature Haircut*.
2. Ubah **Harga (Rupiah)**: tulis **angka saja, tanpa titik dan tanpa "Rp"**. Contoh: `85000` (tampil *Rp 85.000*).
3. Klik **Save**.

Lainnya:
- **Harga mulai**: aktifkan bila harga bisa lebih mahal (tampil *mulai Rp 150.000*).
- **Label khusus**: *Best Seller*, *Baru*, atau *Promo*. Kosongkan bila tidak perlu.
- **Urutan**: angka kecil tampil lebih dulu (pakai kelipatan 10 agar mudah menyisipkan: 10, 20, 30).
- **Tambah layanan**: **Add an entry** → isi nama, kategori, harga → **Save**.
- **Paket/membership**: pilih kategori **Paket**. Di **Keterangan**, tulis isi paket **satu poin per baris**:
  ```
  4x Signature Haircut
  Berlaku 60 hari
  Prioritas jadwal booking
  ```
  Paket berlabel *Best Seller* tampil sebagai kartu yang menonjol.

**Harga berbeda per cabang:** **Harga (Rupiah)** adalah harga dasar untuk semua cabang. Bila satu cabang berbeda, buka **Harga khusus cabang** → **Add an entry** → pilih **Cabang** → isi **Harga di cabang ini** → **Save**. Pengunjung yang sudah memilih cabang melihat harga cabangnya; yang belum memilih melihat *mulai Rp…* (harga terendah).

Harga "mulai" pada kartu **Layanan** di halaman utama dihitung otomatis dari Daftar Harga, jadi tidak perlu diubah terpisah.

---

## 2. Menambah atau menonaktifkan barber

**Menambah:**
1. Klik **Barber** → **Add an entry**.
2. Isi **Nama panggilan** (mis. `Raka`) dan **Jabatan** (opsional, mis. `Senior Hairstylist`).
3. **Foto**: klik kotak foto → **Upload** → pilih foto dari HP/komputer. Pakai foto **tegak** (potret), wajah jelas. Foto otomatis dikecilkan, jadi tidak perlu diedit dulu.
4. **Cabang** *(wajib)*: cabang tempat barber bekerja. Barber hanya tampil saat pengunjung memilih cabang itu.
5. **Spesialisasi**: pisahkan dengan koma, mis. `Skin fade, Pompadour`.
6. **WhatsApp pribadi** (opsional): format `628xxxxxxxxxx`, **tanpa +, spasi, atau strip**. Kosongkan untuk memakai nomor cabang.
7. **Urutan**: posisi tampil (angka kecil = paling kiri).
8. **Save**.

**Pindah cabang:** buka barbernya → ganti **Cabang** → **Save**.

**Menonaktifkan** (cuti/resign): buka barbernya → matikan **Tampilkan di website** → **Save**.

---

## 3. Upload foto galeri

1. Klik **Galeri** → **Add an entry**.
2. **Foto**: upload foto hasil potongan. Foto tegak tampil tinggi, foto lebar tampil lebar (otomatis).
3. **Deskripsi foto** *(wajib)*: jelaskan isi foto, mis. `Mid fade dengan textured crop, tampak samping`.
4. **Gaya rambut**: pilih Fade, Pompadour, Crop, Coloring, Perming, atau Lainnya.
5. **Keterangan singkat** (opsional): tampil saat foto diperbesar, dan sebagai label kecil di kolom foto berjalan.
6. **Titik fokus**: bagian foto yang dipertahankan saat foto dipotong agar pas di kartu: **atas** (bawaan, kepala/wajah tetap terlihat), **tengah**, atau **bawah**.
7. **Tampilkan di kolom foto berjalan** (bawaan menyala): lihat di bawah.
8. **Save**.

Foto dari HP langsung bisa dipakai. Sistem otomatis mengompresnya beberapa menit setelah upload (Anda mungkin melihat perubahan kecil tercatat atas nama *github-actions*; itu normal).

### Kolom foto berjalan (section Lokasi)

Di sebelah info cabang ada 2–3 kolom foto yang bergerak pelan. Isinya diambil dari **Galeri**, sama untuk semua cabang:
- Yang ikut: foto yang **Tampilkan di website** *dan* **Tampilkan di kolom foto berjalan** keduanya menyala. Matikan toggle kedua untuk foto yang hanya ingin tampil di section Galeri (mis. foto suasana yang terlalu lebar).
- **Urutan** sama dengan urutan Galeri; foto dibagi bergantian ke tiap kolom (9 foto atau lebih → 3 kolom).
- **Label** di kartu = *Keterangan singkat*; bila kosong, memakai *Gaya rambut* (mis. "Fade"). Tidak ada nama orang.
- Kepala terpotong di kartu? Ubah **Titik fokus** foto itu (biasanya **atas**).
- Kurang dari 4 foto yang ikut, atau pengunjung memilih "kurangi gerakan" di HP/komputernya → foto tampil sebagai grid diam.
- Pengunjung bisa menghentikan gerakan dengan menyentuh foto atau tombol **Jeda animasi foto**. Gerakan juga berhenti saat kursor di atas foto, saat section tidak terlihat, dan saat tab browser tidak aktif.

---

## 3a. Hero (bagian paling atas)

Menu **Hero (bagian paling atas)**:
- **Teks kecil di atas judul**: tulis `{cities}` untuk menampilkan kota cabang otomatis (mis. *Hair Studio · Bogor & Cibubur*).
- **Judul (per baris)**: satu isian = satu baris besar. Maks. 3 baris, pendek saja.
- **Subjudul**, **Label tombol utama** (tombol ini selalu membuka WhatsApp cabang yang dipilih), **Label tombol kedua** (menuju Layanan).
- **Foto desktop**: foto lebar (landscape) min. 1920 px. **Foto HP** (opsional): foto tegak; kosong = memakai foto desktop. **Deskripsi foto** wajib.
- **Teks berjalan**: kata-kata pendek di strip di bawah hero.

## 3b. Tentang Kami & slideshow foto

Menu **Tentang Kami**: teks kecil, **judul** (tampil di atas foto), **paragraf** (paragraf pertama tampil lebih besar), **poin nilai** (judul + keterangan), **keterangan di bawah foto**, dan **Foto slideshow**.

**Menambah foto slideshow**
1. Buka **Tentang Kami** → bagian **Foto slideshow** → **Add an entry** (maks. 8 foto).
2. **Foto**: pilih/upload foto **tegak (portrait)**. Bingkai di website berasio **4:5**, foto lebih lebar akan dipotong. Foto dikompres otomatis ke WebP (1200 px + versi HP 600 px).
3. **Deskripsi foto** wajib diisi (mis. *Hairstylist merapikan fade pelanggan*).
4. **Titik fokus**: bagian foto yang dipertahankan saat dipotong: **atas** (wajah/kepala di atas), **tengah** (bawaan), **bawah**.
5. Klik **Save**. Tampil di website ±1–2 menit kemudian.

**Mengurutkan**: tarik ikon titik-titik di kiri tiap foto. Urutan di panel = urutan tampil. **Foto pertama** dimuat lebih dulu dan tampil saat halaman dibuka, jadi pilih foto terbaik untuk posisi pertama.

**Menghapus**: klik ikon tempat sampah pada foto → **Save**. Minimal harus tersisa **1 foto** (website menolak menyimpan bila kosong). Satu foto = tampil diam tanpa indikator.

**Pengaturan slideshow**
- **Jeda per foto (detik)**: 3–15, bawaan 5.
- **Efek pergantian**: *crossfade* (memudar halus, bawaan) atau *ken-burns* (memudar + foto membesar perlahan).

Perilaku di website (otomatis): berganti sendiri sesuai jeda, berhenti saat kursor di atas foto, saat section tidak terlihat, atau saat tab browser tidak aktif. Pengunjung bisa memilih foto lewat garis indikator, menggeser (swipe) di HP, atau menekan tombol jeda. Pengunjung yang mengaktifkan "kurangi gerakan" di HP/komputernya melihat foto diam dengan tombol panah.

> Foto dari Google Drive: **unduh dulu**, lalu upload lewat Pages CMS. Jangan menempelkan link Google Drive.

## 3c. Kartu Studio ("On point, always.")

Menu **Kartu Studio**: **Foto** (opsional, foto lebar suasana studio; kosong = memakai foto cabang pertama), **Deskripsi foto** (wajib bila foto diisi), dan **Tagline** (1–5 kalimat pendek yang berganti di atas foto).

## 3d. CTA penutup ("Kursimu sudah siap.")

Menu **CTA Penutup**: bagian ajakan booking besar di bawah halaman.
- **Teks kecil di atas judul** (maks. 60), **Judul** (maks. 60, tampil sangat besar, pendek saja), **Deskripsi** (maks. 240), **Label tombol** (maks. 40).
- Tombol **selalu** membuka WhatsApp cabang yang dipilih pengunjung; yang bisa diubah hanya tulisannya.
- **Foto latar**: pilih/upload foto **lebar (landscape) minimal 1920 px**, dan **kompres dulu sampai di bawah 1 MB** sebelum upload (mis. lewat squoosh.app atau kirim ke WhatsApp sendiri lalu simpan ulang). Website membuat versi 1920 px & 1280 px (WebP) otomatis. Foto tampil gelap dan hitam-putih agar teks tetap terbaca, jadi foto suasana studio yang tidak terlalu ramai paling cocok.
- **Deskripsi foto** wajib bila foto latar diisi (maks. 150).
- Kosongkan **Foto latar** untuk kembali ke foto bawaan.

## 3e. Halaman Partner (`/partner/`)

Menu **Halaman Partner** mengatur seluruh halaman kerja sama: kemitraan/buka cabang, brand & kolaborasi, serta layanan korporat & event. Link **Partner** ada di footer (kolom *Jelajahi*) dan di menu HP; navbar desktop sengaja tidak memuatnya agar tidak sesak.

**Nomor WhatsApp partnership** (paling atas): tujuan tombol *Chat Tim Partnership* dan form pengajuan. Format `628xxxxxxxxxx`. **Kosongkan** untuk memakai *Nomor WhatsApp pusat* di Pengaturan Situs.

Halaman terdiri dari 8 bagian, masing-masing punya tombol **Tampilkan section ini**. Bagian yang dimatikan hilang dari halaman, termasuk tombol/link yang menuju ke sana.

| Bagian | Isi | Catatan |
|---|---|---|
| 1. Hero | Teks kecil, judul, subjudul, foto latar, label 2 tombol | Foto lebar minimal 1920 px (dikompres otomatis ke WebP 1920 & 1280 px). Kosong = foto CTA penutup. Deskripsi foto wajib bila foto diisi |
| 2. Pilih jenis kerja sama | Maks. 3 kartu: jenis (`cabang` / `brand` / `korporat`), judul, deskripsi, ikon, label tombol | Tombol kartu menggulir ke section jenis itu. Kartu otomatis hilang bila section tujuannya dimatikan |
| 3. Kemitraan Cabang | Alasan bermitra, Yang didapat mitra, Alur kemitraan (urutan = nomor langkah), Kota target (tampil sebagai chip), Kisaran investasi | **Kisaran investasi** opsional: kosong = tidak tampil. Isi hanya dengan angka yang sudah disetujui owner |
| 4. Brand & Kolaborasi | Bentuk kolaborasi, Logo partner (nama, logo, link, urutan, tampilkan) | Bagian logo baru muncul bila ada minimal 1 logo aktif. Pasang **hanya logo partner yang sudah memberi izin**. Logo PNG/WebP berlatar transparan, tampil abu-abu dan berwarna saat disentuh kursor |
| 5. Korporat & Event | Jenis layanan (judul, deskripsi, ikon), Catatan | Catatan opsional, mis. minimal peserta atau area layanan |
| 6. Testimoni partner | Nama, institusi, kutipan | **Mati secara bawaan.** Nyalakan hanya bila sudah ada testimoni asli dengan izin partner |
| 7. FAQ | Pertanyaan & jawaban | Tampil sebagai daftar buka-tutup |
| 8. Form pengajuan | Judul, pengantar, label tombol kirim, catatan privasi | Mematikan form juga menyembunyikan tombol *Ajukan Kerja Sama* di hero |

**Cara kerja form:** pengunjung memilih jenis kerja sama lalu mengisi nama, perusahaan/brand (opsional), kota, nomor WhatsApp (diawali 08 atau 62), dan pesan singkat. Tombol *Kirim via WhatsApp* membuka WhatsApp **di HP/laptop pengunjung** dengan pesan rapi berisi semua isian, ditujukan ke nomor partnership. Website tidak menyimpan atau mengirim data ke server mana pun; pengajuan baru sampai setelah pengunjung menekan kirim di WhatsApp.

**Ikon** yang bisa dipilih: store (toko), handshake (jabat tangan), briefcase (tas kerja), pin, gift, tag, calendar, user, scissors, star, check, shave, wash.

Setelah Save, tunggu ±2 menit lalu buka `/partner/` untuk mengecek.

## 4. Membuat promo

1. Klik **Promo** → **Add an entry**.
2. Isi:
   - **Judul promo**, mis. `Diskon 20% Haircut Weekday`
   - **Deskripsi**: syarat singkat
   - **Gambar** (opsional): gambar lebar paling bagus
   - **Teks tombol**, mis. `Ambil Promo`
   - **Pesan WhatsApp**: pesan otomatis saat tombol diklik. Tulis `{brand}` untuk nama studio dan `{promo}` untuk judul promo, mis. `Halo {brand}, saya mau pakai promo {promo} untuk [hari/jam].` Nama cabang pengunjung otomatis ditambahkan.
   - **Mulai** dan **Selesai**: tanggal & jam **WIB**. *Selesai* harus setelah *Mulai*.
   - **Berlaku di cabang**: pilih satu atau beberapa cabang. **Kosongkan bila berlaku di semua cabang.** Promo khusus cabang hanya tampil bagi pengunjung yang memilih cabang itu (atau yang belum memilih, dengan keterangan *Berlaku di cabang …*).
3. **Save**.

Promo otomatis **muncul tepat pada jam mulai** dan **hilang setelah jam selesai**, tanpa perlu Anda lakukan apa pun. Untuk menghentikan lebih cepat: matikan **Aktif** → **Save**.

---

## 5. Memasang pengumuman (mis. cabang tutup)

Pengumuman tampil sebagai bar tipis di paling atas website. Pengunjung bisa menutupnya.

1. Klik **Pengumuman** → **Add an entry**.
2. **Pesan** (maks. 160 karakter), mis.:
   `Cabang Cibubur TUTUP Senin, 20 Oktober untuk renovasi. Buka kembali Selasa pukul 10.00.`
3. **Jenis**: **Tutup** (paling menonjol), **Jam Khusus** (mis. jam Lebaran), atau **Info**.
4. **Mulai tampil / Selesai tampil** (opsional, WIB), mis. mulai 18 Okt 08:00, selesai 21 Okt 10:00. Kosongkan bila ingin tampil sampai dimatikan.
5. **Berlaku di cabang**: pilih cabang yang tutup/berubah jam. **Kosongkan bila untuk semua cabang.**
6. **Save**.

Pengumuman jenis **Tutup** yang sedang berlaku membuat status cabang itu menjadi *Tutup hari ini*, dan **Jam Khusus** menampilkan pesannya sebagai status, menggantikan jam buka biasa. Jam buka di menu Cabang tidak perlu diubah.

Menurunkan pengumuman: matikan **Aktif** → **Save** (atau hapus entrinya). Bila Anda mengubah isi pesan, pengunjung yang sudah menutupnya akan melihatnya lagi.

---

## 6. Mengelola produk (pomade, hair tonic, dll.)

Produk tampil di halaman **/produk** dan 4 produk teratas juga tampil di halaman utama, setelah **Pengaturan Situs → Tampilkan Produk** dinyalakan. Pembeli memesan lewat tombol WhatsApp (pesan otomatis berisi nama produk).


**Menambah produk:**
1. Klik **Produk** → **Add an entry**.
2. Isi **Nama produk** (mis. `Water Based Pomade`), **Kategori**, dan **Harga jual** (angka saja, mis. `95000`).
3. **Isi / ukuran** (mis. `100 gr`) dan **Deskripsi singkat** (manfaat, cocok untuk siapa).
4. **Foto produk**: upload foto **persegi** dengan latar polos. Foto otomatis dikecilkan. Tanpa foto, tampil gambar logo Cutless.
5. **Save**.

**Diskon:** isi **Harga coret** dengan harga normal (lebih besar dari harga jual), lalu pilih **Label khusus → Promo**. Website menampilkan ~~Rp 100.000~~ **Rp 85.000**. Kosongkan harga coret setelah diskon selesai.

**Stok habis:** matikan **Stok tersedia**. Produk tetap tampil dengan label *Stok habis* dan tombolnya menjadi *Tanya stok*. Nyalakan lagi saat barang datang.

**Jual juga di marketplace?** Isi **Link Shopee / Tokopedia** (opsional); tautannya tampil kecil di bawah tombol pesan.

**Berhenti menjual:** matikan **Tampilkan di website** (data tidak hilang) atau hapus entrinya.

---

## 7. Testimoni

1. Klik **Testimoni** → **Add an entry**.
2. Isi **Nama pemberi ulasan**, **Bintang (1–5)**, **Isi ulasan** (salin apa adanya dari Google/Instagram), **Tanggal ulasan**, **Sumber**.
3. **Save**.

Section Testimoni baru tampil setelah **Pengaturan Situs → Tampilkan section Testimoni** dinyalakan. Pakai ulasan asli saja.

---

## 8. Pengaturan situs *(Owner)*

Klik **Pengaturan Situs**. Menu ini hanya berisi data merek. Alamat dan jam buka ada di menu **Cabang**.

| Kolom | Dipakai untuk | Batas |
|---|---|---|
| Nama usaha | Judul website, pesan WhatsApp | wajib, maks. 80 karakter |
| Alamat website (domain resmi) | Link yang dibagikan di Google/WhatsApp/sosial media. Ganti **hanya** saat pindah domain, mis. `https://cutlesshairstudio.id` (tanpa `/` di akhir) | wajib |
| Nomor WhatsApp pusat | Pertanyaan umum & kontak di footer. Booking memakai nomor cabang | wajib, format `628xxxxxxxxxx` |
| Pesan booking default | Pesan otomatis tombol booking. `{brand}` = nama usaha, `{branch}` = nama cabang | maks. **500** karakter (emoji dihitung 2) |
| Link Instagram / TikTok | Ikon sosial media di footer. **Kosongkan untuk menyembunyikan** | link lengkap `https://…` |
| Email | Baris email di footer. **Kosongkan untuk menyembunyikan** | format email valid, maks. 100 karakter |
| Tagline footer | Kalimat di bawah logo footer. Tulis `{cities}` untuk kota cabang otomatis, mis. *Hair studio di {cities}. Goodstyle, goodmood.* → *Hair studio di Bogor & Cibubur. …* | maks. **160** karakter |
| Angka statistik | Jumlah pelanggan, tahun berdiri, rating & jumlah ulasan Google. **Masing-masing punya tombol Tampilkan**; nyalakan hanya bila angkanya asli. Jumlah cabang dan hairstylist dihitung otomatis | |
| Tampilkan section Testimoni / Produk / Before-After | Menyalakan atau menyembunyikan section itu (beserta menunya) | |
| Tampilkan animasi pembuka | Logo Cutless beranimasi saat website pertama kali dibuka (sekali per kunjungan). Matikan bila tidak diinginkan | |
| Video animasi pembuka (opsional) | Video pendek pengganti animasi logo: MP4/WebM tanpa suara, ±1,5 detik. Kosongkan untuk memakai animasi logo | maks. 500 KB |

### Footer & kontak: di mana mengubahnya

| Yang ingin diubah | Menu → kolom |
|---|---|
| Nomor WhatsApp di footer (pertanyaan umum) | **Pengaturan Situs → Nomor WhatsApp pusat** |
| Nomor WhatsApp untuk booking | **Cabang → Nomor WhatsApp** (tiap cabang). Hairstylist bisa punya nomor sendiri di **Barber** |
| Email | **Pengaturan Situs → Email** (kosong = tidak tampil) |
| Instagram, TikTok | **Pengaturan Situs → Link Instagram / Link TikTok** (kosong = ikon disembunyikan) |
| Tagline di bawah logo | **Pengaturan Situs → Tagline footer** |
| Daftar cabang di footer | Otomatis dari menu **Cabang** |
| Nama kota (footer, judul & deskripsi Google, data cabang) | Otomatis dari kolom **Kota** di menu **Cabang**; cabang *Segera Dibuka* belum disebut |

**Save** setelah mengubah.

---

## Batas karakter tiap kolom

Form Pages CMS menolak isian yang melebihi batas, dan website memeriksa batas yang sama saat dibangun. Bila kolom kepanjangan sempat tersimpan (mis. lewat edit langsung di GitHub), website **tidak diperbarui** sampai isinya dipendekkan. Emoji dihitung 2 karakter.

| Menu | Kolom | Maks. karakter | Wajib diisi? |
|---|---|---|---|
| Cabang | Kode URL (slug) | 60 | wajib |
| Cabang | Nama cabang | 60 | wajib |
| Cabang | Kota | 60 | wajib |
| Cabang | Provinsi | 60 | wajib |
| Cabang | Alamat lengkap | 300 | opsional |
| Daftar Harga | Nama layanan | 80 | wajib |
| Daftar Harga | Keterangan | 300 | opsional |
| Barber | Nama panggilan | 60 | wajib |
| Barber | Jabatan | 60 | opsional |
| Barber | Spesialisasi | 120 | opsional |
| Galeri | Deskripsi foto | 150 | wajib |
| Galeri | Keterangan singkat | 120 | opsional |
| Hero (bagian paling atas) | Teks kecil di atas judul | 80 | wajib |
| Hero (bagian paling atas) | Judul (per baris) | 40 per isian | wajib |
| Hero (bagian paling atas) | Subjudul | 240 | wajib |
| Hero (bagian paling atas) | Label tombol utama | 30 | wajib |
| Hero (bagian paling atas) | Label tombol kedua | 30 | wajib |
| Hero (bagian paling atas) | Deskripsi foto | 150 | wajib |
| Hero (bagian paling atas) | Teks berjalan | 40 per isian | wajib |
| Tentang Kami | Teks kecil di atas judul | 40 | wajib |
| Tentang Kami | Judul (tampil di atas foto) | 80 | wajib |
| Tentang Kami | Paragraf | 600 per isian | wajib |
| Tentang Kami | Poin nilai → Judul poin | 40 | wajib |
| Tentang Kami | Poin nilai → Keterangan | 120 | wajib |
| Tentang Kami | Keterangan di bawah foto | 80 | opsional |
| Tentang Kami | Foto slideshow → Deskripsi foto | 150 | wajib |
| Kartu Studio ("On point, always.") | Deskripsi foto | 150 | opsional |
| Kartu Studio ("On point, always.") | Tagline | 60 per isian | wajib |
| CTA Penutup ("Kursimu sudah siap.") | Teks kecil di atas judul | 60 | wajib |
| CTA Penutup ("Kursimu sudah siap.") | Judul | 60 | wajib |
| CTA Penutup ("Kursimu sudah siap.") | Deskripsi | 240 | wajib |
| CTA Penutup ("Kursimu sudah siap.") | Label tombol | 40 | wajib |
| CTA Penutup ("Kursimu sudah siap.") | Deskripsi foto | 150 | wajib bila foto diisi |
| Promo | Judul promo | 80 | wajib |
| Promo | Deskripsi | 400 | opsional |
| Promo | Teks tombol | 40 | opsional |
| Promo | Pesan WhatsApp | 500 | opsional |
| Pengumuman | Pesan | 160 | wajib |
| Testimoni | Nama pemberi ulasan | 60 | wajib |
| Testimoni | Isi ulasan | 500 | wajib |
| Produk | Nama produk | 80 | wajib |
| Produk | Isi / ukuran | 30 | opsional |
| Produk | Deskripsi singkat | 400 | opsional |
| Pengaturan Situs | Nama usaha | 80 | wajib |
| Pengaturan Situs | Pesan booking default | 500 | opsional |
| Pengaturan Situs | Email | 100 | opsional |
| Pengaturan Situs | Tagline footer | 160 | opsional |
| Halaman Partner | Judul (semua bagian, kartu, poin, langkah, layanan) | 80 | wajib |
| Halaman Partner | Teks kecil di atas judul | 60 | wajib |
| Halaman Partner | Subjudul hero, pengantar, deskripsi kartu/poin/layanan, catatan | 300 | wajib (pengantar & catatan opsional) |
| Halaman Partner | Label tombol | 40 | wajib |
| Halaman Partner | Poin "Yang didapat mitra" | 160 per isian | opsional |
| Halaman Partner | Kota target | 40 per isian | opsional |
| Halaman Partner | Kisaran investasi | 160 | opsional |
| Halaman Partner | Logo partner → Nama partner | 60 | wajib |
| Halaman Partner | Testimoni → Kutipan | 400 | wajib |
| Halaman Partner | FAQ → Pertanyaan / Jawaban | 160 / 600 | wajib |
| Halaman Partner | Catatan privasi form | 160 | wajib |

---

## Bila ada masalah

| Masalah | Solusi |
|---|---|
| Perubahan belum muncul | Tunggu 2 menit, refresh website. Masih belum? Lihat baris berikut |
| Perubahan tidak pernah muncul | Kemungkinan ada isian yang salah sehingga sistem menolak memperbarui website (website tetap menampilkan versi sebelumnya, jadi aman). Hubungi developer, atau cek pesan error di Cloudflare |
| Kolom ditolak saat Save | Baca pesan merah di bawah kolom (mis. format nomor WA atau jam) |
| Nomor WA ditolak | Harus diawali `62`, hanya angka, mis. `628129876xxxx` |
| Website tidak berubah setelah menambah cabang | Pastikan cabang Aktif sudah punya nomor WA, jam buka, dan alamat, atau pakai status **Segera Dibuka** |
| Cabang baru tidak ada di pilihan Barber/Harga | Tunggu ±1 menit setelah menyimpan cabang, lalu refresh Pages CMS |
| Salah ubah / terhapus | Tenang, semua perubahan tercatat. Hubungi developer untuk mengembalikan (rollback) |
| Tidak bisa login | Pastikan undangan kolaborator GitHub sudah di-*Accept* |

Setiap perubahan tercatat atas nama akun GitHub Anda (siapa mengubah apa dan kapan).

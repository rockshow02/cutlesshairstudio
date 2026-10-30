# Panduan Admin Website Cutless Hair Studio

Panduan ini untuk pemilik dan staf. Tidak perlu keahlian teknis.

> **Booking lewat WhatsApp:** semua tombol booking dan pesan produk membuka WhatsApp cabang yang dipilih pengunjung. Cabang, Barber, Daftar Harga, dan Produk diedit di Pages CMS seperti di bawah.

**Panel admin:** https://app.pagescms.org
**Login:**
- **Pemilik (owner):** akun **GitHub** → *Sign in with GitHub*.
- **Staf (collaborator):** cukup **email**, tanpa akun GitHub → *Continue with email* (kode 6 digit dikirim ke email).

> **Kapan perubahan tampil?** Setiap kali Anda klik **Save**, website diperbarui otomatis dalam **sekitar 3–5 menit**. Lihat bagian **Setelah Save** dan **Jika Save ditolak** di bawah.

> **Branch mana yang diedit?**
> - **Setelah website resmi tayang (launch): semua pengeditan harian dilakukan di branch `main`** (= website asli yang dilihat pelanggan).
> - Branch `staging` hanya untuk uji coba fitur baru oleh developer (tampil di alamat berlabel *STAGING*, tidak dilihat pelanggan). Perubahan di `staging` **tidak** otomatis pindah ke website asli.
> - Bila ragu, pakai **`main`**.

---

## Sebelum mulai (sekali saja)

### Pemilik: mengundang staf sebagai collaborator

1. Login di https://app.pagescms.org dengan **Sign in with GitHub**, buka repo **cutlesshairstudio**.
2. Di menu kiri, klik **Collaborators** (hanya terlihat oleh pemilik akun GitHub).
3. Masukkan **email** staf, lalu undang. Staf tidak perlu membuat akun GitHub.
4. Kirim ke staf link langsung ke panel website: **https://app.pagescms.org/rockshow02/cutlesshairstudio/main**.
5. Untuk mencabut akses (mis. staf berhenti), hapus email-nya dari **Collaborators**.

> **Penting sebelum staf mengedit `main` (sekali, oleh pemilik):** aturan perlindungan branch `main` di GitHub (*Settings → Rules → Rulesets → main produksi*) mewajibkan Pull Request. Simpanan collaborator dikirim lewat aplikasi **Pages CMS** (GitHub App), bukan akun pemilik, sehingga akan **ditolak** kecuali aplikasi itu ada di daftar pengecualian. Buka ruleset → **Bypass list → Add bypass → Apps → Pages CMS** → Save. Lihat juga `CONTRIBUTING.md` → *Branch protection*.

### Staf: login pertama

Tidak perlu akun GitHub. Pastikan pemilik sudah mengundang email Anda.

## Cara login

**Staf (collaborator), lewat email:**
1. Buka link dari pemilik (atau **https://app.pagescms.org**).
2. Di kolom **Email**, ketik email yang diundang → klik **Continue with email**.
3. Buka email dari Pages CMS berjudul *"Your Pages CMS temporary code is …"*, salin **kode 6 digit**.
4. Ketik kode di layar **Verify your login** → klik **Verify code**. Kode berlaku **5 menit**; bila kedaluwarsa, minta kode baru (tombol kirim ulang).
5. Pilih repo **cutlesshairstudio** dan pastikan branch **`main`** (lihat nama branch di kiri atas).

**Pemilik, lewat GitHub:**
1. Buka **https://app.pagescms.org** → **Sign in with GitHub** → izinkan akses (sekali saja).
2. Pilih repo **cutlesshairstudio** → branch **`main`**.

Menu konten ada di kiri: **Cabang, Daftar Harga, Barber, Galeri, Hero, Tentang Kami, Kartu Studio, CTA Penutup, Kartu Layanan, Logo Partner, Partner Cuci Sepatu, Promo, Pengumuman, Testimoni, Produk, Tips & Trik, Pengaturan Situs**.

### Yang bisa dan tidak bisa dilakukan collaborator

| Bisa | Tidak bisa (hanya pemilik dengan akun GitHub) |
|---|---|
| Mengedit semua menu konten di atas (harga, barber, promo, pengumuman, galeri, dll.) | Mengubah pengaturan panel (`.pages.yml`): menambah/menghapus menu atau kolom |
| Menambah, mengubah, dan menghapus entri sesuai menu | Mengundang atau menghapus collaborator lain |
| Upload, ganti, dan hapus foto/video di folder media | Mengelola cache panel |
| Menyimpan ke branch (gunakan **`main`** setelah launch) | Mengakses repo lain selain **cutlesshairstudio** |

Setiap **Save** tercatat atas **nama dan email pengedit** di riwayat perubahan (GitHub), jadi pemilik bisa melihat siapa mengubah apa dan kapan.

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
3. Isi **Nama cabang**, **Kota**, **Provinsi**, **Alamat lengkap**, **Kode pos**, **Link Google Maps**. Contoh cabang Cibubur:
   - **Alamat lengkap**: `Jl. Alternatif Cibubur No.87, Harjamukti, Kec. Cimanggis` (jalan + kelurahan + kecamatan). Tampil apa adanya di website. Boleh juga ditulis lengkap sampai `…, Kota Depok, Jawa Barat 16454`: untuk Google, kota, provinsi, dan kode pos di akhir alamat dipisahkan otomatis.
   - **Kota**: `Depok` (tanpa kata *Kota*). Kolom ini juga dipakai untuk pengelompokan di pemilih cabang dan teks *Hair studio di …*.
   - **Provinsi**: `Jawa Barat`.
   - **Kode pos**: `16454` (5 digit angka, opsional). Untuk data alamat di Google. Kosong = diambil dari 5 digit di akhir Alamat lengkap, bila ada.
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

### Melengkapi halaman cabang (deskripsi, area, fasilitas, FAQ)

Kolom di bawah ini opsional, tampil di halaman cabang (`/cabang/<slug>/`) walau halaman layanan dimatikan, dan dibaca Google & asisten AI. Membantu orang yang mencari *barbershop di Bantarjati*, *barbershop buka sampai malam*, *barbershop yang bisa QRIS*, dll. **Kolom kosong tidak ditampilkan. Isi hanya yang benar.**

- **Deskripsi cabang** (maks. 500 karakter): 2–3 kalimat untuk pengunjung, sebut area sekitar secara alami, mis. *Cutless Bogor Bantarjati ada di Jl Pandawa Raya, dekat … Cocok untuk warga Bantarjati, Bogor Utara, dan Tanah Sareal.* Jangan menumpuk kata kunci.
- **Area yang dilayani** (maks. 12 area, 40 karakter per area): kelurahan/kecamatan/kota yang memang dekat, satu per baris, mis. *Bantarjati*, *Bogor Utara*.
- **Patokan & cara menuju** (maks. 400 karakter): patokan yang mudah dikenali, mis. *seberang minimarket X, masuk gang di samping masjid*.
- **Fasilitas & pembayaran**: centang yang memang tersedia (walk-in, parkir motor/mobil, AC, Wi-Fi, toilet, ruang tunggu, tunai, QRIS, kartu debit/kredit, transfer bank). Tampil dengan ikon.
- **FAQ cabang** (maks. 5; pertanyaan 120, jawaban 400 karakter): pertanyaan yang sering ditanyakan khusus cabang ini, mis. *Apakah ada parkir mobil?*
- **Jam buka** tidak perlu diketik lagi: bila semua hari jamnya sama, halaman cabang otomatis menandai *Buka sampai 21.00* dan *Setiap hari 09.00–21.00*.

Bila **Tampilkan halaman layanan** aktif, halaman cabang juga menampilkan **Layanan di cabang ini** (otomatis dari halaman layanan Terbit yang tersedia di cabang itu).

---

## 1. Mengubah harga

Daftar Harga tampil dalam **3 kategori** (urutan ini): **Haircut**, **Special Treatment**, **Woman Haircut & Treatment**. Harga ditulis singkat dengan akhiran **K** tanpa "Rp": `100000` tampil **100K**, `1500000` tampil **1500K**.

1. Klik **Daftar Harga** → buka layanan yang mau diubah, misalnya *White Grooming*.
2. Ubah **Harga utama (Rupiah)**: tulis **angka saja, tanpa titik dan tanpa "Rp"**. Contoh: `100000` (tampil *100K*). Harga utama berlaku di **semua cabang**, kecuali cabang yang diisi di **Harga per cabang** (lihat di bawah).
3. Klik **Save**.

Lainnya:
- **Harga mulai**: aktifkan bila harga bisa lebih mahal. Tampil label kecil **Start from** sebelum harga, mis. *Start from 400K*.
- **Keterangan**: baris kecil di bawah nama layanan, mis. *Haircut + Hair Wash*. Kosongkan bila tidak perlu (tidak tampil).
- **Kategori**: pilih salah satu dari 3 kategori di atas. Kategori lama (*Haircut & Grooming, Wanita, Treatment, Coloring, Perming, Braids & Dreadlock, Shaving, Kids*) hanya untuk item **nonaktif** yang disimpan; bila item lama dinyalakan lagi, pindahkan dulu ke salah satu dari 3 kategori.
- **Label khusus**: *Best Seller*, *Baru*, atau *Promo*. Kosongkan bila tidak perlu.
- **Urutan**: angka kecil tampil lebih dulu (pakai kelipatan 10 agar mudah menyisipkan: 10, 20, 30).
- **Tambah layanan**: **Add an entry** → isi nama, kategori, harga → **Save**.
- **Menyembunyikan layanan**: matikan **Aktif** (data tidak hilang).
- **Paket/membership**: pilih kategori **Paket** (tetap tampil dalam Rupiah biasa). Di **Keterangan**, tulis isi paket **satu poin per baris**:
  ```
  4x Signature Haircut
  Berlaku 60 hari
  Prioritas jadwal booking
  ```
  Paket berlabel *Best Seller* tampil sebagai kartu yang menonjol.

### Harga per cabang & "Tersedia di cabang"

Saat ini semua cabang memakai **Harga utama**. Harga per cabang diisi hanya bila harga di suatu cabang **berbeda**:

1. **Daftar Harga** → buka layanannya, mis. *Black Grooming*.
2. **Harga per cabang** → **Add an entry** → pilih **Cabang** (mis. *Cibubur*) → isi **Harga di cabang ini** dengan angka saja tanpa titik, mis. `185000` → **Save**.
3. Harga itu **menimpa Harga utama untuk cabang tersebut saja**; cabang lain tetap memakai Harga utama. Ulangi untuk cabang lain bila perlu (satu baris per cabang). Label **Start from** (kolom *Harga mulai*) dan format *K* berlaku juga untuk harga per cabang.
4. Kembali ke harga utama: hapus baris cabang itu dari **Harga per cabang** → **Save**.

**Tersedia di cabang** (pilihan ganda): kosongkan bila layanan ada di **semua cabang** (bawaan). Pilih satu atau beberapa cabang bila layanan **hanya ada di cabang tertentu**; di cabang lain layanan itu disembunyikan dari Daftar Harga dan dari halaman cabangnya. Jangan sampai satu cabang Aktif tidak punya layanan sama sekali: website **tidak akan diperbarui** di produksi sampai diperbaiki (lihat *Jika Save ditolak*).

**Kapan pemilih cabang muncul di Daftar Harga (beranda)?**
- Selama **semua cabang Aktif** punya layanan dan harga yang **sama persis**, pemilih cabang **tidak tampil** dan labelnya *Berlaku di semua cabang*.
- Begitu **satu** harga cabang berbeda, atau **satu** layanan tidak tersedia di suatu cabang, pemilih cabang (mis. *Bogor Bantarjati | Cibubur*) **otomatis tampil** di atas daftar, dengan label *Harga cabang [nama]*. Pemilih ini sama dengan pilihan cabang di navbar: mengganti salah satunya ikut mengganti yang lain. Pengunjung yang belum memilih cabang melihat harga cabang Aktif pertama.
- Halaman cabang (`/cabang/<nama-cabang>/`) selalu menampilkan harga cabang itu saja, tanpa pemilih. Harga ini juga dipakai Google (rentang harga cabang).
- Kartu Layanan tetap tanpa harga.

---

## 1a. Kartu Layanan (section Layanan & daftar layanan di Lokasi)

Menu **Kartu Layanan** mengatur kartu di section **Layanan** dan daftar layanan cabang di section **Lokasi**. Kartu bersifat **deskriptif dan tidak menampilkan harga** (harga hanya di Daftar Harga).

Kolom tiap kartu:
- **Judul kartu** (wajib, maks. 40), mis. *Coloring*. Ikut tertulis di pesan WhatsApp tombol **Booking**.
- **Deskripsi** (wajib, maks. 160): sebutkan layanan yang memang tersedia, mis. *Cornrow, braids box (non-extension), dan dreadlock*. Jangan menyebut layanan yang sudah dinonaktifkan di Daftar Harga.
- **Ikon**, **Urutan** (angka kecil tampil lebih dulu), **Tampilkan**.
- **Kategori harga** (opsional): bila diisi, kartu menampilkan tautan **Lihat harga** yang menggulir ke kategori itu di Daftar Harga (di HP, tab kategori itu langsung terpilih). Tautan tidak tampil bila kosong atau kategorinya tanpa item aktif. Beberapa kartu boleh memakai kategori yang sama.

Deskripsi Google beranda & halaman cabang dibuat otomatis dari **kategori Daftar Harga yang punya item aktif** (maks. 160 karakter).

Kartu lama yang disembunyikan (Tampilkan mati, tidak dihapus): *Haircut + Wash, Shaving & Beard, Kids Haircut, Hair Spa, Hair Tattoo*.

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

## 3e. Logo Partner (pita logo di beranda)

Menu **Logo Partner** mengatur pita logo berjalan di beranda, tepat **sebelum CTA penutup** ("Kursimu sudah siap."). Gayanya sama dengan pita teks di hero.

- **Tampilkan pita logo**: matikan untuk menyembunyikan pita. Pita juga otomatis tidak muncul bila belum ada logo yang ditampilkan (tanpa ruang kosong).
- **Label kecil di atas pita** (opsional, maks. 40 karakter), mis. *Partner & Kolaborasi*. Kosongkan bila tidak perlu.

**Cara menambah logo partner:**
1. Buka **Logo Partner** → bagian **Logo** → **Add an entry**.
2. **Nama partner** (wajib, maks. 60): dipakai sebagai teks alternatif logo. Bila logo dikosongkan, nama ini yang tampil sebagai teks bergaris (seperti pita hero).
3. **Logo** (opsional): upload **PNG atau WebP berlatar transparan** (bukan SVG, bukan JPG berlatar putih), lebar minimal 400 px. Logo tampil **satu warna** senada pita dan kembali ke warna aslinya saat disentuh kursor di laptop. Website mengompresnya otomatis ke WebP 400 px.
4. **Link** (opsional): situs atau Instagram partner, harus diawali `https://`. Logo bisa diklik dan dibuka di tab baru. Kosong = tidak bisa diklik.
5. **Tampilkan** dan **Urutan** (angka kecil tampil lebih dulu), lalu **Save**. Tunggu ±2 menit, lalu cek beranda.

Catatan:
- Pasang **hanya logo partner yang sudah memberi izin**.
- 1–2 logo tampil diam di tengah; 3 logo atau lebih berjalan dan berhenti saat disentuh kursor. Pengunjung dengan pengaturan "kurangi gerakan" melihat deret diam yang bisa digeser.
- Halaman `/partner/` lama sudah dicabut (diarahkan ke beranda); arsipnya ada di branch `archive/partner-page` (tag `partner-page-v1`).

## 3f. Partner Cuci Sepatu (halaman /cuci-sepatu/)

Menu **Partner Cuci Sepatu** mengatur **halaman tersendiri** `/cuci-sepatu/` untuk partner jasa cuci sepatu di satu cabang (bawaan: **Bogor Bantarjati**), plus **kartu teaser kecil** setelah Daftar Harga di beranda dan di halaman cabang partner (tombol **Lihat Layanan** ke halaman).

Susunan halaman: **hero** (foto besar, isi rata tengah: logo, nama, tagline, badge *Tersedia di [cabang]*, tombol *Titip Sepatu via WhatsApp* & *Lihat Daftar Menu*) → **About Us** (judul, paragraf, foto, poin keunggulan) → **Layanan** (kartu dengan harga, tombol *Pesan via WhatsApp* per layanan) → **Galeri** hasil (klik foto untuk memperbesar; tidak tampil bila belum ada foto) → **tombol WhatsApp penutup** → **lokasi cabang & catatan** (alamat, jam buka, petunjuk arah, catatan/ketentuan).

**Tombol tampil/sembunyi:**
- **Tampilkan halaman**: mati = `/cuci-sepatu` dialihkan ke beranda, teaser, menu *Cuci Sepatu* (HP & footer), dan sebutan cuci sepatu di Google halaman cabang hilang. Halaman juga otomatis tidak tampil bila belum ada layanan yang ditampilkan. Halaman ikut **dikeluarkan dari situs & sitemap** (Google tidak lagi mengindeksnya); lihat catatan *Menyalakan/mematikan halaman* di §6 Mengelola produk.
- **Tampilkan teaser di beranda**: kartu teaser setelah Daftar Harga (beranda & halaman cabang partner).
- **Data demo**: lihat §3g.

**Format gambar yang bisa dipilih** (form hanya menampilkan file yang diterima, jadi website tidak gagal diperbarui karena jenis file):
- Foto biasa (Foto hero, Foto layanan, Foto hasil): **JPG, PNG, atau WebP**.
- Logo (Logo partner, Logo hero): **SVG, PNG, atau WebP** berlatar transparan.
- Foto About Us: **JPG, PNG, WebP, atau SVG** (boleh foto atau logo).
- File daftar menu: **PDF**. PNG yang diupload otomatis dikompres ke WebP; latar transparan tetap transparan.

**Cara mengisi:**
1. **Cabang**, **Nama partner** (wajib, maks. 60), **Teks kecil di atas judul hero** (opsional, maks. 40, bawaan *Cuci Sepatu*), **Logo** (SVG/PNG transparan), **Tagline** (maks. 120), **Deskripsi singkat** (maks. 300, tampil di hero).
   - **Teks kecil di atas judul hero**: tulisan kecil berhuruf kapital dengan garis di kiri-kanan, di atas nama/logo partner, mis. *Cuci Sepatu* atau *Partner Cuci Sepatu*. Teks yang sama tampil sebagai label kecil di kartu teaser beranda. **Kosongkan** untuk menyembunyikannya di hero (teaser kembali memakai *Cuci Sepatu*). Judul halaman di Google tidak berubah.
   - **Logo hero (versi terang untuk latar gelap)** (opsional): logo/wordmark **putih atau terang** berlatar transparan, **SVG** (paling tajam) atau **PNG lebar minimal 1200 px**, kompres di bawah 1 MB. Bila diisi, logo ini tampil **menggantikan nama partner** sebagai judul hero, setinggi huruf judul beranda, dan logo kecil di atas teks kecil hero otomatis disembunyikan (tidak dobel). Nama partner tetap dipakai untuk Google & pembaca layar. Kosong = nama partner tampil sebagai teks seperti biasa. Logo gelap/berwarna pekat tidak akan terbaca di atas foto gelap: pakai versi putih.
2. **Foto hero**: foto lebar minimal 1920 px. Kosong = foto hasil pertama, lalu foto CTA penutup. Dipakai juga sebagai gambar saat link dibagikan (WhatsApp/sosial media).
3. **About Us**: **Judul** (opsional, maks. 60; kosong = *Tentang [nama partner]*), **Paragraf** (1–3, maks. 400 per paragraf), **Foto** (opsional, foto atau logo; **Deskripsi foto** wajib bila foto diisi, maks. 150).
   - **Tampilkan tanpa bingkai (untuk logo transparan)**: aktifkan bila Foto About Us berupa **logo berlatar transparan** (SVG/PNG). Logo tampil utuh tanpa kotak, latar, atau sudut membulat, rata tengah di atas warna section (tinggi maks. ±320 px di desktop, lebih kecil di HP). Matikan untuk **foto biasa**: foto tampil di dalam bingkai seperti biasa. Logo berwarna gelap cocok di sini (latar section terang); jangan memakai logo putih.
4. **Keunggulan**: 2–4 poin (judul maks. 40, deskripsi maks. 120, ikon).
5. **Layanan**: 1–8 layanan: nama (maks. 40), deskripsi (maks. 120), **Harga** (opsional, maks. 20), estimasi waktu (maks. 30), **ikon atau foto** opsional, **Tampilkan**, **Urutan**.
   - **Harga** ditulis seperti Daftar Harga: angka + **K**, mis. `45K`, `100K`, atau rentang `70–120K` (boleh diketik `70-120K`, tampil `70–120K`). Tanpa `Rp`, titik, atau spasi sebelum K. Kosong = kartu menampilkan teks kecil *Lihat di daftar menu* (link ke daftar menu; tidak tampil bila daftar menu juga kosong). Teaser di beranda tidak menampilkan harga.
   - **Memilih layanan yang tampil**: matikan **Tampilkan** untuk menyembunyikan layanan tanpa menghapusnya (mis. layanan musiman); nyalakan lagi kapan saja. **Urutan**: angka kecil tampil lebih dulu (mis. 10, 20, 30, …; beri jarak agar mudah menyisipkan layanan baru). Desktop menampilkan 3 kartu per baris (baris terakhir di tengah), tablet 2, HP 1. Layanan lain yang tidak dijadikan kartu (paket kombinasi, tas, topi, dompet) cukup ada di daftar menu: di bawah kartu otomatis tampil *Layanan lain … ada di daftar menu* + tombol *Lihat Daftar Menu*.
6. **Daftar menu**: tombol *Lihat Daftar Menu* (hero, bawah kartu layanan, dan link *Lihat di daftar menu*) dibuka di tab baru. Urutan pemakaian: **File daftar menu (PDF)** → bila kosong **Link Daftar Menu** → bila keduanya kosong, tombol tidak tampil.
   - **Mengganti PDF daftar menu**: siapkan PDF baru **maksimal ±3 MB** (lebih besar = website **tidak** diperbarui dan versi lama tetap tayang; kompres dulu, mis. ekspor ulang dengan kualitas gambar lebih rendah). Beri nama file jelas tanpa spasi, mis. `daftar-menu-fotless-2026-11.pdf`. Di **Partner Cuci Sepatu → File daftar menu (PDF)** klik ikon file → **Upload** → pilih PDF → pilih file itu → **Save**. Hanya file `.pdf` yang bisa dipilih. Setelah tayang (lihat *Setelah Save*), buka `/cuci-sepatu/` → *Lihat Daftar Menu* dan pastikan PDF baru yang terbuka. PDF lama boleh dihapus dari menu **Media → Daftar Menu Cuci Sepatu (PDF)** setelah tidak dipakai lagi.
   - **Link Daftar Menu** (opsional, dipakai bila PDF kosong): harus diawali `https://` (boleh link **Google Drive**: buka file → *Bagikan* → *Siapa saja yang memiliki link* → salin).
7. **Foto hasil** (0–8, dengan izin partner; deskripsi foto wajib), **Catatan / ketentuan** (maks. 160 per poin).
8. **Nomor WhatsApp partner** (opsional, `628xxxxxxxxxx`; kosong = nomor WhatsApp cabang di atas).
9. **Template pesan WhatsApp** (maks. 500). Placeholder (huruf kecil persis): `{partner}` = nama partner, `{service}` = nama layanan (tombol umum: *layanan cuci sepatu*), `{branch}` = nama cabang. Pertahankan penanda `(via website Cutless)` agar pesanan dari website bisa dikenali partner.

Setelah **Save**, tunggu ±2 menit, lalu buka `/cuci-sepatu/` dan beranda. Judul Google halaman: *Cuci Sepatu [nama partner] di Cutless [cabang]*; deskripsinya dari tagline + nama layanan.

## 3g. Data demo (hapus/matikan sebelum launch)

Beberapa isian di **staging** sengaja diisi **data dummy** agar section bisa didemokan ke klien sebelum konten asli tersedia. Isian ini ditandai centang **Data demo (hapus/matikan sebelum launch)**:
- di staging dan saat pengembangan muncul badge kecil kuning **DEMO** di sampingnya;
- **website asli (produksi) menolak tayang** selama masih ada data demo yang tampil. Build gagal dengan pesan *"data demo masih tayang: hapus atau matikan Data demo …"* yang menyebut isian mana saja. Badge **STAGING** di pojok layar juga menghitungnya sebagai *belum siap*.

**Data demo saat ini (staging):**

| Menu | Isian demo |
|---|---|
| Partner Cuci Sepatu | Seluruh section: nama *Cuci Sepatu Bogor (Demo)*, 3 keunggulan, 4 layanan fiktif (Fast Clean, Deep Clean, Unyellowing, Repaint), 3 catatan ketentuan. Tanpa logo & foto; nomor WhatsApp partner kosong (memakai WhatsApp cabang Bogor Bantarjati) |
| Logo Partner | 4 logo teks: *Partner Demo A*, *Partner Demo B*, *Partner Demo C*, *Partner Demo D* (tanpa gambar & link) |

**Cara menghapus atau mematikan sebelum launch:**
- **Partner Cuci Sepatu**, pilih salah satu:
  - *Sudah ada data partner asli*: ganti nama, keunggulan, layanan, harga, catatan, (opsional) logo, foto, dan nomor WhatsApp partner → **hilangkan centang Data demo** → **Save**.
  - *Belum ada partner*: **hilangkan centang Tampilkan halaman** → **Save** (halaman dialihkan ke beranda; teaser, menu *Cuci Sepatu*, dan sebutan di Google hilang; data tetap tersimpan untuk nanti).
- **Logo Partner**: hapus keempat entri *Partner Demo A–D* (ikon tempat sampah), atau matikan **Tampilkan** pada tiap entri → **Save**. Tambahkan logo partner asli seperti biasa (tanpa centang Data demo). Bila belum ada logo asli, pita logo otomatis tidak tampil.
- Cek: badge **STAGING** tidak lagi menyebut data demo, dan tidak ada badge **DEMO** di beranda.

> Jangan pernah membuat testimoni, rating, ulasan, atau nama orang/brand nyata sebagai data demo.

## 3h. FAQ (tanya-jawab di beranda)

Menu **FAQ (tanya-jawab)** mengatur bagian FAQ di beranda (tepat sebelum **Lokasi**). Isinya juga dibaca Google dan asisten AI (ChatGPT, Gemini, Perplexity) sebagai jawaban resmi, jadi **tulis hanya fakta yang benar**.

- **Tampilkan FAQ**: bawaan **mati**. Nyalakan setelah semua jawaban dicek. Mati = bagian FAQ dan ringkasannya untuk Google tidak ada.
- **Judul bagian** (wajib, maks. 80) dan **Teks kecil di atas judul** (opsional, maks. 40).
- **Tanya-jawab** (maks. 12): **Pertanyaan** (wajib, maks. 120), **Jawaban** (maks. 500), **Tampilkan**, **Urutan** (angka kecil tampil lebih dulu).
  - Pertanyaan **tanpa jawaban tidak tampil**. Simpan pertanyaan yang jawabannya belum pasti dengan **Tampilkan** mati, lalu isi jawabannya setelah dikonfirmasi.
  - Bila harga, alamat, atau jam buka berubah, perbarui juga jawaban FAQ yang menyebutnya (FAQ tidak ikut berubah otomatis).
- Website utama memeriksa FAQ saat build: bila **Tampilkan FAQ** aktif tetapi ada pertanyaan aktif yang jawabannya kosong, website **tidak** diperbarui sampai jawabannya diisi atau pertanyaannya dimatikan.

## 3i. Video (Reel Instagram di beranda)

Menu **Video (Instagram)** mengatur bagian Video di beranda (tepat setelah **Galeri**). Video tetap di Instagram (gratis, tanpa API). Website hanya menampilkan **foto sampul + tombol putar**, dan Instagram baru dimuat setelah pengunjung menekan tombol itu, jadi website tetap cepat.

- **Tampilkan bagian Video**: bawaan **mati**. Nyalakan setelah minimal 1 video diisi. Bila menyala tetapi tidak ada video yang **Tampilkan**-nya aktif, website **tidak** diperbarui sampai video ditambah atau bagian ini dimatikan.
- **Judul bagian** (wajib, maks. 80) dan **Teks kecil di atas judul** (opsional, maks. 40; kosong = *Video*).
- **Daftar video** (maks. **6**; di HP digeser ke samping, di desktop 3 kolom): **Link Instagram**, **Foto sampul**, **Keterangan**, **Tampilkan**, **Urutan** (angka kecil tampil lebih dulu).

### Menyalin link Reel

Hanya Reel atau postingan dari akun Instagram **publik** (akun privat tidak bisa diputar di website).

- **Aplikasi Instagram (HP):** buka Reel → ketuk ikon **pesawat kertas** (Bagikan) atau **•••** → **Salin tautan**.
- **Instagram di browser (laptop):** buka Reel → **•••** → **Salin tautan**, atau salin alamat dari kolom alamat browser.
- Tempel ke **Link Instagram**, mis. `https://www.instagram.com/reel/ABC123xyz/`. Semua bentuk ini diterima dan **dirapikan otomatis** menjadi `https://www.instagram.com/reel/<kode>/` (atau `/p/<kode>/` untuk postingan):
  - dengan atau tanpa `www.`, atau `m.instagram.com` (Instagram di browser HP);
  - `/reel/…`, `/reels/…`, atau `/p/…`, juga yang diawali nama akun, mis. `instagram.com/cutlesshairstudio/reel/ABC123xyz/`;
  - dengan bagian setelah tanda **?** (mis. `?igsh=MWx2c3...` atau `?utm_source=...`): dibuang otomatis.
- **Ditolak** (pesan error menyebut alasannya): link profil (`instagram.com/cutlesshairstudio/`), Story/Highlight (`instagram.com/stories/...`), link pendek `instagr.am/...`, link tanpa `https://`, atau link TikTok/YouTube.
- Bila Reel dihapus atau diarsipkan di Instagram, kartunya tetap tampil tetapi videonya tidak bisa diputar. Matikan **Tampilkan** atau hapus videonya dari daftar.

### Membuat foto sampul (wajib)

1. Putar Reel di HP, **jeda di frame terbaik** (wajah/hasil potongan jelas, tidak buram, tanpa teks Instagram di atasnya), lalu **screenshot**.
2. **Crop tegak rasio 9:16** (di galeri HP: Edit → Potong → pilih **9:16**). Buang bar status, tombol, dan keterangan Instagram dari tepi gambar.
3. Ukuran yang disarankan **1080 × 1920 px**. Format **JPG, PNG, atau WebP**, **maks. 1 MB** (kompres dulu bila lebih besar, mis. di squoosh.app).
4. Upload di **Foto sampul** (folder *Sampul Video Instagram*). Website mengompresnya otomatis ke WebP lebar maks. 800 px.

**Keterangan** (opsional, maks. 120) tampil di bawah kartu dan dibacakan pembaca layar, mis. `Proses skin fade di cabang Bogor`. Kosong = *video 1*, *video 2*, ...

Di bawah setiap kartu selalu ada link **Tonton di Instagram**, untuk pengunjung yang browsernya memblokir Instagram.

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

> **Menyalakan/mematikan halaman (Produk & Cuci Sepatu).** Mematikan **Pengaturan Situs → Tampilkan Produk** atau **Partner Cuci Sepatu → Tampilkan halaman** otomatis **mengeluarkan halaman itu dari situs dan dari sitemap.xml**: `/produk` atau `/cuci-sepatu` dialihkan permanen (301) ke beranda, menu & bagian di beranda hilang, dan Google berhenti mengindeksnya. Menyalakannya lagi mengembalikan halaman, menu, dan entri sitemap. Perubahan ini terjadi saat website dibangun ulang: di staging ±3–5 menit setelah Save di branch `staging`, di website utama setelah perubahan masuk ke `main` (Save di `main`, atau PR `staging → main` di-merge).


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

## 6a. Tips & Trik (artikel di /tips/)

Artikel seputar gaya rambut, perawatan, dan grooming. Tampil di halaman **/tips/**, halaman per kategori (mis. **/tips/kategori/hair-care/**, dibuat otomatis untuk kategori yang punya artikel Terbit), menu **Tips**, dan bagian **Tips Terbaru** (3 artikel) di beranda, setelah **Pengaturan Situs → Tampilkan Tips & Trik** dinyalakan. Selama mati, halaman /tips/ dialihkan ke beranda dan tidak masuk Google.

> **Selama fitur ini belum dirilis (sebelum versi 1.3.0):** tulis artikel di branch **staging** (app.pagescms.org → pilih branch *staging* di kiri atas), lalu cek hasilnya di URL staging. Setelah versi 1.3.0 dirilis, artikel cukup ditulis di branch **main** seperti konten lain. Dua artikel contoh berstatus **Draf** sudah tersedia untuk melihat formatnya.

### Menulis artikel

1. Klik **Tips & Trik** → **Add an entry**.
2. **Judul** (maks. 70 karakter): jelas dan spesifik, mis. *Cara Merawat Rambut Ikal agar Tidak Mengembang*. Saat artikel dibuat, nama file (alamat artikel, mis. `/tips/cara-merawat-rambut-ikal-agar-tidak-mengembang/`) dibuat otomatis dari judul. **Slug** boleh dikosongkan; isi hanya bila ingin alamat yang lebih pendek. Jangan ubah slug setelah artikel terbit (link yang sudah dibagikan jadi mati).
3. **Ringkasan** (maks. 160 karakter): 1–2 kalimat yang menjawab inti artikel. Tampil di kartu artikel dan di hasil Google.
4. **Kategori**: Hair Style, Hair Care, Grooming, Produk, atau Tips Barbershop.
5. **Penulis / ditinjau oleh** (opsional): pilih kapster yang menulis atau memeriksa isinya. Namanya tampil dengan link ke kartu kapster.
6. **Layanan terkait** (opsional): layanan yang dibahas; tampil di bawah artikel dengan link **Lihat harga**.
7. **Isi artikel**:
   - **Paragraf pertama langsung menjawab judul** (pembaca & Google sering hanya membaca bagian ini).
   - Pakai **Heading 2** untuk setiap poin. Artikel dengan 3 subjudul atau lebih otomatis mendapat **Daftar isi**.
   - **Ceritakan pengalaman kapster di studio**: kondisi rambut yang sering ditemui, kesalahan yang sering terjadi, saran yang biasa diberikan ke klien. Inilah yang membuat artikel berguna dan dipercaya.
   - **Jangan menyalin artikel dari website lain** (termasuk hasil terjemahan). Tulis dengan kata-kata sendiri.
   - Gambar di dalam isi boleh ditambahkan lewat tombol gambar di editor (foto asli studio; dikompres otomatis).
8. **Tanggal terbit**: tanggal artikel diterbitkan (artikel terbaru tampil paling atas). **Tanggal diperbarui**: isi hanya saat isinya diubah secara berarti.
9. **Save**. Status awal **Draf**.

### Poin penting (opsional)

Kotak ringkasan di bawah foto sampul, untuk pembaca yang ingin intinya saja. Isi **2–5 butir** (atau kosongkan), masing-masing **satu kalimat pendek** (maks. 140 karakter) yang bisa langsung dipraktikkan, mis. *Keramas 2–3 kali seminggu dengan sampo tanpa sulfat.* Jangan mengulang judul; tulis kesimpulan dari isi artikel.

### FAQ artikel (opsional)

Tanya jawab di akhir artikel (bisa dibuka-tutup) dan ikut dibaca Google. Isi **maks. 5** pertanyaan yang **benar-benar sering ditanyakan klien** di studio soal topik itu.

- **Pertanyaan** (maks. 120 karakter): tulis seperti klien bertanya, mis. *Berapa lama fade bertahan rapi?*
- **Jawaban** (maks. 400 karakter): kalimat pertama langsung menjawab, lalu penjelasan singkat. Jangan mengulang isi artikel kata per kata.

### Bio kapster (kotak penulis)

Bila **Penulis / ditinjau oleh** diisi, di akhir artikel tampil kotak penulis: foto, nama (link ke kartu kapster), jabatan, pengalaman, keahlian, bio singkat, dan tombol **Booking dengan [nama]**. Datanya diambil dari menu **Barber**:

- **Bio singkat** (maks. 200 karakter): 1–2 kalimat tentang keahlian & gaya kerja kapster, mis. *Spesialis fade & textured crop, senang membantu klien menemukan gaya yang mudah ditata sendiri.*
- **Pengalaman** (maks. 60 karakter): mis. *8 tahun sebagai hairstylist*. Isi hanya yang benar.
- **Spesialisasi**: dipakai sebagai daftar keahlian.

Kolom yang kosong tidak ditampilkan. Kotak penulis membantu pembaca (dan Google) tahu artikel ditulis oleh orang yang berpengalaman.

### Memilih foto sampul

- Foto **mendatar 16:9**, minimal **1600 × 900 px**, kompres di bawah 1 MB sebelum upload (dikompres otomatis ke WebP).
- Pakai foto **asli** studio atau klien (dengan izin), bukan foto dari internet.
- Objek utama di tengah: di kartu artikel, foto dipotong ke 16:9.
- Isi **Deskripsi foto sampul**: apa yang terlihat di foto, mis. *Hairstylist merapikan rambut ikal klien dengan diffuser*.

### Menerbitkan (Draf → Terbit)

1. Buka artikelnya → ubah **Status** menjadi **Terbit** → **Save**. Isi artikel wajib terisi.
2. Pastikan **Pengaturan Situs → Tampilkan Tips & Trik** sudah menyala (cukup sekali).
3. Artikel tampil setelah website dibangun ulang (±2 menit). Untuk menurunkan artikel sementara, ubah lagi ke **Draf**.

Bila Save berhasil tetapi website tidak berubah, lihat [Jika website tidak berubah setelah Save](#jika-website-tidak-berubah-setelah-save). Pesan seperti `tips/cara-…md: slug "…" sudah dipakai …` berarti dua artikel memakai alamat yang sama; ubah **Slug** salah satunya.

---

## 6b. Halaman layanan (/layanan/)

Satu halaman per layanan (mis. *Potong Rambut Wanita di Bogor & Cibubur*) agar mudah ditemukan di Google & asisten AI. Tampil di **/layanan/** (dikelompokkan per kategori Daftar Harga), menu **Layanan** mengarah ke /layanan/, dan baris **Daftar Harga** serta **Kartu Layanan** yang punya halaman diberi link **Selengkapnya**, setelah **Pengaturan Situs → Tampilkan halaman layanan** dinyalakan. Selama mati, /layanan/ dialihkan ke beranda dan tidak masuk Google.

> Empat halaman awal (Haircut pria, Potong rambut wanita, Hair treatment, Potong rambut anak) sudah tersedia berstatus **Draf**, ditulis hanya dari data yang sudah ada di website. Lengkapi bagian yang masih kosong, lalu terbitkan.

**Harga tidak diketik di halaman layanan.** Pilih item di **Layanan/harga terkait**; harga per cabang, "Start from", dan *Tersedia di cabang* diambil otomatis dari menu **Daftar Harga**. Ubah harga cukup di Daftar Harga, semua halaman ikut berubah.

### Menulis halaman layanan

1. Klik **Halaman Layanan** → **Add an entry**.
2. **Judul halaman** (maks. 70 karakter): sebut layanan & lokasi seperti dicari orang, mis. *Potong Rambut Wanita di Bogor & Cibubur*. Alamat halaman dibuat otomatis dari judul; **Slug** boleh dikosongkan. Jangan ubah slug setelah terbit.
3. **Meta description** (maks. 160 karakter): kalimat untuk hasil Google. Jangan tulis harga (harga bisa berubah).
4. **Layanan/harga terkait**: pilih item Daftar Harga. Kosong = tanpa harga & tersedia di semua cabang; isi **Catatan harga**, mis. *Harga menyesuaikan, tanyakan via WhatsApp cabang terdekat.*
5. **Kartu Layanan terkait** (opsional): kartu di bagian Layanan beranda yang diberi link **Selengkapnya** ke halaman ini.
6. **Ringkasan pembuka** (maks. 300 karakter): **langsung menjawab**: apa layanannya, di cabang mana, untuk siapa. Kalimat ini yang paling sering dikutip Google & AI.
7. **Cocok untuk** (2–6 butir, wajib sebelum Terbit), **Proses / langkah** (opsional, 2–8 langkah), **Durasi** (opsional, mis. *±45 menit*).
8. **Foto** (opsional, 0–6): foto asli hasil layanan di studio, 4:3, minimal 1200 × 900 px, dengan deskripsi foto.
9. **Isi tambahan** (opsional): penjelasan lebih panjang, pakai Heading 2 untuk subjudul. Tulis dari pengalaman di studio, jangan menyalin website lain.
10. **FAQ** (opsional, maks. 5): pertanyaan yang benar-benar sering ditanyakan klien soal layanan ini.
11. **Tanggal diperbarui** (opsional): isi saat isi halaman diubah secara berarti.
12. **Save**. Status awal **Draf** (belum tampil).

Tombol **Booking [nama layanan]** di halaman membuka pemilih cabang (hanya cabang tempat layanan tersedia), lalu WhatsApp cabang itu dengan pesan yang menyebut nama layanan.

### Menerbitkan (Draf → Terbit)

1. Ubah **Status** menjadi **Terbit** → **Save** (Cocok untuk minimal 2 butir).
2. Pastikan **Pengaturan Situs → Tampilkan halaman layanan** menyala (cukup sekali).
3. Halaman tampil setelah website dibangun ulang (±2 menit).

Pesan `layanan/…md: "…" tidak ada di Daftar Harga` berarti item yang dipilih sudah dihapus/diganti namanya di Daftar Harga; pilih ulang itemnya. Pesan `slug "…" sudah dipakai` berarti dua halaman memakai alamat yang sama.

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
| Alamat website (domain resmi) | Link yang dibagikan di Google/WhatsApp/sosial media. Ganti **hanya** saat pindah domain. Domain resmi: `https://cutlesshairstudio.com` (tanpa `/` di akhir), diisi saat launch setelah domain tersambung (lihat `docs/migrasi-akun-klien.md` → DNS) | wajib |
| Nomor WhatsApp pusat | Pertanyaan umum & kontak di footer. Booking memakai nomor cabang | wajib, format `628xxxxxxxxxx` |
| Pesan booking default | Pesan otomatis tombol booking. `{brand}` = nama usaha, `{branch}` = nama cabang | maks. **500** karakter (emoji dihitung 2) |
| Template pesan booking kapster | Pesan semua tombol **Booking [nama barber]**. Placeholder (huruf kecil): `{brand}` = nama usaha, `{branch}` = cabang barber, `{barber}` = nama barber yang diklik. Kosong = template bawaan (formulir reservasi). Tombol booking umum tetap memakai *Pesan booking default* | maks. **500** karakter (emoji dihitung 2); sisakan ruang untuk nama barber & cabang |
| Link Instagram / TikTok | Ikon sosial media di footer. **Kosongkan untuk menyembunyikan** | link lengkap `https://…` |
| Email | Baris email di footer. **Kosongkan untuk menyembunyikan** | format email valid, maks. 100 karakter |
| Tagline footer | Kalimat di bawah logo footer. Tulis `{cities}` untuk kota cabang otomatis, mis. *Hair studio di {cities}. Goodstyle, goodmood.* → *Hair studio di Bogor & Cibubur. …* | maks. **160** karakter |
| Angka statistik | Jumlah pelanggan, tahun berdiri, rating & jumlah ulasan Google. **Masing-masing punya tombol Tampilkan**; nyalakan hanya bila angkanya asli. Jumlah cabang dan hairstylist dihitung otomatis | |
| Tampilkan section Testimoni / Produk / Before-After | Menyalakan atau menyembunyikan section itu (beserta menunya) | |
| Tampilkan Tips & Trik | Halaman /tips/, menu Tips, & bagian Tips Terbaru di beranda (lihat [6a](#6a-tips--trik-artikel-di-tips)) | |
| Tampilkan halaman layanan | Halaman /layanan/, menu Layanan → /layanan/, & link Selengkapnya di Daftar Harga dan Kartu Layanan (lihat [6b](#6b-halaman-layanan-layanan)) | |
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
| Cabang | Kode pos | 5 digit angka | opsional |
| Cabang | Deskripsi cabang | 500 | opsional |
| Cabang | Area yang dilayani (per area) | 40 | opsional, maks. 12 |
| Cabang | Patokan & cara menuju | 400 | opsional |
| Cabang | FAQ cabang → Pertanyaan / Jawaban | 120 / 400 | opsional, maks. 5 |
| Daftar Harga | Nama layanan | 80 | wajib |
| Daftar Harga | Keterangan | 300 | opsional |
| Kartu Layanan | Judul kartu | 40 | wajib |
| Kartu Layanan | Deskripsi | 160 | wajib |
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
| Tips & Trik | Judul | 70 | wajib |
| Tips & Trik | Slug | 80 | opsional |
| Tips & Trik | Ringkasan | 160 | wajib |
| Tips & Trik | Deskripsi foto sampul | 150 | wajib |
| Tips & Trik | Poin penting (per butir) | 140 | opsional, 2–5 butir |
| Tips & Trik | FAQ artikel → Pertanyaan / Jawaban | 120 / 400 | opsional, maks. 5 |
| Halaman Layanan | Judul halaman | 70 | wajib |
| Halaman Layanan | Slug | 80 | opsional |
| Halaman Layanan | Meta description | 160 | wajib |
| Halaman Layanan | Catatan harga | 120 | opsional |
| Halaman Layanan | Ringkasan pembuka | 300 | wajib |
| Halaman Layanan | Cocok untuk (per butir) | 140 | 2–6 butir sebelum Terbit |
| Halaman Layanan | Proses / langkah (per langkah) | 160 | opsional, 2–8 langkah |
| Halaman Layanan | Durasi | 60 | opsional |
| Halaman Layanan | Foto → Deskripsi foto | 150 | wajib per foto, maks. 6 foto |
| Halaman Layanan | FAQ → Pertanyaan / Jawaban | 120 / 400 | opsional, maks. 5 |
| Barber | Bio singkat | 200 | opsional |
| Barber | Pengalaman | 60 | opsional |
| Pengaturan Situs | Nama usaha | 80 | wajib |
| Pengaturan Situs | Pesan booking default | 500 | opsional |
| Pengaturan Situs | Template pesan booking kapster | 500 (emoji dihitung 2) | opsional |
| Pengaturan Situs | Email | 100 | opsional |
| Pengaturan Situs | Tagline footer | 160 | opsional |
| Logo Partner | Label kecil di atas pita | 40 | opsional |
| Logo Partner | Logo → Nama partner | 60 | wajib |
| Partner Cuci Sepatu | Nama partner | 60 | wajib |
| Partner Cuci Sepatu | Tagline / Deskripsi singkat | 120 / 300 | opsional |
| Partner Cuci Sepatu | Keunggulan → Judul / Deskripsi | 40 / 120 | wajib (2–4 poin) |
| Partner Cuci Sepatu | Layanan → Nama / Deskripsi / Estimasi waktu | 40 / 120 / 30 | nama wajib (1–8 layanan) |
| Partner Cuci Sepatu | Judul About Us | 60 | opsional |
| Partner Cuci Sepatu | Paragraf About Us | 400 per paragraf | wajib (1–3 paragraf) |
| Partner Cuci Sepatu | Deskripsi foto About Us | 150 | wajib bila foto diisi |
| Partner Cuci Sepatu | Foto hasil → Deskripsi foto | 150 | wajib bila foto diisi |
| Partner Cuci Sepatu | Catatan / ketentuan | 160 per poin | opsional |
| Partner Cuci Sepatu | Template pesan WhatsApp | 500 | opsional |
| FAQ (tanya-jawab) | Teks kecil di atas judul / Judul bagian | 40 / 80 | judul wajib |
| FAQ (tanya-jawab) | Pertanyaan / Jawaban | 120 / 500 | pertanyaan wajib (maks. 12) |
| Video (Instagram) | Teks kecil di atas judul / Judul bagian | 40 / 80 | judul wajib |
| Video (Instagram) | Keterangan | 120 | opsional (link & foto sampul wajib, maks. 6 video) |

---

## Setelah Save

1. **Tunggu 3–5 menit.** Setiap Save memicu proses otomatis: foto baru dikompres, website dibangun ulang, lalu dipasang. Foto baru bisa butuh sedikit lebih lama (ada commit otomatis *"sinkron gambar"*; nama file foto bisa berubah menjadi `.webp`, itu normal).
2. Buka **hanya** alamat ini:
   - Website utama (branch `main`): **https://cutlesshairstudio.com** (satu-satunya alamat produksi; `www.` dialihkan ke sini, dan alamat lama `cutlesshairstudio.adi-yansyaaah.workers.dev` sudah tidak aktif).
   - Staging (branch `staging`, untuk uji coba, berlabel *STAGING*): **https://cutlesshairstudio-staging.adi-yansyaaah.workers.dev**
3. Tekan **Ctrl+F5** (Windows) / **Cmd+Shift+R** (Mac) agar browser tidak menampilkan versi lama. Di HP: tutup tab lalu buka lagi, atau pakai tab penyamaran.
4. **Abaikan alamat berkode versi**, mis. `https://3f9c1a2b-cutlesshairstudio-staging.….workers.dev` (dari email/notifikasi Cloudflare). Itu salinan satu versi tertentu, sering bukan yang terbaru.
5. Di staging, badge **STAGING** di pojok kiri atas menyebut jumlah isian yang *belum siap* tayang. Klik untuk melihat daftarnya.
6. Masih belum berubah setelah 10 menit? Lihat **Jika Save ditolak** dan **Bila ada masalah**.

> **Pages CMS sudah lama terbuka?** Bila developer baru saja mengubah kolom/menu, **muat ulang Pages CMS (Ctrl+F5) sebelum mengedit**. Editor yang masih memakai pengaturan lama bisa menolak Save atau tidak menampilkan kolom baru.

## Jika Save ditolak

Pesan muncul di pojok layar Pages CMS atau di bawah kolom (merah). Isian Anda **belum tersimpan**, jadi salin dulu teks panjang yang sudah diketik ke Notes sebelum memuat ulang.

| Pesan | Artinya | Cara memperbaiki |
|---|---|---|
| *Please fix the errors before saving* | Ada kolom yang belum benar | Gulir ke atas/bawah, cari kolom bertanda merah, baca pesan di bawahnya |
| *Content validation failed: Required at **nama-kolom*** | Editor memakai pengaturan lama, kolom yang sekarang dibutuhkan tidak terkirim | Salin teks yang sudah diketik → **Ctrl+F5** (muat ulang Pages CMS) → isi lagi → Save |
| *This field is required* / *Field requires at least one item* | Kolom wajib (bertanda *Required*) kosong / daftar wajib belum punya isian | Isi kolomnya, atau klik **Add an entry** |
| *Maximum length is N characters* | Teks terlalu panjang | Persingkat sampai di bawah N (emoji dihitung 2 karakter) |
| *Format harus 628xxxxxxxxxx* | Nomor WhatsApp salah format | Hanya angka, diawali `62`, tanpa `+`/spasi/strip |
| Save berhasil, tetapi website tidak berubah; pemeriksaan menyebut *cabang Aktif "…" tidak punya satu pun layanan di Daftar Harga* | Semua layanan diberi **Tersedia di cabang** yang tidak memuat cabang itu | Daftar Harga → kosongkan **Tersedia di cabang** (atau tambahkan cabang itu) pada minimal satu layanan aktif → Save |
| *Format harga: angka + K, mis. 45K atau 70–120K* | Harga layanan Cuci Sepatu ditulis dengan `Rp`, titik, atau spasi sebelum K | Tulis seperti `45K`, `100K`, `70–120K`; atau kosongkan |
| Save berhasil, tetapi website tidak berubah dan PDF daftar menu baru tidak tampil | PDF lebih dari ±3 MB (pembaruan website dibatalkan, versi lama tetap tayang) | Kompres PDF di bawah 3 MB, upload ulang, pilih file itu, Save |
| *Harus diawali https://* | Link tidak lengkap | Salin link lengkap dari browser (diawali `https://`) |
| *Placeholder yang boleh dipakai hanya …* | Template pesan memakai `{…}` yang tidak dikenal | Pakai hanya placeholder yang disebut di keterangan kolom, huruf kecil persis, mis. `{branch}` |
| *harus di folder media …* / *ekstensi … bukan gambar* | Foto diambil dari folder lain atau bukan gambar | Pilih/upload foto lewat tombol di kolom itu sendiri; JPG/PNG/WebP |
| Save berhasil, tetapi website tidak berubah setelah 10 menit | Isian lolos Pages CMS tetapi ditolak saat website dibangun (mis. data demo di website utama, deskripsi foto kosong, nomor contoh) | Website tetap menampilkan versi sebelumnya (aman). Lihat **Jika website tidak berubah setelah Save** |

## Cara memastikan perubahan sudah tayang

Edit konten di branch **`main`** langsung tayang di website utama, **bila lolos pemeriksaan otomatis**. Untuk memastikan:

1. Buka **https://github.com/rockshow02/cutlesshairstudio/commits/main**. Baris paling atas = Save terakhir (nama Anda + *via Pages CMS*).
2. Lihat ikon di baris itu (muncul ±1–5 menit setelah Save):
   - **✓ hijau**: lolos pemeriksaan. Website sudah/sedang diperbarui; buka https://cutlesshairstudio.com lalu tekan **Ctrl+F5**.
   - **● kuning**: masih diproses. Tunggu beberapa menit.
   - **✗ merah**: ditolak. **Website tidak berubah** (tetap versi sebelumnya). Lihat bagian berikut.
3. Versi website yang sedang tayang juga terlihat di Cloudflare: **Workers & Pages → cutlesshairstudio → Deployments** (baris teratas = versi aktif, beserta pesan commit-nya).

## Jika website tidak berubah setelah Save

Setiap Save di `main` diperiksa dua kali dengan aturan yang sama (ketat): oleh **Cloudflare** saat membangun website, dan oleh **GitHub (CI)**. Bila ada isian yang belum benar (mis. pertanyaan FAQ aktif tanpa jawaban, data demo masih tampil, nomor WhatsApp contoh, deskripsi foto kosong):

- Cloudflare **membatalkan pembaruan**; website **tetap menampilkan versi sebelumnya**. Pengunjung tidak melihat isian yang salah.
- Commit Anda di GitHub bertanda **✗ merah**.

**Memperbaiki:**

1. Di halaman commit GitHub, klik **✗** → **Details** pada pemeriksaan **CI / verify**.
2. Baca **ringkasan** di halaman itu (atau langkah merah *Validasi konten*). Pesannya menyebut file, entri, dan kolomnya, mis. `faq.json: pertanyaan 3 "…": aktif tetapi jawabannya kosong (isi jawaban atau matikan Tampilkan)`. Nama file menunjuk menu Pages CMS (`faq.json` = FAQ, `pricing.json` = Daftar Harga, `branches.json` = Cabang, dst.).
3. Betulkan isian itu di Pages CMS (branch **main**) → **Save**. Bila Save berikutnya bertanda ✓, semua perubahan yang tertunda ikut tayang.

Tidak menemukan penyebabnya? Hubungi developer dan sertakan tautan commit yang bertanda ✗.

## Mengembalikan perubahan (rollback)

**Isian konten salah, tetapi sudah tayang** (mis. harga keliru): cara tercepat adalah membetulkannya lagi di Pages CMS → Save. Riwayat isian lama bisa dilihat di GitHub: buka file konten (mis. `src/content/pricing.json`) → **History** → pilih commit → lihat isi sebelumnya.

**Website rusak setelah pembaruan dan perlu kembali SEKARANG** *(Owner)*:

1. Cloudflare → **Workers & Pages → cutlesshairstudio → Deployments**.
2. Pada versi sebelumnya yang masih benar: **⋯ → Rollback** → konfirmasi. Website kembali ke versi itu dalam hitungan detik.
3. **Penting:** rollback Cloudflare tidak mengubah isi GitHub. Save berikutnya di Pages CMS akan membangun ulang website dari isi GitHub, termasuk perubahan yang salah. Jadi segera betulkan isiannya lewat Pages CMS, atau minta developer membatalkan commit-nya (`git revert`, lihat CONTRIBUTING.md → *Rollback*), sebelum mengedit lagi.

## Melihat statistik pengunjung (Cloudflare Web Analytics)

Website utama mencatat statistik pengunjung lewat **Cloudflare Web Analytics** (gratis). Tidak memakai cookie dan tidak menyimpan data pribadi (nama, nomor HP, alamat IP), jadi tidak perlu pemberitahuan cookie. Yang dicatat hanya website utama; staging dan uji coba tidak ikut dihitung.

**Membuka statistik:**

1. Buka **https://dash.cloudflare.com** dan login dengan akun Cloudflare pemilik.
2. Di menu kiri: **Analytics & Logs → Web Analytics**.
3. Klik nama situs (**cutlesshairstudio.com**).
4. Pilih rentang waktu di kanan atas (mis. **Last 7 days** atau **Last 30 days**).

**Arti angka yang tampil:**

| Di dashboard | Artinya |
|---|---|
| **Visits** | Jumlah kunjungan: satu orang membuka website (dari Google, Instagram, link WhatsApp, dll.) |
| **Page views** | Jumlah halaman yang dibuka. Satu kunjungan bisa membuka beberapa halaman |
| **Path** | Halaman yang paling sering dibuka, mis. `/` = beranda, `/cabang/cibubur/` = halaman cabang Cibubur, `/tips/...` = artikel |
| **Referer** | Asal pengunjung, mis. `google.com`, `instagram.com`, `l.facebook.com`. Kosong = mengetik alamat langsung / dari aplikasi |
| **Country** | Negara pengunjung |
| **Device type**, **Browser** | HP atau komputer, dan browsernya |
| **Core Web Vitals** | Kecepatan website di HP/komputer pengunjung. Hijau (*Good*) = baik |

**Melihat satu halaman saja:** klik nama halaman di daftar **Path** (mis. `/cabang/cibubur/`) lalu pilih **Filter**: semua angka berubah hanya untuk halaman itu. Hapus filter dengan klik tanda **×** di atas grafik.

**Perlu diketahui:**

- Angka muncul beberapa menit setelah kunjungan.
- Angkanya sedikit lebih kecil dari jumlah pengunjung sebenarnya: pengunjung yang memakai pemblokir iklan, mematikan JavaScript, atau menutup halaman sebelum selesai terbuka tidak terhitung. Bandingkan dari minggu ke minggu, bukan angka persisnya.
- Klik tombol WhatsApp tidak dihitung di sini (hanya kunjungan halaman). Jumlah klik WhatsApp ada di halaman **/statistik/** (bagian berikut).
- Untuk laporan jangka panjang, catat angka penting (Visits, halaman teratas, asal pengunjung) setiap awal bulan.

**Memberi akses ke staf** *(Owner)*: Cloudflare → **Manage Account → Members → Invite**. Isi email staf dan pilih peran yang hanya bisa **melihat** analitik (mis. *Analytics*), bukan *Administrator*.

**Pengaturan sekali saja** *(Owner/developer)*: token situs sudah terpasang di website (file `.env.production`). Bila di halaman situs Web Analytics Cloudflare menawarkan pemasangan otomatis (*automatic setup*), biarkan memakai **JS snippet manual** agar kunjungan tidak terhitung dua kali. Statistik baru terisi setelah website tayang di **cutlesshairstudio.com**.

## Statistik klik WhatsApp (/statistik/)

Setiap klik tombol WhatsApp di website dihitung: berapa calon pelanggan yang menekan tombol booking/pesan, dari cabang mana, tombol apa, halaman mana, dan dari mana mereka datang. Tidak ada data pribadi yang disimpan (tanpa nomor HP, isi pesan, IP, atau cookie).

**Membuka:**

1. Buka **https://cutlesshairstudio.com/statistik/**.
2. Masukkan email Anda (harus sudah didaftarkan pemilik) → **Send me a code**.
3. Buka email, salin kode 6 digit → tempel → masuk. Login berlaku 24 jam.

Email belum terdaftar? Minta pemilik menambahkannya (docs/statistik-klik-wa.md → *Perawatan*). Muncul **Akses ditolak**: login ulang lewat alamat di atas.

**Isi halaman:**

| Bagian | Artinya |
|---|---|
| **Klik 7 hari / 30 hari terakhir** | Jumlah klik tombol WhatsApp sampai hari ini |
| **Klik di rentang ini** | Jumlah klik pada tanggal yang dipilih |
| **Klik per hari** | Grafik batang: makin tinggi = makin banyak klik hari itu. Sentuh/arahkan ke batang untuk melihat angkanya (di komputer) |
| **Per cabang** | Cabang tujuan WhatsApp. *Nomor pusat (tanpa cabang)* = tombol ke WhatsApp pusat, mis. *Tanya* di footer |
| **Per jenis tombol** | *Booking umum* (tombol Booking di menu, beranda, layanan, harga), *Tombol cabang* (halaman cabang), *Booking kapster* (kartu barber), *CTA artikel Tips*, *Partner Cuci Sepatu*, *Pesan produk*, *Promo* |
| **Per kapster** | Klik tombol booking di kartu tiap barber |
| **Per asal kunjungan** | Dari mana pengunjung datang sebelum klik: Google, Instagram, TikTok, dll. *Langsung / aplikasi* = mengetik alamat, bookmark, atau dari aplikasi chat |
| **Per halaman asal** | Halaman tempat tombol diklik, mis. `/` = beranda, `/cabang/cibubur/`, `/tips/...` |

**Memilih tanggal:** isi **Dari** & **Sampai** → **Terapkan**, atau tekan **7 hari**, **30 hari**, **90 hari**, **Bulan ini**. Maksimal 1 tahun sekali tampil. Tanggal memakai WIB.

**Unduh CSV:** tombol **Unduh CSV** menyimpan rincian rentang yang dipilih (per tanggal, jenis tombol, cabang, kapster, halaman, asal) untuk dibuka di Excel / Google Sheets.

**Perlu diketahui:**

- Klik = pengunjung **menekan** tombol WhatsApp, bukan pasti mengirim pesan. Bandingkan dengan jumlah chat yang masuk.
- Pengunjung yang mematikan JavaScript atau memakai pemblokir tertentu tidak terhitung; angkanya sedikit lebih kecil dari sebenarnya.
- Angka hari ini terus bertambah sampai pukul 24.00 WIB.

## Bila ada masalah

| Masalah | Solusi |
|---|---|
| Perubahan belum muncul | Tunggu 3–5 menit, tekan Ctrl+F5 di alamat website utama/staging (bukan alamat berkode versi). Masih belum? Lihat baris berikut |
| Perubahan tidak pernah muncul | Ada isian yang ditolak pemeriksaan (website tetap menampilkan versi sebelumnya, jadi aman). Lihat **Jika website tidak berubah setelah Save** |
| Kolom ditolak saat Save | Baca pesan merah di bawah kolom (mis. format nomor WA atau jam) |
| Nomor WA ditolak | Harus diawali `62`, hanya angka, mis. `628129876xxxx` |
| Website tidak berubah setelah menambah cabang | Pastikan cabang Aktif sudah punya nomor WA, jam buka, dan alamat, atau pakai status **Segera Dibuka** |
| Cabang baru tidak ada di pilihan Barber/Harga | Tunggu ±1 menit setelah menyimpan cabang, lalu refresh Pages CMS |
| Salah ubah / terhapus | Tenang, semua perubahan tercatat. Lihat **Mengembalikan perubahan (rollback)** |
| Tidak bisa login | Pastikan undangan kolaborator GitHub sudah di-*Accept* |

Setiap perubahan tercatat atas nama akun GitHub Anda (siapa mengubah apa dan kapan).

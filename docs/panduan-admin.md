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

Menu konten ada di kiri: **Cabang, Daftar Harga, Barber, Galeri, Hero, Tentang Kami, Kartu Studio, CTA Penutup, Kartu Layanan, Logo Partner, Partner Cuci Sepatu, Promo, Pengumuman, Testimoni, Produk, Pengaturan Situs**.

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
- **Tampilkan halaman**: mati = `/cuci-sepatu` dialihkan ke beranda, teaser, menu *Cuci Sepatu* (HP & footer), dan sebutan cuci sepatu di Google halaman cabang hilang. Halaman juga otomatis tidak tampil bila belum ada layanan yang ditampilkan.
- **Tampilkan teaser di beranda**: kartu teaser setelah Daftar Harga (beranda & halaman cabang partner).
- **Data demo**: lihat §3g.

**Cara mengisi:**
1. **Cabang**, **Nama partner** (wajib, maks. 60), **Logo** (PNG transparan/SVG), **Tagline** (maks. 120), **Deskripsi singkat** (maks. 300, tampil di hero).
   - **Logo hero (versi terang untuk latar gelap)** (opsional): logo/wordmark **putih atau terang** berlatar transparan, **SVG** (paling tajam) atau **PNG lebar minimal 1200 px**, kompres di bawah 1 MB. Bila diisi, logo ini tampil **menggantikan nama partner** sebagai judul hero, setinggi huruf judul beranda, dan logo kecil di atas *Cuci Sepatu* otomatis disembunyikan (tidak dobel). Nama partner tetap dipakai untuk Google & pembaca layar. Kosong = nama partner tampil sebagai teks seperti biasa. Logo gelap/berwarna pekat tidak akan terbaca di atas foto gelap: pakai versi putih.
2. **Foto hero**: foto lebar minimal 1920 px. Kosong = foto hasil pertama, lalu foto CTA penutup. Dipakai juga sebagai gambar saat link dibagikan (WhatsApp/sosial media).
3. **About Us**: **Judul** (opsional, maks. 60; kosong = *Tentang [nama partner]*), **Paragraf** (1–3, maks. 400 per paragraf), **Foto** (opsional; **Deskripsi foto** wajib bila foto diisi, maks. 150).
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
| Template pesan booking kapster | Pesan semua tombol **Booking [nama barber]**. Placeholder (huruf kecil): `{brand}` = nama usaha, `{branch}` = cabang barber, `{barber}` = nama barber yang diklik. Kosong = template bawaan (formulir reservasi). Tombol booking umum tetap memakai *Pesan booking default* | maks. **500** karakter (emoji dihitung 2); sisakan ruang untuk nama barber & cabang |
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

---

## Setelah Save

1. **Tunggu 3–5 menit.** Setiap Save memicu proses otomatis: foto baru dikompres, website dibangun ulang, lalu dipasang. Foto baru bisa butuh sedikit lebih lama (ada commit otomatis *"sinkron gambar"*; nama file foto bisa berubah menjadi `.webp`, itu normal).
2. Buka **hanya** alamat ini:
   - Website utama (branch `main`): **https://cutlesshairstudio.adi-yansyaaah.workers.dev** (atau domain resmi setelah launch).
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
| Save berhasil, tetapi website tidak berubah setelah 10 menit | Isian lolos Pages CMS tetapi ditolak saat website dibangun (mis. data demo di website utama, deskripsi foto kosong, nomor contoh) | Website tetap menampilkan versi sebelumnya (aman). Cek badge STAGING atau hubungi developer |

## Bila ada masalah

| Masalah | Solusi |
|---|---|
| Perubahan belum muncul | Tunggu 3–5 menit, tekan Ctrl+F5 di alamat website utama/staging (bukan alamat berkode versi). Masih belum? Lihat baris berikut |
| Perubahan tidak pernah muncul | Kemungkinan ada isian yang salah sehingga sistem menolak memperbarui website (website tetap menampilkan versi sebelumnya, jadi aman). Hubungi developer, atau cek pesan error di Cloudflare |
| Kolom ditolak saat Save | Baca pesan merah di bawah kolom (mis. format nomor WA atau jam) |
| Nomor WA ditolak | Harus diawali `62`, hanya angka, mis. `628129876xxxx` |
| Website tidak berubah setelah menambah cabang | Pastikan cabang Aktif sudah punya nomor WA, jam buka, dan alamat, atau pakai status **Segera Dibuka** |
| Cabang baru tidak ada di pilihan Barber/Harga | Tunggu ±1 menit setelah menyimpan cabang, lalu refresh Pages CMS |
| Salah ubah / terhapus | Tenang, semua perubahan tercatat. Hubungi developer untuk mengembalikan (rollback) |
| Tidak bisa login | Pastikan undangan kolaborator GitHub sudah di-*Accept* |

Setiap perubahan tercatat atas nama akun GitHub Anda (siapa mengubah apa dan kapan).

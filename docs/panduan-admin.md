# Panduan Admin Website Cutless Hair Studio

Panduan ini untuk pemilik dan staf. Tidak perlu keahlian teknis.

> **Booking online (staging):** cabang, hairstylist, jam kerja, dan harga dikelola di dashboard **/admin**, bukan lagi di Pages CMS. Lihat [panduan-admin-booking.md](panduan-admin-booking.md). Bagian Cabang, Barber, dan Daftar Harga di bawah berlaku untuk website produksi sampai booking online diluncurkan.

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
4. Menu konten ada di kiri: **Cabang, Daftar Harga, Barber, Galeri, Hero, Tentang Kami, Kartu Studio, Promo, Pengumuman, Testimoni, Produk, Pengaturan Situs**.

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
5. **Keterangan singkat** (opsional): tampil saat foto diperbesar.
6. **Save**.

Foto dari HP langsung bisa dipakai. Sistem otomatis mengompresnya beberapa menit setelah upload (Anda mungkin melihat perubahan kecil tercatat atas nama *github-actions*; itu normal).

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

> **Bila Cutless Shop sudah aktif** (dashboard `/admin` → Toko), produk, harga, dan stok dikelola di dashboard, bukan di sini; landing page membaca dari toko. Foto produk tetap diunggah di Pages CMS → Media. Lihat [panduan-admin-booking.md §8](panduan-admin-booking.md).

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

| Kolom | Dipakai untuk |
|---|---|
| Nama usaha | Judul website, pesan WhatsApp |
| Alamat website (domain resmi) | Link yang dibagikan di Google/WhatsApp/sosial media. Ganti **hanya** saat pindah domain, mis. `https://cutlesshairstudio.id` (tanpa `/` di akhir) |
| Nomor WhatsApp pusat | Pertanyaan umum & kontak di footer. Booking memakai nomor cabang. Format `628xxxxxxxxxx` |
| Pesan booking default | Pesan otomatis tombol booking. `{brand}` = nama usaha, `{branch}` = nama cabang |
| Link Instagram / TikTok | Ikon sosial media. **Kosongkan untuk menyembunyikan** |
| Teks footer | Kalimat di bawah logo footer |
| Angka statistik | Jumlah pelanggan, tahun berdiri, rating & jumlah ulasan Google. **Masing-masing punya tombol Tampilkan**; nyalakan hanya bila angkanya asli. Jumlah cabang dan hairstylist dihitung otomatis |
| Tampilkan section Testimoni / Produk / Before-After | Menyalakan atau menyembunyikan section itu (beserta menunya) |
| Tampilkan animasi pembuka | Logo Cutless beranimasi saat website pertama kali dibuka (sekali per kunjungan). Matikan bila tidak diinginkan |
| Video animasi pembuka (opsional) | Video pendek pengganti animasi logo: MP4/WebM tanpa suara, **maks. 500 KB**, ±1,5 detik. Kosongkan untuk memakai animasi logo |

**Save** setelah mengubah.

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

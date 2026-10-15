# Panduan Admin Website Cutless Hair Studio

Panduan ini untuk pemilik dan staf. Tidak perlu keahlian teknis.

**Alamat panel admin:** `https://cms.cutlesshairstudio.id/admin` *(alamat pasti diberikan developer)*

> Perubahan yang disimpan akan muncul di website paling lama **5 menit** kemudian. Untuk cek lebih cepat, buka website lalu tekan *refresh*.

---

## Sebelum mulai

- **Login** dengan email dan password Anda. Lupa password? Klik *Forgot your password?* di halaman login.
- **Ganti bahasa ke Indonesia:** klik nama Anda di pojok kiri bawah → **Profile** → **Interface language** → *Bahasa Indonesia* → **Save**.
- Semua konten ada di menu **Content Manager** (ikon pena di kiri).
- Setiap kolom punya keterangan kecil di bawahnya. Baca dulu bila ragu.
- **Owner** bisa mengubah semua menu di panduan ini. **Staff** hanya Daftar Harga, Galeri, dan Pengumuman.

---

## 1. Mengubah harga

1. **Content Manager** → **Daftar Harga**.
2. Klik layanan yang mau diubah, misalnya *Signature Haircut*.
3. Ubah **Harga (Rupiah)**: tulis angka saja, **tanpa titik dan tanpa "Rp"**. Contoh: `85000` (akan tampil *Rp 85.000*).
4. Klik **Save**.

Tips:
- **Harga mulai**: aktifkan bila harga bisa lebih mahal tergantung rambut. Website akan menulis *mulai Rp 150.000*.
- **Label khusus**: pilih *Best Seller*, *Baru*, atau *Promo* untuk menampilkan label kecil di samping nama.
- **Urutan**: angka kecil tampil lebih dulu.
- **Sembunyikan sementara**: matikan **Tampilkan di website**. Datanya tidak hilang.
- **Tambah layanan baru**: klik **Create new entry** di kanan atas, isi nama, kategori, harga, lalu **Save**.
- **Paket/membership**: pilih kategori **Paket**. Di kolom **Keterangan**, tulis isi paket **satu poin per baris**, misalnya:
  ```
  4x Signature Haircut
  Berlaku 60 hari
  Prioritas jadwal booking
  ```
  Paket dengan label *Best Seller* tampil sebagai kartu yang menonjol.

---

## 2. Menambah barber *(Owner)*

1. **Content Manager** → **Barber** → **Create new entry**.
2. Isi:
   - **Nama panggilan**, contoh `Raka`
   - **Jabatan** (boleh kosong), contoh `Senior Hairstylist`
   - **Foto**: klik kotak foto → **Add new assets** → pilih file dari komputer/HP → **Upload** → pilih foto → **Finish**. Gunakan foto **tegak** (potret), wajah jelas, latar rapi.
   - **Spesialisasi**: pisahkan dengan koma, contoh `Skin fade, Pompadour`
   - **WhatsApp pribadi** (boleh kosong): format `628xxxxxxxxxx`, **tanpa +, spasi, atau strip**. Bila diisi, tombol "Booking Raka" langsung ke nomor ini. Bila kosong, ke nomor utama studio.
   - **Urutan**: posisi tampil (1 = paling kiri).
3. Klik **Save**.

Barber resign? Matikan **Tampilkan di website**, tidak perlu dihapus.

---

## 3. Upload foto galeri

1. **Content Manager** → **Galeri** → **Create new entry**.
2. **Foto**: upload foto hasil potongan. Foto tegak otomatis tampil tinggi, foto lebar otomatis tampil lebar.
3. **Deskripsi foto** *(wajib)*: jelaskan isi foto dalam satu kalimat, contoh `Mid fade dengan textured crop, tampak samping`. Ini membantu Google dan pengunjung tunanetra.
4. **Gaya rambut**: pilih Fade, Pompadour, Crop, Coloring, Perming, atau Lainnya.
5. **Keterangan singkat** (opsional): tampil saat foto diperbesar.
6. Klik **Save**.

Tips foto: terang, fokus ke rambut, ukuran file di bawah 5 MB. Foto dari HP sudah cukup.

---

## 4. Membuat promo *(Owner)*

1. **Content Manager** → **Promo** → **Create new entry**.
2. Isi:
   - **Judul promo**, contoh `Diskon 20% Haircut Weekday`
   - **Deskripsi**: syarat singkat, contoh `Berlaku Senin–Kamis, tunjukkan postingan ini.`
   - **Gambar** (opsional): gambar lebar paling bagus.
   - **Teks tombol**, contoh `Ambil Promo`
   - **Pesan WhatsApp**: pesan otomatis saat pengunjung klik tombol. Tulis `{brand}` untuk nama studio dan `{promo}` untuk judul promo. Contoh:
     `Halo {brand}, saya mau pakai promo {promo} untuk [hari/jam].`
   - **Mulai** dan **Selesai**: tanggal & jam promo (WIB). **Selesai harus setelah Mulai**.
3. Klik **Save**, lalu klik **Publish**. Promo **tidak tampil sebelum di-Publish**.

Promo otomatis hilang dari website setelah tanggal selesai. Untuk menghentikan lebih cepat: matikan **Tampilkan di website** lalu **Save**, atau klik **Unpublish**.

---

## 5. Memasang pengumuman (mis. studio tutup)

Pengumuman tampil sebagai bar tipis di paling atas website. Pengunjung bisa menutupnya.

1. **Content Manager** → **Pengumuman** → **Create new entry**.
2. **Pesan**, maksimal 160 karakter. Contoh:
   `Studio TUTUP Senin, 20 Oktober untuk renovasi. Buka kembali Selasa pukul 10.00.`
3. **Jenis**:
   - **Tutup**: untuk libur/tutup (tampil paling menonjol)
   - **Jam Khusus**: mis. jam buka berubah saat Lebaran
   - **Info**: informasi umum
4. **Mulai tampil** / **Selesai tampil** (opsional). Contoh: mulai 18 Okt 08.00, selesai 21 Okt 10.00. Kosongkan bila ingin tampil sampai dimatikan manual.
5. Klik **Save**, lalu **Publish**.

Cara menurunkan pengumuman: klik **Unpublish**, atau matikan **Tampilkan di website**.
Bila Anda mengedit pesan pengumuman, pengunjung yang sudah menutupnya akan melihatnya lagi.

---

## 6. Pengaturan situs *(Owner)*

**Content Manager** → **Pengaturan Situs** (satu halaman saja):

| Kolom | Dipakai untuk |
|---|---|
| Nomor WhatsApp utama | **Semua** tombol booking. Format `628xxxxxxxxxx` |
| Pesan booking default | Pesan otomatis tombol booking umum |
| Link Instagram / TikTok | Ikon sosial media. **Kosongkan untuk menyembunyikan ikon** |
| Link Google Maps | Tombol "Petunjuk Arah" |
| Alamat lengkap | Footer & bagian Lokasi |
| Teks footer | Kalimat di bawah logo footer |
| Jam buka | Tabel jam di bagian Lokasi & footer. Satu baris per hari. Centang **Tutup seharian** untuk hari libur |

Klik **Save** setelah mengubah.

---

## Bila ada masalah

| Masalah | Solusi |
|---|---|
| Perubahan belum muncul | Tunggu 5 menit, lalu refresh website |
| Promo/pengumuman tidak muncul | Sudah **Publish**? **Tampilkan di website** aktif? Tanggal mulai sudah lewat dan tanggal selesai belum lewat? |
| "Tanggal selesai harus setelah tanggal mulai" | Periksa jam & tanggal Selesai |
| Nomor WA ditolak | Harus diawali `62`, hanya angka, contoh `6281234567890` |
| Menu Barber/Promo/Pengaturan tidak terlihat | Akun Anda role **Staff**. Minta Owner untuk mengubahnya |

Website tetap tampil walau panel admin sedang bermasalah (memakai data cadangan). Hubungi developer bila masalah berlanjut.

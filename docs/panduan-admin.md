# Panduan Admin Website Cutless Hair Studio

Panduan ini untuk pemilik dan staf. Tidak perlu keahlian teknis.

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
4. Menu konten ada di kiri: **Daftar Harga, Barber, Galeri, Promo, Pengumuman, Pengaturan Situs**.

Tips umum:
- Setiap kolom punya keterangan kecil di bawahnya. Baca dulu bila ragu.
- Daftar berisi beberapa entri (mis. harga). Klik entri untuk membuka, **Add an entry** untuk menambah, ikon tempat sampah untuk menghapus, tarik ikon titik-titik untuk mengubah urutan tampilan di panel.
- Jangan lupa klik **Save** di kanan atas.
- Ingin menyembunyikan sesuatu sementara? Matikan **Tampilkan di website** / **Aktif**. Datanya tidak hilang.

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

---

## 2. Menambah atau menonaktifkan barber

**Menambah:**
1. Klik **Barber** → **Add an entry**.
2. Isi **Nama panggilan** (mis. `Raka`) dan **Jabatan** (opsional, mis. `Senior Hairstylist`).
3. **Foto**: klik kotak foto → **Upload** → pilih foto dari HP/komputer. Pakai foto **tegak** (potret), wajah jelas. Foto otomatis dikecilkan, jadi tidak perlu diedit dulu.
4. **Spesialisasi**: pisahkan dengan koma, mis. `Skin fade, Pompadour`.
5. **WhatsApp pribadi** (opsional): format `628xxxxxxxxxx`, **tanpa +, spasi, atau strip**. Kosongkan untuk memakai nomor studio.
6. **Urutan**: posisi tampil (angka kecil = paling kiri).
7. **Save**.

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

## 4. Membuat promo

1. Klik **Promo** → **Add an entry**.
2. Isi:
   - **Judul promo**, mis. `Diskon 20% Haircut Weekday`
   - **Deskripsi**: syarat singkat
   - **Gambar** (opsional): gambar lebar paling bagus
   - **Teks tombol**, mis. `Ambil Promo`
   - **Pesan WhatsApp**: pesan otomatis saat tombol diklik. Tulis `{brand}` untuk nama studio dan `{promo}` untuk judul promo, mis. `Halo {brand}, saya mau pakai promo {promo} untuk [hari/jam].`
   - **Mulai** dan **Selesai**: tanggal & jam **WIB**. *Selesai* harus setelah *Mulai*.
3. **Save**.

Promo otomatis **muncul tepat pada jam mulai** dan **hilang setelah jam selesai**, tanpa perlu Anda lakukan apa pun. Untuk menghentikan lebih cepat: matikan **Aktif** → **Save**.

---

## 5. Memasang pengumuman (mis. studio tutup)

Pengumuman tampil sebagai bar tipis di paling atas website. Pengunjung bisa menutupnya.

1. Klik **Pengumuman** → **Add an entry**.
2. **Pesan** (maks. 160 karakter), mis.:
   `Studio TUTUP Senin, 20 Oktober untuk renovasi. Buka kembali Selasa pukul 10.00.`
3. **Jenis**: **Tutup** (paling menonjol), **Jam Khusus** (mis. jam Lebaran), atau **Info**.
4. **Mulai tampil / Selesai tampil** (opsional, WIB), mis. mulai 18 Okt 08:00, selesai 21 Okt 10:00. Kosongkan bila ingin tampil sampai dimatikan.
5. **Save**.

Menurunkan pengumuman: matikan **Aktif** → **Save** (atau hapus entrinya). Bila Anda mengubah isi pesan, pengunjung yang sudah menutupnya akan melihatnya lagi.

---

## 6. Pengaturan situs *(Owner)*

Klik **Pengaturan Situs**:

| Kolom | Dipakai untuk |
|---|---|
| Nomor WhatsApp utama | **Semua** tombol booking. Format `628xxxxxxxxxx` |
| Pesan booking default | Pesan otomatis tombol booking umum |
| Link Instagram / TikTok | Ikon sosial media. **Kosongkan untuk menyembunyikan** |
| Link Google Maps | Tombol "Petunjuk Arah" |
| Alamat lengkap | Footer & bagian Lokasi |
| Teks footer | Kalimat di bawah logo footer |
| Jam buka | Satu baris per hari. Jam format 24 jam (`10:00`, `21:00`). Centang **Tutup seharian** untuk hari libur |

**Save** setelah mengubah.

---

## Bila ada masalah

| Masalah | Solusi |
|---|---|
| Perubahan belum muncul | Tunggu 2 menit, refresh website. Masih belum? Lihat baris berikut |
| Perubahan tidak pernah muncul | Kemungkinan ada isian yang salah sehingga sistem menolak memperbarui website (website tetap menampilkan versi sebelumnya, jadi aman). Hubungi developer, atau cek pesan error di Cloudflare |
| Kolom ditolak saat Save | Baca pesan merah di bawah kolom (mis. format nomor WA atau jam) |
| Nomor WA ditolak | Harus diawali `62`, hanya angka, contoh `6281234567890` |
| Salah ubah / terhapus | Tenang, semua perubahan tercatat. Hubungi developer untuk mengembalikan (rollback) |
| Tidak bisa login | Pastikan undangan kolaborator GitHub sudah di-*Accept* |

Setiap perubahan tercatat atas nama akun GitHub Anda (siapa mengubah apa dan kapan).

# Panduan Dashboard Booking (untuk owner, admin cabang, dan hairstylist)

Dashboard: **https://<alamat-website>/admin** (staging: https://cutlesshairstudio-staging.adi-yansyaaah.workers.dev/admin)

## Masuk

1. Buka alamat dashboard. Muncul halaman login Cloudflare.
2. Masukkan **email yang didaftarkan owner** → cek email → masukkan **kode 6 digit** (atau pilih login Google bila tersedia).
3. Dashboard terbuka. Nama dan peran Anda tampil di kanan atas.

Tidak bisa masuk? Minta owner menambahkan email Anda (owner: *Pengaturan → Akun admin* **dan** daftar email di Cloudflare Access).

| Peran | Bisa apa |
|---|---|
| **Owner** | Semua cabang, semua menu, termasuk akun admin dan harga dasar |
| **Admin cabang** | Semua urusan cabangnya: jadwal, booking walk-in, pelanggan, libur/cuti, hairstylist, harga cabang, pengaturan cabang |
| **Hairstylist** | Melihat jadwalnya sendiri, menandai **Selesai** / **Tidak datang**, mengajukan cuti |

---

## 1. Jadwal

- **Harian**: satu kolom per hairstylist. **Mingguan**: daftar per hari. Ganti tanggal dengan ◀ ▶ atau kalender, tombol **Hari ini** untuk kembali.
- Warna garis kiri kartu: hijau = terkonfirmasi, kuning = menunggu konfirmasi, hitam = selesai, abu-abu = batal/tidak datang.
- Halaman **memperbarui sendiri setiap 30 detik**. Booking baru memunculkan tombol merah **"N booking baru"** dan angka di judul tab browser. Klik untuk menandai sudah dilihat.
- Klik kartu untuk detail: layanan, harga, pelanggan, catatan. **Nomor WhatsApp pelanggan bisa diklik** untuk chat langsung.

### Aksi pada booking

| Tombol | Kapan dipakai |
|---|---|
| **Konfirmasi** | Hanya untuk cabang dengan konfirmasi manual. Booking "Menunggu konfirmasi" yang tidak dikonfirmasi dalam 2 jam (atau kurang dari 1 jam sebelum jadwal) **dibatalkan otomatis** |
| **Selesai** | Setelah pelanggan selesai dilayani (aktif setelah jam mulai) |
| **Tidak datang** | Pelanggan tidak datang. Aktif **15 menit setelah jam mulai**. 3 kali tidak datang → akun otomatis tidak bisa booking online |
| **Pindah jadwal** | Pilih hairstylist, tanggal, dan jam baru. Jam yang bentrok tidak akan muncul |
| **Batalkan** | Wajib isi alasan. Jam langsung bisa dibooking orang lain |
| **Catatan admin** | Catatan internal (tidak terlihat pelanggan) |

## 2. Booking baru (walk-in / telepon)

1. Pilih **layanan**, **hairstylist** (atau "Siapa saja"), **tanggal** dan **jam**.
2. **Tamu (tanpa akun)**: isi nama dan nomor WhatsApp. Tamu tidak dibuatkan akun login.
   **Pelanggan terdaftar**: cari nama/nomor/email lalu pilih.
3. Pilih **Sumber**: Walk-in (datang langsung) atau Telepon/WhatsApp.
4. **Buat booking**. Kode booking tampil di atas.

## 3. Pelanggan

- Cari dengan nama, nomor WhatsApp (boleh 08…), atau email. Kosongkan lalu **Cari** untuk melihat pelanggan terbaru.
- **Detail**: riwayat booking dan jumlah **tidak datang**.
- **Blokir**: pelanggan tidak bisa booking online (dan langsung keluar dari akunnya).
- **Buka blokir**: akun aktif lagi dan hitungan tidak datang kembali 0.

## 4. Ringkasan & ekspor

- Booking hari ini dan 7 hari ke depan per cabang, tingkat tidak datang 30 hari terakhir, layanan terpopuler, jumlah booking menunggu konfirmasi.
- **Ekspor CSV**: pilih rentang tanggal → **Unduh CSV** → buka di Excel/Google Sheets. File berisi nomor pelanggan: simpan dengan aman dan jangan disebarkan.

## 5. Libur & cuti

- **Libur cabang / hari raya**: seluruh cabang tidak bisa dibooking pada rentang itu.
- **Cuti / sakit hairstylist**: hanya hairstylist tersebut yang tidak bisa dibooking.
- Seharian: biarkan jam 00:00 – 23:59.
- Hairstylist bisa **mengajukan** cuti sendiri; statusnya *Menunggu persetujuan* sampai admin cabang/owner menekan **Setujui**. Sebelum disetujui, jadwalnya masih bisa dibooking.
- **Penting:** booking yang sudah ada di rentang libur/cuti **tidak** otomatis dibatalkan. Cek tab Jadwal, lalu pindahkan atau batalkan (pelanggan bisa di-chat lewat nomornya).

## 6. Pengaturan

### Cabang
| Isian | Arti |
|---|---|
| Booking paling cepat (menit) | Default 60: pelanggan tidak bisa booking jam yang kurang dari 1 jam lagi |
| Booking paling jauh (hari) | Default 14 hari ke depan |
| Batas batal/ubah online (jam) | Default 2 jam sebelum jadwal. Setelah itu pelanggan diarahkan chat WhatsApp cabang |
| Konfirmasi manual | Bila dicentang, booking online berstatus "Menunggu konfirmasi" sampai Anda konfirmasi |
| ID grup Telegram | Opsional: notifikasi booking baru/batal ke grup Telegram cabang |
| Jam buka | Satu rentang per hari, mis. `10:00-21:00`. Kosong = tutup |

### Hairstylist & jam kerja
- **Tambah / Ubah**: nama, jabatan, spesialisasi, foto (path, mis. `/uploads/barbers/dimas.webp`; upload fotonya lewat Pages CMS → media "Foto Barber"), aktif/nonaktif, urutan.
- **Layanan yang bisa dikerjakan**: centang. Hanya layanan tercentang yang bisa dibooking ke hairstylist ini.
- **Jam kerja** per hari, boleh beberapa rentang: `10:00-13:00, 14:00-21:00` (istirahat siang tidak bisa dibooking). Kosong = libur.
- Jam yang bisa dibooking = jam kerja hairstylist **di dalam** jam buka cabang.

### Layanan & harga
- **Durasi** dan **buffer** (jeda bersih-bersih, default 10 menit) menentukan panjang slot yang dikunci.
- **Harga dasar** berlaku di semua cabang (owner). **Harga cabang**: isi untuk harga khusus cabang; kosongkan untuk memakai harga dasar. Hilangkan centang **Tersedia di cabang** bila cabang tidak menyediakan layanan itu.
- Perubahan harga & layanan tampil di website dalam ±1 menit.

### Akun admin (owner)
- Tambah email, nama, peran, cabang (dan hairstylist untuk peran Hairstylist). Daftarkan juga email yang sama di Cloudflare Access.
- **Nonaktifkan** untuk mencabut akses (mis. staf keluar).

---

## 7. Cutless Stamp (kartu stempel loyalitas)

Program loyalitas otomatis, berlaku di semua cabang. **1 booking yang Selesai = 1 stempel.**

| Stempel | Hadiah (bisa diubah owner) |
|---|---|
| ke-5 | Voucher gratis 1× layanan kecil (default: Hair Wash & Styling atau Hot Towel Shave) |
| ke-10 | Voucher gratis 1× Signature Haircut, lalu kartu kembali ke 0 |

**Aturan otomatis:**
- Stempel diberikan saat **Anda menandai Selesai** di detail booking. Tidak ada tombol "beri stempel" terpisah.
- **Tidak** dapat stempel: booking batal, tidak datang, layanan paket, dan booking yang dibayar dengan voucher Cutless Stamp.
- Maksimal **1 stempel per pelanggan per hari** (tanggal lokal cabang), lintas cabang.
- Stempel hangus **12 bulan** sejak didapat; voucher berlaku **60 hari** sejak terbit (dihanguskan otomatis tiap malam).

### Menukar voucher (di kasir)
1. Minta pelanggan menunjukkan kode voucher (mis. `CS-7K2Q9M`) di halaman **Booking saya** di HP-nya.
2. Buka booking-nya di **Jadwal** → bagian **Voucher Cutless Stamp** menampilkan voucher yang cocok dengan layanan → **Tukar voucher** → konfirmasi.
3. Harga booking menjadi Rp0. Lalu tandai **Selesai** seperti biasa (booking ber-voucher tidak mendapat stempel).
- Untuk **walk-in pelanggan terdaftar**: di **Booking baru**, setelah memilih pelanggan & layanan, pilih voucher di kolom **Voucher Cutless Stamp**.
- Salah tukar? **Batalkan penukaran** selama booking belum Selesai. Bila booking dibatalkan/tidak datang, voucher otomatis aktif lagi (atau hangus bila sudah lewat masa berlaku).
- Catatan booking berawalan `[Pakai voucher CS-…]` berarti pelanggan menandai ingin memakai voucher saat booking online: tukarkan di kasir setelah dicek.

### Pelanggan walk-in tanpa akun
Stempel tamu walk-in tetap tercatat di data tamu. Bila tamu itu kemudian punya akun dengan **nomor WhatsApp yang sama**, detail pelanggan (akun) menampilkan kotak **"Ada data tamu dengan nomor yang sama"** → cocokkan orangnya di kasir → **Gabungkan**. Nomor WhatsApp tidak diverifikasi otomatis, jadi penggabungan selalu lewat admin. Menekan Gabungkan dua kali tidak menggandakan stempel.

### Detail pelanggan
Bagian **Cutless Stamp** menampilkan kartu (mis. 7/10), voucher (aktif / dipakai / hangus), dan riwayat stempel (siapa yang menandai Selesai). **Owner** bisa **Tambah/Cabut stempel** manual dengan alasan wajib (mis. kompensasi keluhan); semua tercatat di **Pengaturan → Log aktivitas**.

### Pengaturan (owner)
**Pengaturan → Cutless Stamp**: aktif/nonaktif program, target hadiah pertama & utama, layanan hadiah, masa berlaku stempel (bulan) & voucher (hari). Admin cabang hanya bisa melihat. Perubahan berlaku untuk stempel/voucher berikutnya; voucher yang sudah terbit tetap memakai layanan saat terbit.

### Memantau
**Ringkasan & ekspor → Cutless Stamp (30 hari)**: stempel diberikan, voucher terbit/ditukar (beserta nilainya)/hangus, dan **stempel per admin/hairstylist**. Waspadai angka yang jauh di atas jumlah booking Selesai, atau stempel manual yang sering.

---

## Pertanyaan umum

| Masalah | Solusi |
|---|---|
| Pelanggan bilang jamnya "tidak tersedia" | Cek jam kerja hairstylist, libur/cuti, dan apakah jam sudah dibooking. Booking online minimal 1 jam dari sekarang |
| Pelanggan tidak bisa booking online | Kemungkinan akun diblokir/3× tidak datang (buka di Pelanggan), atau sudah punya 2 booking aktif |
| Booking dobel? | Tidak bisa: sistem mengunci jam per hairstylist. Bila dua orang menekan bersamaan, hanya satu yang berhasil |
| Salah tandai status | Status Selesai/Tidak datang/Batal tidak bisa diubah kembali. Buat booking baru bila perlu dan catat di catatan admin. Semua aksi tercatat (siapa & kapan) |

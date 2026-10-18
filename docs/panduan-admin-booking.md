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

## 8. Toko (Cutless Shop)

Tab **Toko** (owner & admin cabang; hairstylist tidak melihatnya). Selama toko **mati**, landing page & /produk tetap memakai daftar produk Pages CMS dan pesan via WhatsApp seperti biasa.

### Menyalakan toko (owner, sekali)
1. **Toko → Pengaturan**, per cabang: centang cara terima (Ambil di cabang, Ambil saat booking, Dikirim), isi **rekening bank** (dan path gambar **QRIS statis** bila ada), opsional **Kode unik transfer**. Simpan.
2. Pastikan produk sudah ada (seed sekali dari Pages CMS oleh owner/developer: `npm run db:seed:shop:staging`) lalu isi **stok per cabang** (bagian berikut).
3. Atur batas bayar (default 24 jam), **batas ambil** (default 7 hari sejak Siap diambil), selesai otomatis (7 hari setelah dikirim), minimum belanja untuk stempel, peringatan stok menipis, kebijakan retur.
4. Centang **Toko aktif** → Simpan. Kartu produk di landing page kini mengarah ke /shop.

### Produk & stok
- Tabel menampilkan stok **tersedia** per cabang (stok fisik dikurangi yang sedang dipesan). Klik angkanya → isi **stok fisik di rak** + alasan (barang masuk, stock opname, rusak). Admin cabang hanya cabangnya. Stok tidak bisa diisi di bawah jumlah yang sedang dipesan.
- **Owner**: klik nama produk untuk mengubah, atau **Produk baru**. Foto: unggah di Pages CMS → Media, lalu tempel path-nya (satu per baris). Varian (mis. 100 gr / 50 gr) punya harga, harga coret, berat (untuk ongkir). Varian tidak dihapus, cukup matikan "Varian aktif".
- **Drop**: isi waktu **Rilis**; sebelum itu produk tampil "Segera" tetapi belum bisa dipesan. **Maks. per pelanggan** dihitung dari semua pesanan pelanggan yang tidak batal.

### Memproses pesanan
Buka **Toko → Pesanan**, pilih status (mis. *Dibayar (perlu disiapkan)*), klik kode pesanan.

| Status | Yang Anda lakukan |
|---|---|
| Menunggu ongkir | Isi **Ongkir**, kurir, layanan → **Simpan ongkir**. Pelanggan lalu melihat instruksi bayar. |
| Menunggu pembayaran | Cocokkan mutasi/bukti WhatsApp dengan **nominal persis** (termasuk kode unik) → **Tandai Lunas**. Bila nominal yang masuk berbeda, isi *Nominal diterima*: muncul peringatan selisih → konfirmasi bila tetap diterima. Tidak dibayar sampai batas → batal otomatis. |
| Dibayar (ambil) | Siapkan barang → **Siap diambil**. Saat diambil → **Sudah diambil** (stok fisik berkurang di sini). |
| Dibayar (kirim) | Kirim → isi **Nomor resi** → **Tandai dikirim**. Selesai saat pelanggan menekan "Pesanan diterima", atau otomatis 7 hari. |
| Diambil saat booking | Di kasir: dari **Jadwal → detail booking → Produk diambil saat booking → Proses di kasir → Diambil & dibayar di kasir**. Booking batal/tidak datang → pesanan ikut batal otomatis. |
| **Belum diambil** (merah) | Sudah lewat batas ambil. Tidak dibatalkan otomatis karena sudah dibayar: hubungi pelanggan (klik nomornya → WhatsApp), atau **Refund** bila disepakati. Telegram cabang juga mengirim pengingat sekali. |

**Batalkan** (sebelum bayar) & **Refund** (sesudah bayar) wajib alasan; refund mengembalikan stok bila barang belum dikirim (uang dikembalikan manual).

### Stempel & ringkasan
Pesanan Selesai dengan subtotal ≥ minimum (default Rp100.000) memberi 1 stempel Cutless Stamp; tetap maks. 1 stempel/hari gabungan dengan booking. **Toko → Ringkasan**: omzet 30 hari, produk terlaris, stok menipis, pesanan perlu tindakan, belum diambil.

---

## Pertanyaan umum

| Masalah | Solusi |
|---|---|
| Pelanggan bilang jamnya "tidak tersedia" | Cek jam kerja hairstylist, libur/cuti, dan apakah jam sudah dibooking. Booking online minimal 1 jam dari sekarang |
| Pelanggan tidak bisa booking online | Kemungkinan akun diblokir/3× tidak datang (buka di Pelanggan), atau sudah punya 2 booking aktif |
| Booking dobel? | Tidak bisa: sistem mengunci jam per hairstylist. Bila dua orang menekan bersamaan, hanya satu yang berhasil |
| Salah tandai status | Status Selesai/Tidak datang/Batal tidak bisa diubah kembali. Buat booking baru bila perlu dan catat di catatan admin. Semua aksi tercatat (siapa & kapan) |

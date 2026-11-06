# Memasang balasan ulasan Google (Owner)

Sistem ini membantu membalas ulasan Google kedua cabang dengan cepat dan konsisten:

- **Bintang 5 tanpa kata keluhan** dibalas otomatis dari template (hanya saat mode **Aktif**).
- **Bintang 1–4**, dan ulasan yang memuat *kata keluhan* (mis. lama, antri, kecewa, mahal, kotor) **tidak pernah terkirim otomatis**. Ulasan itu masuk antrean di halaman **https://cutlesshairstudio.com/ulasan/**, lalu admin meninjau, menyunting, dan menekan **Kirim**.
- Tidak ada alamat publik yang bisa mengirim balasan. Satu-satunya jalan kirim adalah tombol **Kirim** di `/ulasan/` (dikunci Cloudflare Access) dan balasan otomatis bintang 5 dari pekerjaan terjadwal.
- Batas pengaman: paling banyak **10 balasan otomatis per jam**, sisanya masuk antrean.

Biaya berjalan **Rp0**: Cron Trigger, D1, dan Cloudflare Access (paket gratis).

> **Status saat ini:** fitur disiapkan dengan **data tiruan**. Akses Google Business Profile API masih ditinjau Google (kasus 3-4799000042144). Sampai API disetujui dan rahasia OAuth diisi, tidak ada ulasan asli yang diambil dan tidak ada balasan yang terkirim ke Google. Mode bawaan **Mati**.

## Tidak ada notifikasi email atau chat

Sengaja **tidak ada** notifikasi email/Telegram dari website ini:

- Email domain `cutlesshairstudio.com` memakai server Rumahweb (MX → `mail.cutlesshairstudio.com`). **Jangan** mengaktifkan Cloudflare Email Routing di domain utama: itu bisa mengganti MX dan mematikan email `halo@`.
- Dokumentasi Cloudflare tidak memastikan pengiriman email dari Worker bisa berjalan hanya dengan subdomain, dan pengiriman ke alamat bebas memerlukan paket berbayar.

Cara mengetahui ada ulasan baru:

1. **Notifikasi bawaan Google** (email/aplikasi Google Business Profile, atau aplikasi Google Maps) untuk pemilik profil bisnis.
2. **Bookmark `/ulasan/`** di HP dan laptop. Bagian atas halaman menampilkan jumlah ulasan menunggu per cabang, ulasan tertua yang belum dibalas, dan penanda **Baru** untuk ulasan sejak kunjungan terakhir. Judul tab browser menampilkan jumlah antrean, mis. *(3) Ulasan – Cutless*.

Kode menyediakan antarmuka `Notifier` (`worker/ulasan/notify.ts`, bawaan: tidak mengirim apa pun) supaya penyedia notifikasi (mis. Brevo) dapat ditambahkan nanti tanpa mengubah logika.

## Urutan pengerjaan

Langkah 1–3 **wajib selesai sebelum PR `feat/balasan-ulasan` → staging di-merge**: tanpa ID database asli, Cloudflare menolak deploy (website tetap memakai versi sebelumnya, tetapi pembaruan berikutnya tertahan sampai ID diisi).

## Langkah 1. Membuat 2 database D1 dan tabelnya

Satu untuk website utama, satu untuk staging. Keduanya **terpisah** dari database hitungan klik (`cutless-analytics`).

1. Buka **https://dash.cloudflare.com** → login akun pemilik.
2. Menu kiri: **Storage & Databases → D1 SQL Database → Create**.
3. **Name**: `cutless-ulasan` → **Create**.
4. Di halaman database, salin **Database ID**. Simpan sebagai *ID produksi*.
5. Buka tab **Console**, tempel SQL satu baris di bawah ini, lalu **Execute**. Tab **Tables** sekarang menampilkan tabel `reviews`.
6. Ulangi langkah 2–5 dengan nama **`cutless-ulasan-staging`**. Simpan ID-nya sebagai *ID staging*.

SQL satu baris untuk Console (sama persis dengan [`migrations-ulasan/0001_ulasan.sql`](../migrations-ulasan/0001_ulasan.sql); dijaga `tests/review-docs.test.ts`):

```sql
CREATE TABLE IF NOT EXISTS reviews ( id TEXT PRIMARY KEY, branch TEXT NOT NULL, reviewer TEXT NOT NULL, rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5), body TEXT NOT NULL DEFAULT '', reviewed_at TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('baru', 'antre', 'terkirim', 'dilewati', 'gagal')), draft TEXT NOT NULL DEFAULT '', approved_by TEXT, approved_at TEXT, sent_auto INTEGER NOT NULL DEFAULT 0, sent_at TEXT, created_at TEXT NOT NULL ); CREATE INDEX IF NOT EXISTS reviews_status_time ON reviews (status, reviewed_at);
```

> Alternatif terminal: `npx wrangler d1 migrations apply REVIEWS_DB --remote` (produksi) dan `npx wrangler d1 migrations apply REVIEWS_DB --env staging --remote` (staging), setelah langkah 2. Aman dijalankan walau tabel sudah dibuat lewat Console.

Yang disimpan hanya: id ulasan, cabang, nama pengulas (seperti tampil di Google), bintang, isi ulasan, waktu, status, draf balasan, serta siapa yang menyetujui dan kapan. **Tidak ada** nomor HP, IP, atau data pribadi lain.

## Langkah 2. Mengisi database_id di wrangler.jsonc

1. Buka **https://github.com/rockshow02/cutlesshairstudio/blob/feat/balasan-ulasan/wrangler.jsonc** → ikon pensil (**Edit**).
2. Ganti `ISI-DATABASE-ID-cutless-ulasan` dengan *ID produksi*.
3. Ganti `ISI-DATABASE-ID-cutless-ulasan-staging` dengan *ID staging*.
4. **Commit changes** ke branch `feat/balasan-ulasan`.

Database ID tidak rahasia.

## Langkah 3. Menambah `/ulasan*` ke aplikasi Cloudflare Access

`/ulasan/` memakai **aplikasi Access yang sama** dengan `/statistik/` (satu `ACCESS_AUD`; tidak perlu mengubah `wrangler.jsonc`).

1. Buka **https://one.dash.cloudflare.com** (Zero Trust) → **Access → Applications** → *Statistik Cutless* → **Edit**.
2. Pada **Public hostname** pilih **Add public hostname**: Domain `cutlesshairstudio.com`, **Path** `ulasan`. (Mencakup `/ulasan/` dan semua di bawahnya.)
3. Pastikan policy *Allow* berisi email admin yang boleh meninjau ulasan. Simpan.

Worker juga memverifikasi JWT Access sendiri: bila aturan ini lupa dipasang, `/ulasan/` tetap **403**. Di staging halaman ini selalu 403 (Access staging sengaja kosong, seperti `/statistik/`); staging diuji lewat tes otomatis.

## Langkah 4. Menguji dengan data tiruan (tanpa API Google)

Setelah PR di-merge dan database terisi, staging mengambil **ulasan contoh** (`GBP_CLIENT = "mock"`) setiap jam. Tidak ada koneksi ke Google. Cron berjalan, tetapi mode bawaan **Mati** (tidak berbuat apa-apa) sampai Anda mengubahnya di Pages CMS → **Pengaturan Situs → Mode balasan ulasan Google**. Perubahan mode berlaku setelah website selesai dibangun (±3–5 menit).

Isi dan sunting **Template balasan ulasan** di Pages CMS (menu *Template balasan ulasan*). Isi awalnya **perlu ditinjau klien** sebelum dipakai (bahasa, sapaan, dan nomor WhatsApp 0813-2220-932 untuk bintang 1–2).

## Langkah 5. Setelah akses API Google disetujui

Belum bisa dikerjakan sekarang.

1. Buat kredensial OAuth di Google Cloud (proyek yang disetujui untuk Business Profile API) dan dapatkan *refresh token* untuk akun pemilik profil bisnis.
2. Simpan sebagai Worker secret (jangan di file/GitHub):
   ```bash
   npx wrangler secret put GBP_CLIENT_ID
   npx wrangler secret put GBP_CLIENT_SECRET
   npx wrangler secret put GBP_REFRESH_TOKEN
   ```
3. Isi `GBP_LOCATIONS` di `wrangler.jsonc` (bagian `vars` produksi): JSON slug cabang → lokasi Google, mis.
   `{"cibubur":"accounts/<id akun>/locations/<id lokasi>","bogor-bantarjati":"accounts/<id akun>/locations/<id lokasi>"}`.
4. Biarkan `GBP_CLIENT` kosong di produksi (kosong = klien Google sungguhan).

> Alamat API (`mybusiness.googleapis.com/v4/…`) ditulis dari dokumentasi Google dan **belum pernah dicoba** terhadap Google sungguhan. Bila Google menyetujui versi API lain, bagian `HttpGbpClient` di `worker/ulasan/gbp.ts` mungkin perlu disesuaikan.

## Langkah 6. Pindah mode Uji → Aktif

1. **Mode Uji**: ulasan asli masuk antrean `/ulasan/`, **tidak ada** yang terkirim ke Google (termasuk bintang 5 dan tombol Kirim). Pakai beberapa hari untuk memeriksa draf dan kata keluhan.
2. **Mode Aktif**: bintang 5 tanpa kata keluhan dibalas otomatis; yang lain tetap menunggu tombol **Kirim**.
3. **Darurat**: pilih **Mati** (berlaku setelah build ±3–5 menit). Untuk menghentikan seketika: Cloudflare → Workers & Pages → `cutlesshairstudio` → **Settings → Triggers → Cron Triggers** → hapus jadwal, atau hapus secret `GBP_REFRESH_TOKEN`.

## Panduan admin: meninjau dan membalas ulasan

1. Buka **https://cutlesshairstudio.com/ulasan/** (login Cloudflare Access: kode 6 digit dari email).
2. Bagian atas menampilkan jumlah ulasan yang menunggu per cabang, ulasan tertua, dan penanda **Baru** sejak kunjungan terakhir Anda.
3. Tiap ulasan di **Antrean** punya kotak **Draf balasan**. Sunting bila perlu, lalu:
   - **Simpan draf**: menyimpan tanpa mengirim.
   - **Kirim**: mengirim balasan ke Google. Hanya berfungsi di mode **Aktif**; di mode Uji/Mati halaman menjelaskan bahwa balasan tidak dikirim.
   - **Lewati**: tidak membalas ulasan ini.
4. Status **Gagal kirim**: Google menolak atau gagal menerima balasan; tekan **Kirim** lagi nanti.
5. **Riwayat** menampilkan balasan yang sudah terkirim (otomatis atau disetujui oleh siapa dan kapan) dan yang dilewati.

## Yang belum terbukti

- Pemanggilan **Google Business Profile API sungguhan** (daftar ulasan, balasan, OAuth refresh token): hanya diuji dengan klien tiruan dan `fetch` palsu.
- Jalur Cron Trigger di Cloudflare produksi: diuji lokal lewat `wrangler dev --test-scheduled`, bukan di Cloudflare.
- Notifikasi email/chat: tidak ada (lihat bagian atas).

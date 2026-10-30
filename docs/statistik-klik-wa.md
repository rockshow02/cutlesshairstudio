# Memasang hitungan klik WhatsApp & halaman /statistik/ (Owner)

Website mencatat setiap klik tombol WhatsApp (booking umum, tombol cabang, kapster, CTA artikel Tips, partner Cuci Sepatu, produk, promo) ke database Cloudflare **D1**, lalu menampilkannya di **https://cutlesshairstudio.com/statistik/**. Halaman itu dikunci **Cloudflare Access**: hanya email yang Anda daftarkan yang bisa membukanya (login dengan kode dari email).

Semuanya gratis. Yang disimpan hanya: tanggal, jenis tombol, cabang, kapster, halaman asal, dan asal kunjungan (mis. Google, Instagram). **Tidak ada** IP, nomor HP, isi pesan, cookie, atau ID pengunjung.

Ikuti langkah 1–5 **berurutan**, sekali saja. Langkah 1–2 harus selesai **sebelum PR `feat/analytics` → staging di-merge**: tanpa ID database, Cloudflare menolak deploy (website tetap memakai versi sebelumnya, tetapi pembaruan berikutnya tertahan sampai ID diisi).

---

## Langkah 1. Membuat 2 database D1 dan tabelnya

Satu untuk website utama, satu untuk staging (data uji coba tidak tercampur).

1. Buka **https://dash.cloudflare.com** → login akun pemilik.
2. Menu kiri: **Storage & Databases → D1 SQL Database** → **Create**.
3. **Name**: `cutless-analytics` → **Create**. (Location boleh dibiarkan otomatis, atau pilih *Asia-Pacific*.)
4. Di halaman database yang baru dibuat, salin **Database ID** (deretan huruf-angka panjang, mis. `3f2a…`). Simpan di catatan: *ID produksi*.
5. Buka tab **Console**. Salin seluruh isi file [`migrations/0001_wa_clicks.sql`](../migrations/0001_wa_clicks.sql) dari GitHub, tempel di kotak Console → **Execute**. Muncul pesan berhasil; tab **Tables** sekarang menampilkan tabel `wa_clicks`.
6. Ulangi langkah 2–5 dengan nama **`cutless-analytics-staging`**. Simpan ID-nya sebagai *ID staging*.

> Alternatif lewat terminal (bila terbiasa): `npx wrangler d1 migrations apply DB --remote` (produksi) dan `npx wrangler d1 migrations apply DB --env staging --remote` (staging), setelah langkah 2. Aman dijalankan walau tabel sudah dibuat lewat Console.

**Jangan** memakai atau mengubah database lain (mis. `cutless-prod`, database lama yang diarsipkan).

## Langkah 2. Mengisi database_id di wrangler.jsonc

1. Buka **https://github.com/rockshow02/cutlesshairstudio/blob/feat/analytics/wrangler.jsonc** → ikon pensil (**Edit**).
2. Ganti `ISI-DATABASE-ID-cutless-analytics` dengan *ID produksi*.
3. Ganti `ISI-DATABASE-ID-cutless-analytics-staging` dengan *ID staging*.
4. **Commit changes** ke branch `feat/analytics`.

Database ID tidak rahasia (tanpa akses akun Cloudflare Anda, ID itu tidak bisa dipakai).

## Langkah 3. Mengunci /statistik/ dengan Cloudflare Access

### 3a. Pertama kali memakai Zero Trust

1. Buka **https://one.dash.cloudflare.com** (Zero Trust) → pilih akun.
2. Bila diminta: buat **team name** (mis. `cutless`) dan pilih paket **Free** (gratis s.d. 50 pengguna).
3. **Settings → Authentication → Login methods → Add new → One-time PIN** → Save. (Pengguna menerima kode 6 digit di email; tidak perlu akun/sandi.)
4. Catat **team domain** Anda: **Settings → Custom Pages** (atau **Settings → General**) menampilkan `<team>.cloudflareaccess.com`, mis. `cutless.cloudflareaccess.com`.

### 3b. Aplikasi untuk website utama

1. **Access → Applications → Add an application → Self-hosted**.
2. **Application name**: `Statistik Cutless`. **Session duration**: `24 hours`.
3. **Add public hostname**: Domain `cutlesshairstudio.com`, **Path** `statistik`. (Mencakup `/statistik/` dan semua di bawahnya.)
4. **Policies → Add a policy**: Name `Pemilik & staf`, Action **Allow**, Include → **Emails** → isi email yang boleh membuka (satu per baris, mis. email Anda & klien) → Save.
5. **Login methods**: centang **One-time PIN**. Simpan aplikasi.
6. Buka aplikasi itu lagi → **Overview / Basic information** → salin **Application Audience (AUD) Tag** (deretan huruf-angka panjang). Simpan sebagai *AUD produksi*.

### 3c. Staging

Staging memakai alamat `cutlesshairstudio-staging.adi-yansyaaah.workers.dev`:

1. Cloudflare → **Workers & Pages → cutlesshairstudio-staging → Settings → Domains & Routes** → pada baris `workers.dev` klik **Enable Cloudflare Access** (bila belum).
2. **Manage Cloudflare Access** → aplikasi yang dibuat otomatis → pastikan policy *Allow* dengan email tim & login **One-time PIN**.
3. Salin **AUD Tag** aplikasi itu sebagai *AUD staging*.

## Langkah 4. Mengisi ACCESS_TEAM_DOMAIN & ACCESS_AUD

Di `wrangler.jsonc` (edit di GitHub seperti langkah 2):

```jsonc
"vars": {
  "ALLOWED_ORIGINS": "https://cutlesshairstudio.com,https://www.cutlesshairstudio.com",
  "ACCESS_TEAM_DOMAIN": "cutless.cloudflareaccess.com",   // team domain langkah 3a
  "ACCESS_AUD": "…AUD produksi…"
},
```

dan di bagian `"staging"` → `"vars"`: team domain yang sama + *AUD staging*. Commit.

Isi di **file ini**, bukan di dashboard Cloudflare (Variables): setiap deploy menimpa variabel dashboard dengan isi `wrangler.jsonc`.

Selama kedua nilai kosong atau salah, `/statistik/` **selalu menjawab "Akses ditolak" (403)**, sengaja: website memeriksa sendiri tanda login Access, jadi data tetap aman walau aturan Access terhapus atau lupa dipasang.

## Langkah 5. Aturan rate limit WAF (gratis, 1 aturan)

Mencegah orang iseng mengirim klik palsu ribuan kali.

1. Cloudflare → domain **cutlesshairstudio.com** → **Security → WAF → Rate limiting rules** → **Create rule**.
2. **Rule name**: `Batasi klik WhatsApp`.
3. **If incoming requests match**: Field **URI Path**, Operator **equals**, Value `/api/klik-wa`.
4. **With the same characteristics**: **IP** (bawaan; dihitung oleh Cloudflare, tidak disimpan website).
5. **When rate exceeds**: **Requests** `10`, **Period** `10 seconds`.
6. **Then take action**: **Block**, **Duration** `10 seconds`.
7. **Deploy**.

Pengunjung normal tidak pernah mendekati batas itu (1 klik = 1 permintaan). Staging (`workers.dev`) tidak memakai WAF; tidak masalah karena hanya untuk uji coba.

## Memeriksa hasilnya

1. Setelah PR di-merge dan deploy selesai, buka website → klik salah satu tombol WhatsApp.
2. Buka **/statistik/** → masukkan email terdaftar → kode dari email → halaman statistik tampil; klik tadi terhitung (angka hari ini).
3. Buka **/statistik/** di jendela penyamaran **tanpa login**: harus muncul halaman login Access (atau "Akses ditolak").

## Kuota gratis & biaya

| Layanan | Gratis per hari | Bila habis |
|---|---|---|
| Workers (permintaan `/api/klik-wa` & `/statistik/`) | 100.000 | Pencatatan klik gagal sampai besok. **WhatsApp tetap terbuka** (tombol tidak bergantung pada pencatatan) |
| D1 (1 klik = 1 baris ditulis) | 100.000 tulis, 5 juta baca, 5 GB | Sama: pencatatan berhenti, website & WhatsApp normal |
| Cloudflare Access | 50 pengguna | — |

Di paket Workers **Free** tidak ada tagihan otomatis. Bila akun pernah diubah ke paket berbayar (*Workers Paid*), pemakaian di atas kuota bisa ditagih, tetapi untuk ukuran barbershop praktis tidak akan tercapai.

## Perawatan

- **Menambah/menghapus email** yang boleh membuka statistik: Zero Trust → Access → Applications → Statistik Cutless → Policies → edit daftar Emails.
- **Menghapus data lama** (mis. lebih dari 2 tahun): D1 → `cutless-analytics` → Console → `DELETE FROM wa_clicks WHERE day < '2025-01-01';`
- Cabang, kapster, dan halaman baru otomatis dikenali setelah website diperbarui (daftar `klik-wa.json` dibuat saat build). Klik dari halaman yang belum dikenal dicatat sebagai *Halaman lain*.
- Kunci login Access diganti otomatis oleh Cloudflare; website mengambil kunci baru sendiri.

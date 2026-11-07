# Build harian (opsional): menyegarkan HTML statis untuk promo dan acara

Panduan untuk pemilik. Fitur ini **tidak wajib**. Bila tidak disetel, tidak ada yang rusak.

## Kenapa ada

Promo dan acara di bagian **Kabar, Promo & Acara** punya tanggal berakhir. Ada dua lapisan:

1. **Browser pengunjung (sudah jalan, tanpa setelan, Rp0).** Begitu tanggal berakhir lewat (jam WIB), kotak di
   halaman cabang dan banner langsung hilang di layar pengunjung, tanpa menunggu build apa pun.
2. **Build harian (pelengkap, opsional).** Mesin pencari dan AI membaca HTML statis, data terstruktur (JSON-LD),
   `sitemap.xml`, dan `llms.txt` tanpa menjalankan JavaScript. Isi ini dibuat saat build. Dengan build harian,
   isinya diperbarui paling lama 24 jam setelah promo berakhir. Untuk kebutuhan ini, 24 jam sudah cukup.

Jujur soal batasnya: bila build harian **tidak** disetel, HTML statis (yang dilihat Google) dari promo yang sudah
berakhir tetap seperti semula sampai ada build berikutnya. Build berikutnya terjadi setiap kali Anda menekan **Save**
di CMS atau ada rilis baru. Pengunjung tetap tidak melihat promo kedaluwarsa karena browser menyembunyikannya.

## Cara kerja singkat

Setiap hari pukul **00.05 WIB** (cron `5 17 * * *` dalam UTC), GitHub Actions memanggil sebuah *Deploy Hook* milik
Cloudflare. Cloudflare lalu membangun ulang situs dari branch `main`. Workflow-nya ada di
`.github/workflows/build-harian.yml`.

## Langkah 1: buat Deploy Hook di Cloudflare

1. Buka dashboard Cloudflare, lalu **Workers & Pages**.
2. Pilih worker **`cutlesshairstudio`** (yang produksi).
3. Buka **Settings**, lalu **Builds**, lalu bagian **Deploy Hooks**.
4. Buat hook baru. Nama: `build-harian`. Branch: `main`.
5. Salin URL yang muncul. **Perlakukan seperti kata sandi.** Siapa pun yang punya URL ini bisa memicu build.
   Jangan ditempel di chat, dokumen, atau commit.

## Langkah 2: simpan URL sebagai secret di GitHub

1. Buka repo di GitHub, lalu **Settings**, lalu **Secrets and variables**, lalu **Actions**.
2. Klik **New repository secret**.
3. Name: `CF_DEPLOY_HOOK_URL`. Secret: tempel URL dari langkah 1. Klik **Add secret**.

## Langkah 3: uji

1. Buka tab **Actions**, pilih workflow **Build harian**, klik **Run workflow**.
2. Tunggu hingga hijau. Log menampilkan `Build Cloudflare dipicu (HTTP ...)`. URL hook tidak pernah dicetak.
3. Di Cloudflare, buka worker **`cutlesshairstudio`**, lalu **Builds**. Pastikan ada build baru dengan pemicu
   (*trigger source*) **`deploy_hook`**.

Jadwal otomatis hanya berjalan dari branch `main`, jadi mulai aktif setelah rilis yang memuat workflow ini masuk
ke `main`. Run manual di atas baru bisa dipakai setelah itu juga.

## Cara tahu masih berjalan

- Tab **Actions**, workflow **Build harian**: harus ada run hijau tiap pagi.
- Sebelum secret dibuat, run juga hijau, tetapi hanya berisi catatan "Deploy Hook belum disetel".
- Run merah berarti hook ditolak atau tidak terjangkau. Biasanya hook dihapus atau URL di secret salah. Buat ulang
  hook (langkah 1) dan perbarui secret (langkah 2).

## PENTING: GitHub bisa mematikan jadwal sendiri

GitHub **menonaktifkan workflow terjadwal secara otomatis bila repo tidak ada aktivitas selama 60 hari**. Bila itu
terjadi, build harian berhenti diam-diam (situs tetap normal; hanya HTML statis yang tidak lagi disegarkan harian).

**Cara menyadarinya:** di tab **Actions** muncul banner yang menyebut workflow terjadwal dinonaktifkan karena tidak
ada aktivitas, atau workflow **Build harian** di daftar kiri bertanda *disabled*.

**Cara menyalakan lagi** (pilih salah satu):

- Tab **Actions**, pilih **Build harian**, klik tombol **Enable workflow**.
- Atau lakukan commit/push apa pun ke repo (misalnya Save di CMS), lalu cek di tab **Actions** bahwa statusnya
  sudah aktif.
- Atau klik **Run workflow** secara manual untuk menyegarkan saat itu juga.

## Biaya

**Rp0.** Hanya satu build per hari, jauh di bawah batas gratis Cloudflare maupun GitHub. Cloudflare membatasi
Deploy Hook 10 build per menit per worker; satu build sehari tidak mendekatinya. Bila ada build yang masih antre,
panggilan berikutnya mengembalikan build yang sama (tidak menumpuk).

## Cara mematikan

Pilih salah satu:

- Hapus secret `CF_DEPLOY_HOOK_URL` (Settings, Secrets and variables, Actions). Workflow tetap hijau, hanya
  mencetak catatan dan tidak memicu build.
- Atau di tab **Actions**, pilih **Build harian**, klik menu titik tiga, lalu **Disable workflow**.

Untuk keamanan, hapus juga hook `build-harian` di Cloudflare (Settings, Builds, Deploy Hooks).

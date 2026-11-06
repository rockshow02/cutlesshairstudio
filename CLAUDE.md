# Pedoman untuk agen coding

## Cara bekerja

Empat pedoman berikut diringkas dari [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)
(MIT), berdasarkan pengamatan Andrej Karpathy tentang kesalahan umum LLM saat menulis kode. Untuk tugas sepele, pakai
pertimbangan sendiri.

1. **Think Before Coding.** Sebutkan asumsi. Bila ada beberapa tafsir, sampaikan, jangan memilih diam-diam. Bila ada cara
   yang lebih sederhana, katakan. Bila ada yang tidak jelas, berhenti dan tanyakan.
2. **Simplicity First.** Kode paling sedikit yang menyelesaikan masalah: tanpa fitur, abstraksi, atau konfigurasi yang
   tidak diminta, dan tanpa penanganan error untuk kondisi yang mustahil.
3. **Surgical Changes.** Sentuh hanya yang perlu dan ikuti gaya yang ada. Jangan merapikan kode di sekitarnya. Hapus hanya
   sisa dari perubahanmu sendiri; kode mati lama cukup dilaporkan. Setiap baris yang berubah harus terkait permintaan.
4. **Goal-Driven Execution.** Ubah tugas menjadi kriteria yang bisa diverifikasi (mis. tes yang mereproduksi bug, lalu
   membuatnya lolos), dan ulangi sampai terbukti.

## Aturan proyek

Baca [CONTRIBUTING.md](CONTRIBUTING.md) sebelum mengubah apa pun:

- [Alur branch](CONTRIBUTING.md#alur-kerja-konten--main--fitur--staging--rilis-berversi--hotfix--main): konten → `main`,
  fitur → `staging` → rilis, hotfix → `main`.
- [Toggle CMS, default mati](CONTRIBUTING.md#aturan-fitur-baru-wajib-punya-toggle-di-cms-default-mati) untuk setiap
  bagian atau halaman baru.
- [Perintah lokal](CONTRIBUTING.md#7-perintah-lokal) dan [checklist sebelum merge](CONTRIBUTING.md#checklist-sebelum-merge-ke-main).

Belum tertulis di CONTRIBUTING.md:

- **CMS ↔ Zod:** field di `.pages.yml` dan `src/content/schema.ts` harus selaras (diperiksa `tests/cms-schema.test.ts`).
- **Tes memakai fixture:** data uji di `e2e/fixtures/content.ts`, bukan isi CMS, yang bisa berubah kapan saja.
- **Jangan mengarang data:** konten hanya dari fakta yang sudah dikonfirmasi klien. Bila belum pasti, kosongkan dan
  tanyakan.

## Superpowers di proyek ini

- **Worktree/branch:** fitur selalu dari `origin/staging`, hotfix dari `main`, sesuai alur di CONTRIBUTING.md.
- **finishing-a-development-branch:** JANGAN merge ke `staging` atau `main`, dan jangan push ke `main`. Pilihan akhir
  selalu "push branch + beri link PR (compare)", karena `gh` tidak terpasang dan merge dilakukan pemilik.
- **Spesifikasi lengkap = desain disetujui:** bila prompt pemilik sudah berisi spesifikasi lengkap (bagian A/B/C, tes,
  dokumentasi), lewati brainstorming dan langsung ke writing-plans.
- **Tugas kecil** (konten, teks, satu file, perbaikan kecil): pakai executing-plans inline atau langsung kerjakan.
  subagent-driven-development hanya untuk fitur besar.
- **TDD** tetap memakai fixture, bukan data CMS asli.

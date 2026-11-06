# Kata Keluhan Opsional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, dipilih pemilik) to implement this plan task-by-task.

**Goal:** `complaintWords` boleh kosong, sehingga semua ulasan bintang 5 dibalas otomatis saat mode Aktif.

**Architecture:** Hanya skema Zod, `.pages.yml`, dan dokumentasi yang berubah. `hasComplaint` dan `decideAction` sudah benar untuk daftar kosong (`some` pada array kosong = false); perilakunya dikunci dengan tes.

**Tech Stack:** TypeScript, Zod, Vitest, Pages CMS (`.pages.yml`).

**Spec:** prompt pemilik (bagian A/B/tes/dokumentasi), sesi 2026-11-06.

## Global Constraints

- Branch `feat/kata-keluhan-opsional` dari `origin/staging`; PR ke `staging`. Jangan sentuh `main`, jangan merge.
- JANGAN ubah `src/content/reviewReplies.json`.
- `complaintWords`: min 0, max 30 kata, tiap kata 1–30 karakter, default `[]`.
- Kuota 10/jam, jendela 14 hari, ulasan sudah berbalasan = dilewati, ulasan yang sudah ada di D1 tidak dinilai ulang: tidak berubah.
- Tes memakai fixture/data uji, bukan isi CMS. CMS ↔ Zod selaras (`tests/cms-schema.test.ts`).
- CHANGELOG di bagian "Belum dirilis".

## Review Focus

- Daftar berisi string kosong/spasi `['  ']`: `hasComplaint` mengabaikannya (sudah `w.trim() &&`), jadi tidak memblokir semua ulasan. Dipin di Task 1.
- Bintang 1–4 dengan daftar kosong tetap `antre`. Dipin di Task 1.
- Simpan CMS dengan daftar kosong lolos validasi. Dipin di Task 2.

### Task 1: Skema + logika (TDD)

**Files:**
- Modify: `src/content/schema.ts:782`
- Test: `tests/review-replies-schema.test.ts`, `tests/review-replies.test.ts`

**Interfaces:**
- Produces: `complaintWords` bertipe `string[]`, default `[]`. `hasComplaint(text, [])` = false; `decideAction(input, [])` unchanged.

- [ ] **Step 1: Tes gagal (skema).** Di `review-replies-schema.test.ts` ganti `expect(issues(none)).not.toEqual([])` menjadi `expect(issues(none)).toEqual([])`; tambah tes: `complaintWords` dihilangkan (`delete`) → lolos dan hasil parse `[]`; 31 kata tetap ditolak (sudah ada).
- [ ] **Step 2: Tes (logika, `review-replies.test.ts`).** Blok `describe('decideAction, daftar kata keluhan kosong')`: Aktif+5+"antri lama" → `kirim`; Aktif+4+"antri lama" → `antre`; Uji+5+"antri lama" → `antre`; Mati → `antre`; `hasComplaint('antri lama', [])` false; `hasComplaint('antri lama', ['  '])` false. Blok daftar terisi: perilaku lama (sudah ada) tetap.
- [ ] **Step 3: Jalankan** `npx vitest run tests/review-replies-schema.test.ts tests/review-replies.test.ts`. Expected: tes skema kosong GAGAL; tes logika sudah lolos.
- [ ] **Step 4: Implement** di `schema.ts`: `complaintWords: z.array(z.string().trim().min(1, ...).max(30, ...)).max(30, 'maksimal 30 kata keluhan').default([])` (buang `.min(1)` pada array).
- [ ] **Step 5: Jalankan ulang.** Expected: PASS.
- [ ] **Step 6: Commit** `feat(ulasan): kata keluhan boleh kosong (skema)`.

### Task 2: CMS + selaras Zod

**Files:**
- Modify: `.pages.yml:573-580`
- Test: `tests/cms-save.test.ts` (tambah kasus simpan dengan `complaintWords: []`), `tests/cms-schema.test.ts` (jalankan)

- [ ] **Step 1: Tes gagal/terjaga.** Di `cms-save.test.ts` tambah kasus: konten fixture dengan `reviewReplies.complaintWords = []` lolos skema yang sama dengan simpan CMS.
- [ ] **Step 2: Ubah `.pages.yml`:** `required: false`, `list.min: 0` (hapus `min`), deskripsi persis: "Kosongkan daftar ini agar SEMUA ulasan bintang 5 dibalas otomatis. Bila diisi, ulasan bintang 5 yang memuat salah satu kata ini masuk antrean untuk ditinjau admin."
- [ ] **Step 3: Jalankan** `npx vitest run tests/cms-schema.test.ts tests/cms-save.test.ts`. Expected: PASS.
- [ ] **Step 4: Commit** `feat(ulasan): kata keluhan tidak wajib di CMS`.

### Task 3: Dokumentasi + CHANGELOG

**Files:** `docs/balasan-ulasan.md`, `docs/panduan-admin.md`, `CHANGELOG.md`

- [ ] **Step 1:** Di kedua dokumen: cara mengosongkan kata keluhan & akibatnya; keputusan kirim/antre dibuat SEKALI saat ulasan pertama diambil (antrean dari mode Uji atau sebelum dikosongkan tidak terkirim otomatis; admin Kirim manual atau Lewati); pencocokan potongan kata ("lama" cocok di "selamat"); `{salam_waktu}` diisi saat draf dibuat, admin menyesuaikan sebelum Kirim.
- [ ] **Step 2:** Perbarui baris "Status saat ini" dan bagian "Yang belum terbukti" di `docs/balasan-ulasan.md`: GBP API asli, OAuth, cron produksi, kirim manual terbukti di produksi pada 6 November 2026. Sesuaikan juga kalimat aturan dasar (baris 5–6, 99) dan panduan-admin 837, 850 agar tidak lagi menyebut kata keluhan sebagai wajib.
- [ ] **Step 3:** CHANGELOG "Belum dirilis" → "Diubah".
- [ ] **Step 4: Commit** `docs(ulasan): kata keluhan opsional`.

### Task 4: Verifikasi & selesai

- [ ] `npm test` dan e2e (perintah di CONTRIBUTING.md §7) dijalankan; lihat output sebelum klaim.
- [ ] Push branch, beri link compare ke `staging`. Tidak merge.

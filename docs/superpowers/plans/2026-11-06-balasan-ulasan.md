# Balasan Ulasan Google Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (dipilih pemilik, inline; hemat kuota). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ulasan Google kedua cabang dibalas cepat & konsisten: bintang 5 tanpa kata keluhan dibalas otomatis dari template, selain itu masuk antrean dan hanya terkirim lewat persetujuan admin di `/ulasan/`. Disiapkan dengan data tiruan (`MockGbpClient`) karena akses Business Profile API masih ditinjau Google (kasus 3-4799000042144).

**Architecture:** Logika murni (pilih template, isi placeholder, klasifikasi keluhan, keputusan kirim) di `src/content/reviewReplies.ts` tanpa dependensi, dipakai skema Zod, build, dan Worker. Worker: `scheduled` (cron per jam) → `GbpClient` → D1 terpisah `REVIEWS_DB` → email ke admin (Email Workers); halaman `/ulasan/` dirender Worker (pola `/statistik/`, JWT Access diverifikasi sendiri). Template + mode dibawa ke Worker lewat `dist/ulasan-config.json` yang dibuat saat build (pola `klik-wa.json`).

**Tech Stack:** Cloudflare Workers (Cron Trigger, D1, `send_email`), Zod 4, Vitest (+`node:sqlite` untuk D1 tiruan), Playwright, Pages CMS.

**Spec:** prompt pemilik 2026-11-06 (bagian A/B/C), disetujui sebagai desain. Aturan repo: `CLAUDE.md`, `CONTRIBUTING.md`.

## Global Constraints

- Branch `feat/balasan-ulasan` dari `origin/staging` → PR (compare link) ke `staging`. **Jangan** merge/push ke `main` atau `staging`.
- CHANGELOG: tulis di `## [Belum dirilis]`. Versi tidak dinaikkan.
- Toggle default **Mati**: `Pengaturan Situs → Mode balasan ulasan` = `Mati | Uji | Aktif`, default `Mati` (Zod `.default('Mati')`, `.pages.yml` `default: Mati`, `settings.json` nilai awal `"Mati"`).
- Biaya Rp0: Cron Trigger, D1, Email Workers, Cloudflare Access saja. Cron **tiap 1 jam** (`0 * * * *`), tidak lebih sering.
- Bintang 1–4, ulasan berkata keluhan, mode Uji, dan mode Mati **tidak pernah** terkirim otomatis. Tidak ada endpoint publik pengirim balasan.
- Template: kategori `bintang5`, `bintang4`, `bintang3`, `bintang12`, `tanpaTeks`; masing-masing **3–6 variasi, ≤400 karakter**. Placeholder hanya `{nama}`, `{cabang}`, `{salam_waktu}`; placeholder lain ditolak build. Hasil setelah diisi ≤ **4.096** karakter (batas balasan Google).
- Status ulasan: `baru | antre | terkirim | dilewati | gagal`. Ulasan yang sudah punya balasan di Google → `dilewati`.
- Data yang disimpan di D1 hanya: id ulasan, lokasi, nama pengulas, bintang, isi, waktu, status, draf, disetujui oleh & kapan. Log tanpa isi ulasan/nama/email/token.
- Isi awal template: bahasa Indonesia sopan, sapaan "kak", tanpa janji/klaim belum terkonfirmasi; bintang 1–2 mengarahkan ke WhatsApp `0813-2220-932`.
- Tes memakai fixture/D1 tiruan, bukan data CMS (`e2e/fixtures/content.ts`, `tests/helpers`). Saat iterasi jalankan tes terkait saja; suite penuh (`npm test`, `npm run e2e`) sekali di akhir.
- Komentar & dokumentasi bahasa Indonesia, gaya file sekitar. Jangan merapikan kode di luar tugas.

## Asumsi (dilaporkan ke pemilik)

1. "Nama kapster dari barbers.json" = aturan kata kunci yang diketik admin boleh berisi nama kapster. Tidak ada pemeriksaan otomatis terhadap `barbers.json`; isi awal memberi contoh `fade`/`taper`, `sepatu`/`fotless`, dan satu nama kapster dari `barbers.json`. Pencocokan kata kunci: substring, tanpa peduli huruf kapital.
2. Mode (Mati/Uji/Aktif) dibaca Worker dari `dist/ulasan-config.json` (hasil build), jadi mengubahnya lewat CMS butuh build ±3–5 menit seperti konten lain.
3. `{cabang}` = nama cabang dari `branches.json`; `{salam_waktu}` = Selamat pagi/siang/sore/malam menurut jam WIB saat balasan dibuat; `{nama}` = nama pengulas (kosong → "kak").
4. Ulasan lama (lebih dari 14 hari) tidak diambil cron agar tidak membanjiri antrean di nyalaan pertama.
5. Cabang ↔ lokasi Google dipetakan lewat variabel Worker `GBP_LOCATIONS` (JSON `{"cibubur":"locations/123","bogor-bantarjati":"locations/456"}`), kosong di repo, diisi pemilik. Menghindari data belum dikonfirmasi di CMS.
6. `database_id` D1 ulasan memakai placeholder `ISI-DATABASE-ID-cutless-ulasan[-staging]`. **Deploy akan gagal sampai diisi** (juga `tests/wrangler-config.test.ts` tidak mewajibkan UUID untuk binding baru ini). Pemilik wajib mengisi sebelum PR ini di-merge.

## Review Focus

Masukan yang tidak disebut spec tetapi mungkin muncul; tiap baris punya tes di task pemilik kodenya.

1. Ulasan bintang 5 berisi keluhan dengan huruf kapital/tanda baca ("LAMA banget!") → tetap antre (Task 1).
2. Cron jalan dua kali bersamaan / diulang untuk ulasan yang sama → tidak ada duplikat, tidak ada balasan ganda (Task 4, 5).
3. Admin menekan *Kirim* dua kali / dua tab → hanya satu panggilan API (Task 5).
4. Nama pengulas berisi karakter HTML (`<script>`) atau `{cabang}` → di halaman di-escape, di balasan tidak diproses ulang sebagai placeholder (Task 1, 7).
5. POST ke `/ulasan/` dari origin lain (CSRF) → 403 (Task 7).
6. Draf hasil edit admin >4.096 karakter atau kosong → ditolak, tidak terkirim (Task 5).
7. API Google gagal/timeout saat kirim → status `gagal`, bisa dicoba lagi, tidak terkirim ganda (Task 5).

---

## File Structure

| File | Tanggung jawab |
|---|---|
| `src/content/reviewReplies.ts` (baru) | Konstanta, tipe, `fillPlaceholders`, `findUnknownPlaceholders`, `hasComplaint`, `matchKeywordRules`, `buildDraft`, `decideAction`, `greetingFor` — murni, tanpa Zod |
| `src/content/reviewReplies.json` (baru) | Template & aturan (Pages CMS) |
| `src/content/schema.ts` (ubah) | `reviewRepliesSchema`, `CONTENT_FILES['reviewReplies.json']`, `ContentBundle.reviewReplies`, field `reviewReplyMode` di `settingsSchema` |
| `.pages.yml` (ubah) | Koleksi "Template balasan ulasan" + field mode di Pengaturan Situs |
| `scripts/vite-content-plugin.ts` (ubah) | Emit `dist/ulasan-config.json` (template, mode, nama cabang) |
| `worker/ulasan/gbp.ts` (baru) | `GbpClient`, `MockGbpClient`, `HttpGbpClient` |
| `worker/ulasan/db.ts` (baru) | Akses D1: simpan ulasan idempoten, klaim kirim, daftar, hitung kiriman otomatis per jam |
| `worker/ulasan/sync.ts` (baru) | `runReviewSync(env, now)`: ambil, simpan, putuskan, kirim otomatis, email |
| `worker/ulasan/reply.ts` (baru) | `sendReply(...)`: satu-satunya jalur ke `GbpClient.reply` |
| `worker/ulasan/email.ts` (baru) | Susun & kirim email (Email Workers) + ringkasan harian |
| `worker/ulasan/page.ts` (baru) | HTML `/ulasan/` + handler aksi (Kirim/Lewati/simpan draf) |
| `worker/env.ts`, `worker/index.ts` (ubah) | Binding baru, `scheduled`, rute `/ulasan*` |
| `migrations-ulasan/0001_ulasan.sql` (baru) | Skema D1 ulasan |
| `wrangler.jsonc` (ubah) | `REVIEWS_DB`, cron, `send_email`, vars, `run_worker_first` |
| `tests/helpers/d1.ts` (ubah) | Parameter direktori migrasi; `run()` mengembalikan `{ meta: { changes } }` |
| `docs/balasan-ulasan.md` (baru), `docs/panduan-admin.md`, `CHANGELOG.md`, `README`? (ubah) | Dokumentasi |

---

### Task 1: Logika murni balasan (template, placeholder, keluhan, keputusan)

**Files:**
- Create: `src/content/reviewReplies.ts`
- Test: `tests/review-replies.test.ts`

**Interfaces:**
- Produces (dipakai Task 2–7):
```ts
export const REPLY_PLACEHOLDERS = ['nama', 'cabang', 'salam_waktu'] as const;
export const REPLY_MAX_LENGTH = 4096;
export const TEMPLATE_MAX_LENGTH = 400;
export type ReplyCategory = 'bintang5' | 'bintang4' | 'bintang3' | 'bintang12' | 'tanpaTeks';
export type ReplyMode = 'Mati' | 'Uji' | 'Aktif';
export interface ReplyTemplates {
  templates: Record<ReplyCategory, string[]>;
  keywordRules: { keyword: string; sentence: string }[];
  complaintWords: string[];
}
export interface ReviewInput { rating: number; text: string; reviewer: string; branchName: string }
export const findUnknownPlaceholders: (text: string) => string[];
export const fillPlaceholders: (template: string, values: { nama: string; cabang: string; salam_waktu: string }) => string; // sekali jalan: nilai yang berisi "{...}" tidak diproses ulang
export const greetingFor: (now: number) => 'Selamat pagi' | 'Selamat siang' | 'Selamat sore' | 'Selamat malam'; // jam WIB: 4–10 pagi, 11–14 siang, 15–17 sore, selain itu malam
export const categoryFor: (rating: number, text: string) => ReplyCategory;
export const hasComplaint: (text: string, complaintWords: string[]) => boolean;
export const buildDraft: (review: ReviewInput, cfg: ReplyTemplates, now: number, pick?: (n: number) => number) => string; // template + kalimat tambahan kata kunci, dipotong rapi ≤ REPLY_MAX_LENGTH
export type SendDecision = 'kirim' | 'antre';
export const decideAction: (input: { mode: ReplyMode; rating: number; text: string }, complaintWords: string[]) => SendDecision; // 'kirim' hanya bila mode Aktif, rating 5, tanpa kata keluhan
```

- [ ] **Step 1: Write the failing tests** (`tests/review-replies.test.ts`; fixture template kecil di dalam tes):
  - `findUnknownPlaceholders('Halo {nama} {foo} {Cabang}')` → `['foo', 'Cabang']`; teks tanpa kurung → `[]`.
  - `fillPlaceholders('Halo {nama}, {cabang}', {nama: '{cabang}', cabang: 'Cibubur', salam_waktu: 'x'})` → `'Halo {cabang}, Cibubur'` (tidak diproses ulang).
  - `greetingFor` untuk 05:00, 12:00, 16:00, 20:00, 02:00 WIB (konversi UTC+7).
  - `categoryFor(5,'')` = `tanpaTeks`; `(5,'mantap')` = `bintang5`; `(4,'x')` = `bintang4`; `(3,'x')` = `bintang3`; `(2,'x')` & `(1,'')` = `bintang12` (bintang 1–2 tanpa teks tetap `bintang12`); `(4,'')` = `tanpaTeks`.
  - `hasComplaint('LAMA banget!!', ['lama'])` true; `'Antrinya cepat'` dengan `['antri']` true (kata keluhan sebagai substring, tanpa peduli kapital); `'Mantap'` false.
  - `decideAction`: tabel — mode `Mati`/`Uji` → `antre` untuk rating 5; mode `Aktif`: rating 5 bersih → `kirim`; rating 5 berisi keluhan → `antre`; rating 1,2,3,4 → `antre` (loop `[1,2,3,4]` × teks bersih × mode Aktif — tes inti "tidak ada kiriman otomatis bintang 1–4").
  - `buildDraft`: pakai `pick = () => 0`; bintang 5 dengan teks "fade rapi" dan aturan `fade→kalimat` menambahkan kalimat itu; nama pengulas `<script>` tetap utuh apa adanya (escape urusan halaman); hasil ≤ 4096 untuk nama pengulas 5.000 karakter (nama dipotong 100 karakter di `ReviewInput` pemakai, tapi `buildDraft` tetap memotong hasil akhir).
- [ ] **Step 2: Run** `npx vitest run tests/review-replies.test.ts` → FAIL (modul belum ada).
- [ ] **Step 3: Implement** semua fungsi di `src/content/reviewReplies.ts` sesuai Interfaces. `fillPlaceholders` memakai satu `replace(/\{(nama|cabang|salam_waktu)\}/g, …)`. Nama kosong → `'kak'`. `buildDraft`: `pick(n)` default `Math.floor(Math.random()*n)`; aturan kata kunci memakai pencocokan substring huruf kecil, maksimal 2 kalimat tambahan, digabung dengan spasi.
- [ ] **Step 4: Run** tes yang sama → PASS.
- [ ] **Step 5: Commit** `feat(ulasan): logika murni template, kata keluhan, dan keputusan kirim`

---

### Task 2: Skema Zod, Pages CMS, isi awal template, mode di Pengaturan Situs

**Files:**
- Modify: `src/content/schema.ts` (tambah `reviewRepliesSchema`, entri `CONTENT_FILES`, `ContentBundle.reviewReplies`, `ReviewRepliesEntry`, `settingsSchema.reviewReplyMode`)
- Modify: `.pages.yml` (koleksi `reviewReplies` + field `reviewReplyMode` di `settings`)
- Create: `src/content/reviewReplies.json`
- Modify: `src/content/settings.json` (`"reviewReplyMode": "Mati"`)
- Modify: `src/lib/content.ts` (impor JSON seperti `faq`; hanya bila `ContentBundle`/tipe mensyaratkan, ikuti pola entri lain), `tests/helpers/contentFixture.ts` (`rawFixture.reviewReplies`), `e2e/fixtures/content.ts` (data uji + `applyE2EFixtures` tidak perlu diubah bila fixture tidak menimpa file ini)
- Test: `tests/review-replies-schema.test.ts`; `tests/cms-schema.test.ts` & `tests/content-fixture.test.ts` ikut memeriksa otomatis

**Interfaces:**
- Consumes: Task 1 (`REPLY_PLACEHOLDERS`, `findUnknownPlaceholders`, `fillPlaceholders`, `TEMPLATE_MAX_LENGTH`, `REPLY_MAX_LENGTH`, `ReplyTemplates`).
- Produces: `reviewRepliesSchema` (Zod, output cocok `ReplyTemplates`), `settings.reviewReplyMode: 'Mati'|'Uji'|'Aktif'`.

- [ ] **Step 1: Write the failing tests** (`tests/review-replies-schema.test.ts`), memakai `reviewRepliesSchema.safeParse` pada objek dasar valid:
  - kategori kurang dari 3 variasi → gagal; lebih dari 6 → gagal; variasi 401 karakter → gagal; variasi kosong → gagal.
  - placeholder `{foo}` di variasi dan di `sentence` aturan kata kunci → gagal dengan pesan menyebut `{foo}` dan daftar yang boleh.
  - variasi terpanjang dengan semua placeholder diisi nilai terpanjang (`nama` 100, `cabang` = nama cabang terpanjang di `branches` fixture, `salam_waktu` 14) dan 2 kalimat tambahan terpanjang (200) tetap ≤ 4096. Fungsi `worstCaseLength(cfg, limit = REPLY_MAX_LENGTH)` diekspor dan dipakai `superRefine`; tes memanggilnya dengan `limit` kecil (mis. 500) pada isi awal untuk membuktikan penolakan, dan tanpa override untuk membuktikan isi awal lolos.
  - `complaintWords` kosong → gagal (minimal 1); kata keluhan >30 karakter → gagal; kata kunci kosong → gagal; maks. 30 aturan kata kunci & 30 kata keluhan.
  - `settingsSchema.parse({...settingsFixture, reviewReplyMode: undefined}).reviewReplyMode` = `'Mati'`; nilai `'Nyala'` → gagal.
  - isi awal `src/content/reviewReplies.json` lolos skema; setiap variasi `bintang12` memuat `0813-2220-932`; tidak satu pun variasi memuat angka/persen/kata "gratis|diskon|promo|garansi" (tanpa janji/klaim).
- [ ] **Step 2: Run** `npx vitest run tests/review-replies-schema.test.ts` → FAIL.
- [ ] **Step 3: Implement** `reviewRepliesSchema` (objek: `templates` dengan 5 kunci kategori masing-masing `z.array(z.string().trim().min(1).max(400)).min(3).max(6)`; `keywordRules` array `{keyword: string 1–40, sentence: string 1–200}` maks. 30; `complaintWords` array string 1–30 maks. 30, min 1) dengan `superRefine` menolak placeholder tak dikenal (pesan menyebut path) dan hasil terburuk >4096. Tambah `reviewReplyMode: z.enum(['Mati','Uji','Aktif'], {error: …}).default('Mati')` di `settingsSchema`. Tambah ke `CONTENT_FILES`, `ContentBundle`, `rawFixture`.
- [ ] **Step 4: Isi `.pages.yml`:** koleksi `reviewReplies` (`type: file`, `path: src/content/reviewReplies.json`, label "Template balasan ulasan") dengan `templates` (object, field per kategori `type: string`, `list: {min: 3, max: 6}`, `options.maxlength: 400`), `keywordRules` (object list max 30, `keyword` maxlength 40, `sentence` text maxlength 200), `complaintWords` (string list max 30, maxlength 30); deskripsi menyebut placeholder yang boleh. Field `reviewReplyMode` di `settings`: `type: select`, `values: [Mati, Uji, Aktif]`, `default: Mati`, deskripsi menjelaskan tiga mode. Cocokkan `required`/`maxlength` dengan Zod persis (dicek `tests/cms-schema.test.ts`).
- [ ] **Step 5: Isi awal `reviewReplies.json`:** untuk tiap kategori 4 variasi sopan ("Halo kak {nama}, {salam_waktu}! Terima kasih sudah mampir ke Cutless {cabang}…"), tanpa janji; `bintang12` mengajak menghubungi WhatsApp 0813-2220-932 untuk tindak lanjut tanpa menjanjikan hasil; `keywordRules`: `fade`/`taper` (terima kasih, senang hasilnya cocok), `sepatu`/`fotless` (terima kasih mencoba perawatan sepatu), dan satu nama kapster dari `barbers.json` (kalimat generik berterima kasih); `complaintWords`: `lama, antri, antre, kecewa, mahal, kotor, jelek, buruk, tidak puas, nunggu, telat, kasar`. Tandai di PR/laporan: **isi awal perlu ditinjau klien**.
- [ ] **Step 6: Run** `npx vitest run tests/review-replies-schema.test.ts tests/cms-schema.test.ts tests/content-fixture.test.ts tests/cms-save.test.ts` dan `npm run check:content` (CONTENT_CHECK=warn bila ada peringatan lama) → PASS.
- [ ] **Step 7: Commit** `feat(ulasan): template balasan di Pages CMS + mode di Pengaturan Situs`

---

### Task 3: Konfigurasi build untuk Worker (`dist/ulasan-config.json`) + wrangler + migrasi D1

**Files:**
- Modify: `scripts/vite-content-plugin.ts` (fungsi `reviewConfig(bundle)` diekspor + `emitFile` di `generateBundle`)
- Modify: `src/content/reviewReplies.ts` (konstanta `REVIEW_CONFIG_PATH = '/ulasan-config.json'`, tipe `ReviewConfig = { mode: ReplyMode; branches: Record<string, string>; reply: ReplyTemplates }`)
- Create: `migrations-ulasan/0001_ulasan.sql`
- Modify: `wrangler.jsonc`, `worker/env.ts`
- Modify: `tests/helpers/d1.ts`
- Test: `tests/review-config.test.ts`, `tests/review-migration.test.ts`, perluas `tests/wrangler-config.test.ts`

**Interfaces:**
- Consumes: Task 1–2 (`ReplyTemplates`, `ReplyMode`).
- Produces: `reviewConfig(bundle: ContentBundle): ReviewConfig`; `Env` baru: `REVIEWS_DB?: D1Database; REVIEW_MAIL?: { send(message: unknown): Promise<void> }; ADMIN_EMAIL?: string; MAIL_FROM?: string; GBP_CLIENT?: string; GBP_LOCATIONS?: string; GBP_CLIENT_ID?: string; GBP_CLIENT_SECRET?: string; GBP_REFRESH_TOKEN?: string;`; `D1PreparedStatement.run(): Promise<{ meta: { changes: number } }>`; `testD1(dir = 'migrations')`.
- Skema tabel `reviews` (kolom): `id TEXT PRIMARY KEY` (nama resource ulasan Google), `branch TEXT NOT NULL`, `reviewer TEXT NOT NULL`, `rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5)`, `body TEXT NOT NULL DEFAULT ''`, `reviewed_at TEXT NOT NULL` (ISO UTC), `status TEXT NOT NULL CHECK (status IN ('baru','antre','terkirim','dilewati','gagal'))`, `draft TEXT NOT NULL DEFAULT ''`, `approved_by TEXT`, `approved_at TEXT`, `sent_auto INTEGER NOT NULL DEFAULT 0`, `sent_at TEXT`, `emailed_at TEXT`, `created_at TEXT NOT NULL`; indeks `(status, reviewed_at)`. Tabel kedua `meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)` (dipakai Task 6).

- [ ] **Step 1: Write failing tests:**
  - `review-config.test.ts`: `reviewConfig(contentFixture())` memuat `mode: 'Mati'`, `branches` sama dengan slug→nama cabang fixture, `reply` = template fixture; dengan `settings.reviewReplyMode='Uji'` → `'Uji'`. Tes build-output: `generateBundle` memancarkan `ulasan-config.json` (ikuti cara tes yang sudah ada untuk `klik-wa.json`; bila tak ada, cukup uji fungsi).
  - `review-migration.test.ts`: dengan `testD1('migrations-ulasan')` sisipkan ulasan sah; `status='aneh'` ditolak; `rating=6` ditolak; PRIMARY KEY ganda ditolak (`INSERT OR IGNORE` mengubah 0 baris, `meta.changes === 0`).
  - `wrangler-config.test.ts`: `REVIEWS_DB` ada di produksi & staging dengan nama `cutless-ulasan` / `cutless-ulasan-staging`, `migrations_dir: 'migrations-ulasan'`, `database_id` berbeda; cron `0 * * * *` di keduanya (satu entri persis); `/ulasan*` ada di `run_worker_first` produksi & staging; staging `GBP_CLIENT === 'mock'`, produksi `GBP_CLIENT` kosong ('' = klien sungguhan); `ADMIN_EMAIL` & `MAIL_FROM` ada sebagai var; tidak ada `GBP_CLIENT_SECRET`/`REFRESH_TOKEN` di file (hanya secret).
- [ ] **Step 2: Run** tiga file tes di atas → FAIL.
- [ ] **Step 3: Implement.** SQL sesuai skema di atas (komentar Indonesia). `wrangler.jsonc`: binding `d1_databases` kedua `REVIEWS_DB` (placeholder `ISI-DATABASE-ID-cutless-ulasan` / `-staging`, komentar jelas "wajib diisi sebelum merge"), `send_email: [{ name: 'REVIEW_MAIL', destination_address }]`? — **Email Workers `send_email` dengan `destination_address` tetap di config**; karena alamat harus "dari variabel", pakai binding `send_email` **tanpa** `destination_address` (boleh ke semua alamat terverifikasi) dan alamat tujuan dari var `ADMIN_EMAIL`. `triggers.crons: ["0 * * * *"]` produksi dan staging (staging sebelumnya `[]`). Vars baru: `ADMIN_EMAIL` & `MAIL_FROM` (`ulasan@cutlesshairstudio.com`, domain pengirim sama dengan zona), `GBP_LOCATIONS: ""`, `GBP_CLIENT` (`""` prod, `"mock"` staging). `tests/helpers/d1.ts`: parameter direktori + `run` → `{ meta: { changes: Number(r.changes) } }` (periksa pemakai lama `testD1()` tetap lolos).
- [ ] **Step 4: Run** tes Step 1 + `tests/wa-clicks.test.ts tests/wa-stats.test.ts` (pemakai `testD1` lama) → PASS.
- [ ] **Step 5: Commit** `feat(ulasan): konfigurasi build, skema D1 ulasan, binding wrangler`

---

### Task 4: GbpClient (Mock & sungguhan) + sinkron cron idempoten

**Files:**
- Create: `worker/ulasan/gbp.ts`, `worker/ulasan/db.ts`, `worker/ulasan/sync.ts`
- Modify: `worker/index.ts` (handler `scheduled`)
- Test: `tests/review-sync.test.ts`, `tests/review-gbp.test.ts`

**Interfaces:**
- Produces:
```ts
export interface GbpReview { id: string; location: string; reviewer: string; rating: number; text: string; createdAt: string /* ISO */; hasReply: boolean }
export interface GbpClient {
  listNewReviews(location: string, sinceIso: string): Promise<GbpReview[]>;
  reply(reviewId: string, text: string): Promise<void>;
}
export class MockGbpClient implements GbpClient { constructor(reviews?: GbpReview[]); readonly replies: { reviewId: string; text: string }[] }
export class HttpGbpClient implements GbpClient { constructor(opts: { clientId: string; clientSecret: string; refreshToken: string; fetcher?: typeof fetch }) }
export const createGbpClient: (env: Env) => GbpClient | null; // 'mock' → MockGbpClient(SAMPLE_REVIEWS); secret lengkap → HttpGbpClient; selain itu null
// db.ts
export const insertReview: (db: D1Database, r: GbpReview, branch: string, now: number) => Promise<boolean>; // INSERT OR IGNORE; true bila baru
export const setStatus / listReviews / countAutoSentSince / claimForSend ... (lihat Task 5 untuk claimForSend)
// sync.ts
export const MAX_AUTO_PER_HOUR = 10;
export const runReviewSync: (env: Env, deps: { client: GbpClient; config: ReviewConfig; now: number; mail?: Mailer }) => Promise<{ fetched: number; inserted: number; autoSent: number; queued: number }>;
```
- Consumes: Task 1 (`decideAction`, `buildDraft`), Task 3 (`ReviewConfig`, tabel `reviews`).

Perilaku `runReviewSync`: mode `Mati` → tidak melakukan apa pun (tidak memanggil klien). Per cabang di `GBP_LOCATIONS` (JSON slug→location; invalid/kosong → tidak ada pekerjaan): `listNewReviews(location, now − 14 hari)`; ulasan `hasReply` disimpan `dilewati`; yang sudah ada di D1 diabaikan (tidak menimpa status/draf); ulasan baru disimpan dengan draf `buildDraft`, status `antre` atau (bila `decideAction === 'kirim'` dan kuota `MAX_AUTO_PER_HOUR` per jam belum habis) dikirim lewat `sendReply` (Task 5) sebagai otomatis; kuota habis → `antre`. Setiap ulasan baru berstatus `antre` dipicu email (Task 6, dipanggil lewat `deps.mail`, kegagalan email tidak menggagalkan sinkron). Error satu cabang tidak menghentikan cabang lain. Log hanya hitungan & id cabang.

- [ ] **Step 1: Write failing tests** (D1 tiruan `testD1('migrations-ulasan')`, `MockGbpClient`, `now` tetap):
  - bintang 5 bersih + mode `Aktif` → `terkirim`, `sent_auto=1`, `client.replies.length === 1`, teks balasan = draf.
  - bintang 5 + mode `Uji` → `antre`, `replies` kosong; bintang 5 + mode `Mati` → klien tidak dipanggil, tabel kosong.
  - bintang 1–4 (loop) + mode `Aktif` → semua `antre`, `replies` kosong (tes inti).
  - bintang 5 dengan "LAMA banget" mode `Aktif` → `antre`.
  - `hasReply: true` → `dilewati`, tidak ada draf terkirim.
  - idempoten: `runReviewSync` dua kali dengan data sama → jumlah baris sama, `replies.length` tidak bertambah; status ulasan yang sudah `terkirim`/`antre` tidak berubah, draf yang diedit admin (UPDATE manual di tes) tidak tertimpa.
  - batas per jam: 12 ulasan bintang 5 bersih, mode `Aktif` → tepat `MAX_AUTO_PER_HOUR` (10) `terkirim`, 2 `antre`; sinkron di jam berikutnya (now + 1 jam + 1 menit) tidak mengirim yang `antre` (hanya admin yang bisa).
  - ulasan lebih tua dari 14 hari tidak disimpan (diteruskan klien tetapi disaring).
  - kegagalan `reply` (Mock dengan opsi `failReply`) → status `gagal`, tidak ada balasan ganda saat sinkron diulang.
  - klien `null` (tanpa secret, bukan mock) → sinkron selesai tanpa error, tanpa panggilan.
  - `review-gbp.test.ts`: `HttpGbpClient` dengan `fetcher` palsu: menukar refresh token ke access token di `https://oauth2.googleapis.com/token` (form berisi `grant_type=refresh_token`), list ke `https://mybusiness.googleapis.com/v4/{location}/reviews` mengonversi `starRating: 'FIVE'` → 5 dan `reviewReply` ada → `hasReply`, reply `PUT …/{reviewName}/reply` dengan body `{comment}`; respons non-2xx → melempar `Error` tanpa isi token di pesan; `createGbpClient` memilih mock/http/null sesuai env.
- [ ] **Step 2: Run** `npx vitest run tests/review-sync.test.ts tests/review-gbp.test.ts` → FAIL.
- [ ] **Step 3: Implement** modul di atas. `HttpGbpClient` menyimpan access token di memori sampai 1 menit sebelum kedaluwarsa. Pemetaan rating `ONE..FIVE`. Endpoint Business Profile API v4 adalah **asumsi dari dokumentasi**, belum terbukti (laporkan). `scheduled(controller, env, ctx)` di `worker/index.ts`: muat `ulasan-config.json` lewat `env.ASSETS`, panggil `runReviewSync` dengan `createGbpClient(env)` (null → keluar), bungkus try/catch dengan log tanpa data sensitif.
- [ ] **Step 4: Run** tes yang sama → PASS.
- [ ] **Step 5: Commit** `feat(ulasan): GbpClient (mock & sungguhan) dan sinkron cron idempoten`

---

### Task 5: Jalur kirim tunggal (`sendReply`) dan aksi admin

**Files:**
- Create: `worker/ulasan/reply.ts`
- Modify: `worker/ulasan/db.ts` (`claimForSend`, `updateDraft`, `skipReview`), `worker/ulasan/sync.ts` (pakai `sendReply`)
- Test: `tests/review-reply.test.ts`

**Interfaces:**
- Produces:
```ts
export type SendResult = { ok: true } | { ok: false; reason: 'tidak-ditemukan' | 'bukan-antrean' | 'draf-tidak-valid' | 'gagal-api' };
export const sendReply: (env: Env, client: GbpClient, id: string, by: { kind: 'otomatis' } | { kind: 'admin'; email: string }, now: number, draftOverride?: string) => Promise<SendResult>;
export const claimForSend: (db: D1Database, id: string, from: ('baru'|'antre'|'gagal')[], by: string, now: number) => Promise<boolean>; // UPDATE … SET status='terkirim' WHERE id=? AND status IN (…) → meta.changes === 1
```
Alur `sendReply`: validasi draf (tidak kosong setelah trim, ≤4096, tanpa placeholder tersisa seperti `{nama}`), `claimForSend` atomik (hanya satu pemenang), `client.reply`; gagal → `status='gagal'` (draf tetap) dan `ok:false`. `by.kind === 'otomatis'` hanya dipanggil dari `runReviewSync` dan menolak `rating < 5` (pengaman ganda) dengan `reason: 'tidak-boleh-otomatis'`; union `SendResult.reason` memuat alasan itu juga.
- Consumes: Task 4 (`GbpClient`, `db.ts`).

- [ ] **Step 1: Write failing tests:**
  - admin mengirim ulasan `antre` → `terkirim`, `approved_by` = email, `approved_at` terisi, `sent_auto=0`, 1 panggilan `reply` dengan draf.
  - dua `sendReply` bersamaan (`Promise.all`) → tepat satu `ok:true`, `replies.length === 1`.
  - kirim ulang ulasan `terkirim` → `bukan-antrean`, tanpa panggilan.
  - `kind: 'otomatis'` pada ulasan bintang 1–4 (loop) → `tidak-boleh-otomatis`, tanpa panggilan walau status `baru`.
  - draf kosong / 4097 karakter / berisi `{nama}` → `draf-tidak-valid`, status tak berubah, tanpa panggilan.
  - `draftOverride` valid menggantikan draf tersimpan, dan yang terkirim = override.
  - `client.reply` melempar → `gagal-api`, status `gagal`; admin bisa kirim lagi (`gagal` termasuk `from`) → sukses; log (spy `console.error/log`) tidak memuat isi ulasan, nama pengulas, atau email.
  - ulasan `dilewati` tidak bisa dikirim → `bukan-antrean`.
- [ ] **Step 2: Run** `npx vitest run tests/review-reply.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Sinkron (Task 4) dialihkan ke `sendReply(kind:'otomatis')` supaya hanya ada **satu** pemanggil `client.reply`.
- [ ] **Step 4: Run** `tests/review-reply.test.ts tests/review-sync.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(ulasan): jalur kirim tunggal dengan klaim atomik & pengaman bintang 1–4`

---

### Task 6: Email ke admin (Email Workers) + ringkasan harian

**Files:**
- Create: `worker/ulasan/email.ts`
- Modify: `worker/ulasan/sync.ts` (panggil), `worker/index.ts` (cron harian: pada jam 01 UTC = 08.00 WIB, kirim ringkasan bila antrean >5)
- Test: `tests/review-email.test.ts`

**Interfaces:**
- Produces:
```ts
export interface Mailer { send(msg: { to: string; from: string; subject: string; text: string; html: string }): Promise<void> }
export const createMailer: (env: Env) => Mailer | null; // null bila REVIEW_MAIL/ADMIN_EMAIL/MAIL_FROM kosong; memakai kelas EmailMessage dari "cloudflare:email" dimuat dinamis agar tes Node tidak gagal
export const reviewSubject: (rating: number, branchName: string) => string; // `⭐${rating} Ulasan baru – Cutless ${branchName} – perlu balasan`
export const notifyQueued: (env: Env, mailer: Mailer | null, cfg: ReviewConfig, now: number) => Promise<number>; // satu email per ulasan antre yang emailed_at NULL; set emailed_at; kembalikan jumlah terkirim
export const sendDailyDigest: (env: Env, mailer: Mailer | null, cfg: ReviewConfig, now: number) => Promise<boolean>; // hanya bila antrean 'antre' > 5; satu email ringkasan, tidak mengirim ulang di hari yang sama (WIB)
```
Isi email: bintang, cabang, nama pengulas, isi ulasan, draf balasan, tombol "Tinjau" (tautan `https://<host>/ulasan/#<id>`; host dari `siteUrl` hanya bila ada → gunakan `ALLOWED_ORIGINS` pertama? **pakai var `REVIEW_PAGE_URL`** bila diisi, default `https://cutlesshairstudio.com/ulasan/`). Semua nilai di-escape di HTML; nilai di header/subjek tanpa CR/LF.

- [ ] **Step 1: Write failing tests** (Mailer palsu merekam pesan):
  - subjek tepat `⭐3 Ulasan baru – Cutless Cibubur – perlu balasan`.
  - 3 ulasan antre baru → 3 email; panggilan kedua tidak mengirim ulang (`emailed_at` terisi).
  - isi email memuat bintang, nama, isi, draf, dan tautan "Tinjau"; nama `<img onerror>` di-escape di HTML; nama berisi `\r\nBcc: x` tidak lolos ke subjek/header.
  - email gagal (Mailer melempar) → `emailed_at` tetap NULL (dicoba lagi pada jam berikutnya), `notifyQueued` tidak melempar.
  - `createMailer` null bila var kosong → `notifyQueued` mengembalikan 0 tanpa error.
  - ringkasan harian: 5 antre → tidak kirim; 6 antre → kirim 1 email berisi jumlah; dipanggil lagi di hari WIB sama → tidak kirim lagi.
  - ulasan `terkirim`/`dilewati` tidak pernah diemail.
- [ ] **Step 2: Run** `npx vitest run tests/review-email.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Penanda ringkasan harian disimpan di tabel `meta (key TEXT PRIMARY KEY, value TEXT)` dengan kunci `digest_day`; tabel ini sudah termasuk di `0001_ulasan.sql` sejak Task 3 (tambahkan di sana, beserta tes migrasinya). Satu cron `0 * * * *` cukup: di handler `scheduled`, bila jam WIB = 8 jalankan `sendDailyDigest` setelah sinkron.
- [ ] **Step 4: Run** `tests/review-email.test.ts tests/review-migration.test.ts tests/review-sync.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(ulasan): email admin per ulasan & ringkasan harian`

---

### Task 7: Halaman `/ulasan/` (Access, noindex, ramah HP) + aksi

**Files:**
- Create: `worker/ulasan/page.ts`
- Modify: `worker/index.ts` (rute `/ulasan` dan `/ulasan/…`), `worker/stats.ts`? **tidak**: ekspor `HEADERS` & `page()` gaya bersama bila perlu dengan perubahan minimal (hanya tambah `export`), jangan merombak
- Test: `tests/review-page.test.ts`

**Interfaces:**
- Consumes: `isAccessAllowed` (access.ts), `sendReply` (Task 5), `listReviews`/`updateDraft`/`skipReview` (db.ts), `createGbpClient`, `loadReviewConfig(env, url)` (muat `ulasan-config.json` via ASSETS, cache 5 menit seperti `loadAllowlist`).
- Produces: `handleReviews(request: Request, env: Env, options?: { now?: number; accessFetcher?: …; client?: GbpClient }): Promise<Response>`.

Rute (semua di bawah `/ulasan/`, JWT Access wajib → selain itu 403 `Akses ditolak`, tanpa membaca D1):
- `GET /ulasan/` → antrean (status `antre`/`gagal`/`baru`) lalu riwayat 50 terakhir; tiap ulasan punya anchor `id` aman (`r-<angka indeks>`/hash dari id), bintang, cabang, nama, isi, `<textarea name="draf">`, tombol *Simpan draf*, *Kirim*, *Lewati*; kartu `data-review`, `data-status`. Banner mode (`Mati`/`Uji`/`Aktif`) dan catatan "Mode Uji: tidak ada balasan terkirim ke Google" di atasnya.
- `POST /ulasan/aksi` body form (`id`, `aksi` = `kirim|lewati|simpan`, `draf`); wajib `Origin` sama dengan origin permintaan (selain itu 403), JWT valid, `Content-Length` ≤ 16 KB; sukses → redirect 303 ke `/ulasan/#…`. `kirim` memanggil `sendReply(by: {kind:'admin', email})` (email dari klaim JWT payload `email`; kosong → `admin`); mode `Mati` atau `Uji` → *Kirim* **ditolak** dengan pesan (mode Uji: tidak ada yang terkirim ke Google, termasuk dari admin). `lewati` hanya dari `antre|baru|gagal` → `dilewati`. `simpan` memvalidasi draf (≤4096, tidak kosong, tanpa placeholder).
- Header sama seperti `/statistik/` (noindex, `no-store`, CSP tanpa script, `form-action 'self'`). Tanpa JavaScript. Semua nilai di-escape.

- [ ] **Step 1: Write failing tests** (memakai pasangan kunci RSA dibuat di tes + `accessFetcher` palsu, pola `tests/wa-stats.test.ts`; baca tes itu dulu untuk helper JWT yang ada dan pakai ulang):
  - tanpa JWT / JWT aud salah / token kedaluwarsa → 403 untuk GET dan POST, `REVIEWS_DB` tidak diakses (spy `prepare` tidak dipanggil).
  - JWT valid GET → 200, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`, `<meta name="robots" content="noindex`, tanpa `<script`; nama pengulas `<script>alert(1)</script>` ter-escape; urutan: antrean sebelum riwayat.
  - POST `kirim` mode `Aktif` → ulasan `terkirim`, `approved_by` = email dari JWT, `Mock.replies.length===1`; mode `Uji` → tidak ada panggilan klien, ulasan tetap `antre`, halaman menampilkan alasan.
  - POST dari `Origin: https://evil.example` → 403 tanpa efek; tanpa header `Origin` → 403.
  - POST `kirim` dua kali → balasan hanya satu.
  - `simpan` dengan draf valid mengubah draf; draf 4097 karakter → ditolak (400/422), draf tak berubah; `lewati` → `dilewati`.
  - `DB` tak terpasang → 503 pesan ramah; metode selain GET/HEAD/POST → 405.
  - `/ulasan` (tanpa slash) → 301 ke `/ulasan/`.
  - tidak ada endpoint lain yang memanggil `reply`: tes statis membaca `worker/**/*.ts` dan memastikan `.reply(` hanya muncul di `worker/ulasan/reply.ts` dan `worker/ulasan/gbp.ts` (pengaman struktural "tidak ada endpoint publik pengirim").
- [ ] **Step 2: Run** `npx vitest run tests/review-page.test.ts` → FAIL.
- [ ] **Step 3: Implement** modul & rute. Gaya CSS: kecilkan dari `STYLE` stats (salin variabel/warna yang sama, tanpa merombak `stats.ts`); target sentuh ≥44 px, tanpa scroll horizontal di 360 px. `worker/index.ts`: `pathname === '/ulasan' || startsWith('/ulasan/')` → `handleReviews`.
- [ ] **Step 4: Run** `tests/review-page.test.ts tests/wa-stats.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(ulasan): halaman /ulasan/ dikunci Cloudflare Access`

---

### Task 8: E2E `/ulasan/` (360 px & desktop) dengan MockGbpClient & fixture

**Files:**
- Create: `e2e/review-replies.spec.ts`
- Modify: `package.json` (`e2e:db` juga migrasi `REVIEWS_DB` lokal; `e2e:server` menambah `--test-scheduled` dan `--var GBP_CLIENT:mock --var ACCESS_*` yang sudah ada), `e2e/fixtures/content.ts` (template uji, mode `Aktif` di build E2E agar bintang 5 terkirim; **mode E2E ditimpa fixture, bukan isi CMS**), `worker/ulasan/gbp.ts` (`SAMPLE_REVIEWS`: 1 bintang 5 bersih, 1 bintang 5 berkeluhan, 1 bintang 3, 1 bintang 1, 1 sudah berbalas; id dan nama fiktif)
- Test: `e2e/review-replies.spec.ts`

**Interfaces:**
- Consumes: JWKS server uji di `:8799` dan `AUD = 'e2e-statistik'` dari `e2e/wa-clicks.spec.ts` → **ekstrak helper `signAccessJwt` bersama ke `e2e/helpers.ts`** hanya bila duplikasi >30 baris; jika tidak, salin pola secukupnya (jangan merombak spek lama).

- [ ] **Step 1: Write the failing e2e** (jalankan hanya file ini: `npx playwright test e2e/review-replies.spec.ts`):
  - tanpa JWT → `/ulasan/` 403 (heading *Akses ditolak*); `/sitemap.xml` & `/llms.txt` tidak memuat `ulasan`.
  - picu cron (`GET http://localhost:8787/cdn-cgi/handler/scheduled` — **verifikasi path ini di Step 3**, sesuaikan bila wrangler berbeda) lalu dengan JWT: halaman memuat ulasan antre (bintang 1, 3, bintang 5 berkeluhan) dan riwayat memuat bintang 5 bersih `terkirim` + yang sudah berbalas `dilewati`.
  - pada kartu bintang 3: ubah draf → *Simpan draf* → muat ulang, draf tersimpan; *Kirim* → kartu pindah ke riwayat `terkirim`.
  - 360 px: `scrollWidth - clientWidth <= 0`, tombol bertinggi ≥44 px; desktop 1280 px sama.
  - picu cron kedua → jumlah kartu tidak bertambah (idempoten).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** perubahan skrip & fixture; jalankan `npm run e2e:server` manual sekali untuk memastikan cron endpoint dan D1 lokal berfungsi.
- [ ] **Step 4: Run** `npx playwright test e2e/review-replies.spec.ts` → PASS di `hp` dan `desktop`.
- [ ] **Step 5: Commit** `test(ulasan): e2e /ulasan/ dengan MockGbpClient`

---

### Task 9: Dokumentasi, CHANGELOG, verifikasi akhir, PR

**Files:**
- Create: `docs/balasan-ulasan.md`
- Modify: `docs/panduan-admin.md` (bagian *Membalas ulasan Google*), `CHANGELOG.md` (`### Ditambahkan` di `[Belum dirilis]`), `CONTRIBUTING.md` bagian perintah lokal hanya bila ada perintah baru (tidak ada → jangan sentuh)

- [ ] **Step 1: Tulis `docs/balasan-ulasan.md`** (untuk pemilik, gaya `docs/statistik-klik-wa.md`, langkah bernomor): (1) Email Routing → verifikasi alamat tujuan admin + pastikan domain pengirim `MAIL_FROM` di Email Routing; (2) buat D1 `cutless-ulasan` & `cutless-ulasan-staging`, isi `database_id` di `wrangler.jsonc` (**sebelum merge**) dan jalankan migrasi lewat Console memakai **SQL satu baris tanpa komentar** (blok kode berisi `CREATE TABLE …; CREATE INDEX …; CREATE TABLE meta …;` dibuat dari `migrations-ulasan/0001_ulasan.sql` dan diuji `tests/review-docs.test.ts` agar selalu sama dengan migrasi); (3) tambah path `/ulasan*` ke aplikasi Access yang sama dengan `/statistik/` (Worker memakai satu `ACCESS_AUD`; aplikasi Access baru berarti AUD berbeda dan butuh var baru, di luar cakupan); (4) isi `GBP_LOCATIONS` dan secret OAuth (`wrangler secret put GBP_CLIENT_ID|GBP_CLIENT_SECRET|GBP_REFRESH_TOKEN`) setelah API disetujui; (5) pindah mode Uji → Aktif (Pengaturan Situs) dan cek hasil bertahap; (6) batas otomatis 10/jam, cara menonaktifkan darurat (mode Mati); (7) batas yang belum terbukti. Tambah panduan admin cara meninjau, mengedit, mengirim, dan melewati.
- [ ] **Step 2: Tes dokumentasi** `tests/review-docs.test.ts`: SQL satu baris di dokumen = isi migrasi tanpa komentar/baris kosong, satu baris, tanpa `--`; dokumen menyebut `/ulasan*`, `0813-2220-932` tidak wajib. Run → PASS.
- [ ] **Step 3: CHANGELOG** satu butir *Ditambahkan* di `[Belum dirilis]`: sistem balasan ulasan (mode default Mati, data tiruan, tidak aktif sampai API Google disetujui).
- [ ] **Step 4: Verifikasi penuh sekali:** `npm run typecheck && npm run lint && npm test && npm run check:content` lalu `npm run e2e` (sekali). Catat hasil apa adanya.
- [ ] **Step 5: Commit & push:** `docs(ulasan): panduan pemasangan, panduan admin, CHANGELOG`; `git push -u origin feat/balasan-ulasan`; berikan link compare `https://github.com/rockshow02/cutlesshairstudio/compare/staging...feat/balasan-ulasan` (`gh` tidak terpasang; jangan merge).
- [ ] **Step 6: Laporan** berisi: branch & commit, link compare, hasil tes, langkah dashboard pemilik (verifikasi alamat Email Routing, `/ulasan*` di Access, buat D1 + isi `database_id`, secret OAuth, pindah mode), daftar **belum terbukti** (pemanggilan API Google sungguhan, pengiriman email sungguhan, endpoint cron lokal, path cron produksi), dan tanda "template perlu ditinjau klien".

---

## Self-Review

- **Cakupan spesifikasi:** A1–A3 → Task 1–2; B4 → Task 4; B5 → Task 3–4 (+SQL satu baris Task 9); B6 → Task 2/5/7; B7 → Task 6; B8 → Task 7; C9 → Task 4–5, 7; tes unit/e2e → Task 1,4–8; dokumentasi/laporan → Task 9. Toggle default mati, CHANGELOG, jalur branch: Global Constraints.
- **Konsistensi tipe:** `ReviewConfig`/`ReplyTemplates` (Task 1/3) dipakai Task 4–7; satu pemanggil `client.reply` (Task 5) ditegakkan tes struktural (Task 7).
- **Proporsi:** rencana panjang karena fitur besar; kode hanya pada antarmuka.
- **Catatan yang menunggu keputusan pemilik** (tidak memblokir): `database_id` placeholder membuat deploy gagal sampai diisi; Business Profile API v4 endpoint belum terbukti.

# Kabar, Promo & Acara per Cabang: Rencana Implementasi

> **Untuk agen pelaksana:** WAJIB pakai superpowers:subagent-driven-development (disarankan) atau superpowers:executing-plans. Langkah memakai checkbox (`- [ ]`). TDD: tes dulu, lihat gagal, baru kode.

**Tujuan:** Pemilik menerbitkan kabar, promo, dan acara lewat Pages CMS (semua cabang atau cabang tertentu); promo/acara yang lewat hilang sendiri dari kotak cabang dan banner beranda.

**Arsitektur:** Meniru pipeline Tips & Trik, tanpa menyalin kodenya: koleksi Markdown `src/content/kabar/*.md` → `scripts/kabar.ts` (validasi, render, head, JSON-LD, ringkasan statis, sitemap, llms.txt) → `scripts/vite-content-plugin.ts` (modul `virtual:kabar`, prerender, 301 saat mati). Logika murni (jalur, aktif/lewat, pengelompokan, filter) di `src/content/kabarSeo.ts`, dipakai build dan browser. Kedaluwarsa: browser memakai jam pengunjung (WIB) untuk menyaring, build harian memperbarui HTML statis (lihat Task 8).

**Tech Stack:** React 18 (halaman statis multi-entry Vite), Zod 4, marked, vitest, Playwright. Waktu: `parseWIB` dari `src/lib/dates.ts`.

**Spec:** prompt pemilik (bagian A–D) tertanam di sesi; tidak ada file spesifikasi terpisah. CLAUDE.md: spesifikasi lengkap = desain disetujui.

## Global Constraints

- Branch `feat/kabar` dari `origin/staging` (worktree `Z:\Learn\cutlesshairstudio-kabar`) → PR ke `staging`. Jangan merge, jangan sentuh/push `main`.
- Toggle `showKabar` dan `showKabarBanner`: `z.boolean().default(false)`, `default: false` di `.pages.yml`, nilai `false` di `settings.json`. Tips tetap ditahan: `showTips` tidak diubah.
- Mati = tidak di-build (HTML, JSON-LD), `/kabar` dan `/kabar/*` 301 ke `/`, tidak ada di menu, sitemap, llms.txt; kotak cabang dan banner tidak dirender.
- Banner beranda tampil hanya bila `showKabar` **dan** `showKabarBanner` aktif (banner menaut ke detail).
- Batas karakter (Zod = `.pages.yml`, dicek `tests/cms-schema.test.ts`): judul 80, ringkasan 160, nama tempat 80, alamat 200, alt gambar 150, teks tombol WA 40.
- Gambar: webp/jpg/png di `/uploads/kabar/`, alt wajib bila ada gambar.
- JANGAN membuat isi kabar. Folder `src/content/kabar/` hanya berisi `.gitkeep`. Data uji hanya di `e2e/fixtures/content.ts` dan fixture vitest.
- Tes tidak bergantung data CMS (memori proyek); tanggal fixture e2e tetap (2020-01-01 = lewat, 2099-12-31 = aktif).
- Zona waktu semua perbandingan: WIB (+07:00), lewat `parseWIB`; jangan memakai zona server/runner (build jalan di UTC).
- Satu `<main>` per halaman, CLS < 0,005, rapi di 360 px dan 1280 px.
- Komentar dan teks UI berbahasa Indonesia, gaya file yang ada. CHANGELOG di `## [Belum dirilis]`.
- Commit diakhiri `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Keputusan desain (asumsi yang dilaporkan ke pemilik)

1. **Kunci frontmatter** (Inggris-Indonesia campur seperti tips): `title, slug, publishedAt, kind (Kabar|Promo|Acara), branches[] ("semua" atau slug), summary, image, imageAlt, waLabel, status (Draf|Terbit), validFrom, validUntil, startsAt, endsAt, locationType ("Di cabang"|"Tempat lain"), venueName, venueAddress, linkUrl, body`.
2. **Kolom milik jenis lain DIABAIKAN, bukan ditolak** (koreksi pemilik): Pages CMS menampilkan semua kolom untuk semua jenis dan menyimpan langsung ke main; menolak = build produksi gagal tanpa admin tahu sebabnya. Kolom jenis lain yang terisi tidak dirender, tidak masuk JSON-LD, tidak masuk ringkasan (zod `superRefine` hanya memeriksa kolom WAJIB milik jenis itu). Yang ditolak: Promo tanpa `validUntil`; Acara tanpa `startsAt`/`endsAt`/`locationType`; Acara `endsAt` < `startsAt`; "Tempat lain" tanpa `venueName`/`venueAddress`; `validFrom` > `validUntil`. `branches`: `["semua"]` saja, atau slug tanpa `"semua"`.
3. **Tiga status** (koreksi pemilik): `kabarStatus(k, now)` = `'akan-datang' | 'berlangsung' | 'berakhir'`. Promo: akan datang bila `validFrom` ada dan `now < parseWIB(validFrom)` (00.00 WIB hari itu); berakhir bila `now > parseWIB(validUntil, true)`; selain itu berlangsung. Acara: akan datang `now < parseWIB(startsAt)`; berlangsung `startsAt ≤ now < endsAt`; berakhir `now ≥ endsAt`. Kabar: selalu `'berlangsung'` (tidak pernah berakhir). "Aktif" (grup, kotak cabang, banner, llms.txt) = status bukan `berakhir`. Promo/acara akan datang bertanda "Mulai <tanggal>" (kotak cabang dan banner juga). **Urutan** grup "Sedang berlangsung & akan datang": acara (`startsAt` naik), lalu promo (`validUntil` naik).
4. **Kabar** (jenis Kabar) dan **Sudah berakhir** diurut `publishedAt` turun. Tanpa paginasi (YAGNI; ditanyakan ke klien bila jumlah item besar).
5. **Tombol WA detail**: 1 cabang → satu tombol ke nomor cabang itu; 2+ cabang spesifik → satu tombol per cabang; "semua" → pemilih cabang bawaan. Pesan: `Halo Kak! Saya tertarik dengan "<judul>" di {brand} cabang {branch}.`
6. **Banner beranda**: item pertama dari grup aktif (semua cabang), tanpa penyaring cabang.
7. **Event "Di cabang"**: `location` = satu `Place` per cabang terpilih (semua cabang bila "semua"), alamat dari `branches.json` lewat `src/content/postalAddress.ts`. "Tempat lain": `Place{name, address: PostalAddress{streetAddress}}` tanpa mengarang kota/kode pos. `offers` tidak pernah ditulis (tidak ada data harga).
8. **Sitemap `lastmod`** = `publishedAt` (tidak ada kolom diperbarui). Item lewat tetap di sitemap (halaman 200).

## Review Focus

1. Build di runner UTC pukul 17:30 (sudah tanggal berikutnya di WIB): promo `validUntil` kemarin WIB harus dihitung lewat, bukan aktif. Tes di Task 1 memakai `now` UTC.
2. Cabang yang dihapus dari `branches.json` tetapi masih dirujuk kabar: build gagal dengan pesan menyebut file kabar dan pilihan cabang (Task 3).
3. Koleksi kosong dengan `showKabar` aktif: `/kabar/` tetap 200 dengan pesan kosong, sitemap memuat `/kabar/`, tanpa error JS (Task 5/7).
4. Isi Markdown berisi `<script>` atau `javascript:` tidak dieksekusi (pakai ulang `renderMarkdown`; tes di Task 3).
5. Acara dengan `endsAt` = `startsAt` diterima, `endsAt` < `startsAt` ditolak; tanggal tanpa jam ditolak (Task 2).
6. Promo/acara yang sudah lewat tetapi masih di HTML statis: tidak boleh berkedip atau menggeser tata letak (saringan pra-paint, Task 6, diukur Task 7).
7. Admin mengganti jenis dan kolom lama masih terisi (mis. Promo dengan kolom acara, Kabar dengan `endsAt < startsAt`): tetap valid, kolom diabaikan (Task 2).

---

### Task 1: Logika murni `kabarSeo.ts`

**Files:**
- Create: `src/content/kabarSeo.ts`
- Test: `tests/kabar.test.ts`

**Interfaces:**
- Produces (semua murni, tanpa Zod, boleh diimpor browser dan build):
  - `KABAR_PATH = '/kabar/'`, `KABAR_KINDS = ['Kabar','Promo','Acara'] as const`, `KABAR_STATUSES = ['Draf','Terbit'] as const`, `KABAR_ALL_BRANCHES = 'semua'`, `KABAR_SLUG` (regex sama dengan `TIP_SLUG`), `KABAR_LOCATION_TYPES = ['Di cabang','Tempat lain'] as const`
  - `kabarVisible(settings: { showKabar?: boolean | null }): boolean`; `kabarBannerVisible(settings: { showKabar?: boolean | null; showKabarBanner?: boolean | null }): boolean`
  - `kabarRedirects(visible: boolean): string[]` (`['/kabar    /   301', '/kabar/*  /   301']` bila mati)
  - `kabarPath(slug: string): string`
  - `interface KabarSummary { slug; title; summary; kind: KabarKind; branches: string[]; publishedAt: string; image?: string; imageAlt?: string; validFrom?: string; validUntil?: string; startsAt?: string; endsAt?: string }` dan `KabarArticle extends KabarSummary` (+ `html: string; waLabel?: string; locationType?; venueName?; venueAddress?; linkUrl?`)
  - `type KabarStatus = 'akan-datang' | 'berlangsung' | 'berakhir'`; `kabarStatus(k: KabarSummary, now: number): KabarStatus` (keputusan 3; hanya kolom milik jenisnya yang dibaca)
  - `isKabarActive(k, now): boolean` = `kabarStatus !== 'berakhir'`; `isKabarEnded(k, now)` = `kabarStatus === 'berakhir'`
  - `kabarStartLabel(k): string | undefined`: "Mulai <tanggal>" untuk promo/acara akan datang (dipakai statis dan React)
  - `kabarEndMs(k): number | undefined` dan `kabarStartMs(k): number | undefined` (epoch ms; dipakai atribut `data-kabar-start/end` untuk saringan pra-paint, Task 6)
  - `groupKabar(list: KabarSummary[], now: number): { active: KabarSummary[]; news: KabarSummary[]; ended: KabarSummary[] }` (aturan keputusan 3 dan 4)
  - `kabarForBranch(list, branchSlug: string): KabarSummary[]` (cabang itu atau `semua`)
  - `branchBoxItems(list, branchSlug, now): KabarSummary[]`: Promo/Acara aktif untuk cabang itu, urutan grup aktif
  - `bannerItem(list, now): KabarSummary | undefined`
  - `formatKabarDate(iso: string): string` dan `formatKabarDateTime(wib: string): string` (mis. "12 Desember 2026, 10.00 WIB"), reuse gaya `formatTipDate`

- [ ] **Step 1: Tes gagal** di `tests/kabar.test.ts` (fixture lokal kecil, `now` diberikan eksplisit):
  - `promo berlangsung sampai akhir hari validUntil WIB`: `validUntil '2026-12-31'`; `now = Date.parse('2026-12-31T23:59:59+07:00')` → `berlangsung`; `Date.parse('2027-01-01T00:00:00+07:00')` → `berakhir`.
  - `batas hari WIB memakai UTC`: `now = Date.parse('2026-12-31T17:30:00Z')` (= 1 Jan 00:30 WIB) dan `validUntil '2026-12-31'` → `berakhir`.
  - `promo akan datang`: `validFrom '2026-12-10'`; `2026-12-09T23:59:59+07:00` → `akan-datang`; `2026-12-10T00:00:00+07:00` → `berlangsung`; promo tanpa `validFrom` tidak pernah `akan-datang`; `kabarStartLabel` berisi "Mulai" + tanggal.
  - `acara tiga status`: `startsAt '2026-12-20T10:00'`, `endsAt '2026-12-20T15:00'`; `09:59:59+07:00` → `akan-datang`; `10:00:00+07:00` → `berlangsung`; `14:59:59+07:00` → `berlangsung`; `15:00:00+07:00` → `berakhir`.
  - `isKabarActive` benar untuk `akan-datang` dan `berlangsung`, salah untuk `berakhir`; promo yang membawa kolom acara (`startsAt`) status-nya tetap dari `validUntil` saja (kolom jenis lain diabaikan).
  - `kabar tidak pernah lewat`; `groupKabar` mengurutkan acara (startsAt) sebelum promo (validUntil), kabar terbaru dulu, lewat di `ended`.
  - `kabarForBranch` menyertakan item `semua` dan cabang cocok, membuang cabang lain; `branchBoxItems` tidak memuat kabar biasa atau yang berakhir, tetapi memuat yang `akan-datang`.
  - `bannerItem` mengembalikan acara terdekat; `undefined` bila tidak ada yang aktif.
  - `kabarRedirects(false)` berisi dua aturan, `kabarRedirects(true)` kosong; `kabarVisible({showKabar:null})` false; `kabarBannerVisible` false bila `showKabar` mati walau banner true.
- [ ] **Step 2:** `npx vitest run tests/kabar.test.ts` → FAIL (modul belum ada).
- [ ] **Step 3:** Implementasi `src/content/kabarSeo.ts` sesuai Interfaces; impor `parseWIB` dari `@/lib/dates` atau jalur relatif yang juga dibaca build (cek apa yang dipakai `tipsSeo.ts`/`scripts`).
- [ ] **Step 4:** Jalankan tes → PASS.
- [ ] **Step 5:** Commit `feat(kabar): logika aktif/lewat, pengelompokan, filter cabang`.

---

### Task 2: Skema Zod, toggle, koleksi Pages CMS

**Files:**
- Modify: `src/content/schema.ts` (tambah `kabarSchema`, `KabarEntry`, `showKabar`, `showKabarBanner` di skema settings dekat `showTips` baris ±337), `src/content/settings.json` (dua toggle `false`), `.pages.yml` (media `kabar` → `public/uploads/kabar`; koleksi `kabar` format `yaml-frontmatter`, `path: src/content/kabar`, `filename: {template: '{title}.md', field: create}`; dua toggle dengan `default: false` di Pengaturan Situs; cabang memakai blok `# @branch-options-start/end` ditambah satu opsi `semua` "Semua cabang" di luar blok), `scripts/sync-pages-config.mjs` (hanya bila blok cabang multi-select butuh penyesuaian), `src/lib/content.ts` + `src/lib/contentTransforms.ts` (`SettingsEntry`, `features.kabar`), `src/types/site.ts`, `scripts/optimize-images.mjs` + `.github/workflows/optimize-images.yml` (folder uploads kabar, ikuti cara `tips` terdaftar)
- Create: `src/content/kabar/.gitkeep`, `public/uploads/kabar/.gitkeep`
- Test: `tests/kabar-schema.test.ts`; perluas `tests/cms-schema.test.ts` (bandingkan `.pages.yml` ↔ `kabarSchema`, batas karakter, pilihan jenis/status/lokasi) dan `tests/cms-save.test.ts` (simulasi simpan per jenis memakai `tests/helpers/pagesCms.ts` dengan fixture, bukan file CMS)

**Interfaces:**
- Consumes: `KABAR_*` dari Task 1; `requiredText`, `optionalText`, `imageOf`, `tipDate` (jadikan reuse, jangan duplikasi) di `schema.ts`.
- Produces: `kabarSchema` (objek frontmatter + `body`), `type KabarEntry = z.output<typeof kabarSchema>`; settings memuat `showKabar`, `showKabarBanner`.

- [ ] **Step 1: Tes gagal** `tests/kabar-schema.test.ts` (fixture `base()` valid per jenis):
  - Kabar valid; Promo valid (`validUntil` wajib; `validFrom` opsional, `validFrom > validUntil` ditolak); Acara valid (`startsAt`, `endsAt` format `YYYY-MM-DDTHH:mm`).
  - Ditolak: Promo tanpa `validUntil`; Acara tanpa `startsAt`/`endsAt`; **Acara `endsAt` < `startsAt`**; Acara `endsAt` = `startsAt` diterima; Acara tanpa jam (`2026-12-20`) ditolak.
  - Ditolak: `locationType 'Tempat lain'` tanpa `venueAddress` atau tanpa `venueName`; `venueName` 81 karakter; `venueAddress` 201; `'Di cabang'` dengan `venueName` terisi (kombinasi salah); Acara tanpa `locationType`.
  - **Diabaikan (valid)**: Promo dengan kolom acara terisi (`startsAt`, `endsAt`, `locationType`, `venueName`, `linkUrl`) = valid dan hasil parse tidak memuat kolom acara; Acara dengan `validUntil` = valid dan `validUntil` dibuang; Kabar dengan kolom promo/acara terisi (termasuk `endsAt < startsAt` yang salah) = valid dan semuanya dibuang; `'Di cabang'` dengan `venueName` terisi = valid, `venueName` dibuang. Implementasi: `.transform` setelah `superRefine` yang membuang kolom bukan milik `kind`.
  - `linkUrl` hanya `https://` (http ditolak); hanya untuk Acara.
  - `title` 81, `summary` 161 ditolak; `image` terisi tanpa `imageAlt` ditolak; `imageAlt` tanpa `image` diterima/diabaikan (pilih satu, tes mengunci); ekstensi `.gif` ditolak.
  - `branches`: `[]` ditolak, `['semua','cibubur']` ditolak, `['cibubur','bogor-bantarjati']` diterima, `['semua']` diterima.
  - `status 'Terbit'` dengan `body` kosong ditolak; `Draf` boleh kosong.
  - `showKabar` dan `showKabarBanner` default `false` pada settings tanpa kunci itu; `settings.json` memuat `false`.
- [ ] **Step 2:** Jalankan → FAIL.
- [ ] **Step 3:** Implementasi `kabarSchema` dengan `superRefine` per `kind`; tambah toggle; tambah koleksi dan toggle di `.pages.yml` (kolom kondisional Pages CMS tidak ada → semua kolom selalu tampil, `description` menjelaskan kolom mana untuk jenis apa); sambungkan `features.kabar` ke `buildSite`; jalankan `npm run sync-cms` untuk mengisi blok cabang.
- [ ] **Step 4:** Perluas `cms-schema.test.ts` (koleksi `src/content/kabar` ↔ `kabarSchema`, termasuk mutasi batas karakter seperti blok tips) dan `cms-save.test.ts` (satu fixture per jenis: Kabar, Promo cabang tertentu, Acara Tempat lain; buka dan simpan ulang tanpa perubahan; per kombinasi salah → `validateCmsContent` menolak). Karena koleksi kosong, iterasi file harus aman untuk folder tanpa `.md`.
- [ ] **Step 5:** `npx vitest run tests/kabar-schema.test.ts tests/cms-schema.test.ts tests/cms-save.test.ts` → PASS; `npm run typecheck`.
- [ ] **Step 6:** Commit `feat(kabar): skema, toggle CMS (mati), koleksi Pages CMS`.

---

### Task 3: Pipeline build `scripts/kabar.ts`

**Files:**
- Create: `scripts/kabar.ts`
- Modify: `scripts/tips.ts` hanya untuk **meng-export** bagian yang dipakai ulang (`splitFrontmatter`, `renderMarkdown`, `resolveImage`, `jsonLdTag`, `publisher`, `breadcrumbJsonLd`, `esc`) bila belum ter-export; tidak mengubah perilakunya.
- Test: `tests/kabar-build.test.ts`

**Interfaces:**
- Consumes: Task 1 dan 2; `ContentBundle` (cabang), `ImageMeta`, `postalAddress.ts`.
- Produces:
  - `KABAR_DIR = path.join('src','content','kabar')`
  - `readKabarFiles(root: string, fixtures = false): Promise<KabarFile[]>` (fixture = `e2eKabarFiles()` dari Task 7; folder hilang = `[]`)
  - `processKabar(files, { exists, meta, bundle }): { errors: string[]; published: KabarArticle[]; drafts: number }` (validasi Draf juga; slug unik; gambar ada; cabang dikenal: pesan `kabar/<file>: cabang "x" tidak ada di branches.json (pilihan: …)`)
  - `kabarSummaryOf(a: KabarArticle): KabarSummary`
  - `kabarJsonLd(a, site, branches, meta): object` (Kabar/Promo → `BlogPosting`: headline, description, datePublished, publisher Organization, image bila ada; Acara → `Event`: name, description, startDate/endDate dengan `+07:00`, `eventStatus: 'https://schema.org/EventScheduled'`, `eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode'`, `location`, `organizer`, `image` bila ada; tanpa `offers`)
  - `kabarIndexHead(list, site, ogImage): string` (title/description ≤160, canonical, OG, `CollectionPage` + `ItemList` + `BreadcrumbList`), `kabarHead(a, site, branches, meta): string`
  - `kabarIndexBody(list, now): string`, `kabarBody(a, branches, now): string` (ringkasan statis `.prerender`, teks sama dengan komponen React; label "Promo telah berakhir"/"Acara telah selesai" bila lewat)
  - `kabarDataTag(a): string` (`<script type="application/json" id="kabar-item">`)
  - `kabarSitemapEntries(list): {path; lastmod}[]`; `kabarLlmsLines(list, siteUrl, now): string[]` (hanya Promo/Acara aktif + Kabar? **hanya promo dan acara aktif**, plus baris link `/kabar/` ditangani plugin)
  - `branchBoxBody(items: KabarSummary[]): string` (fragmen statis kotak "Promo & acara", `''` bila kosong)
  - `mapsUrl(venueName: string, address: string): string` (`https://www.google.com/maps/search/?api=1&query=…`), dipakai juga komponen React (letakkan di `kabarSeo.ts` agar murni; tes di Task 1 file yang sama)

- [ ] **Step 1: Tes gagal** `tests/kabar-build.test.ts` dengan fixture file (`tests/stubs`-style string frontmatter) dan `contentFixture()`:
  - `processKabar`: Draf tidak masuk `published` tetapi tetap divalidasi; slug ganda ditolak; slug cadangan = nama file; gambar tidak ada → error; cabang tak dikenal → pesan memuat pilihan; `<script>` di isi tampil sebagai teks (Review Focus 4).
  - JSON-LD Acara "Di cabang" (cabang: Cibubur): `@type Event`, `startDate '2026-12-20T10:00:00+07:00'`, `endDate …`, `location[0]['@type']==='Place'` dengan `address['@type']==='PostalAddress'`, `organizer['@type']==='Organization'`, tidak ada kunci `offers`; Acara "Tempat lain": `location.name === venueName`, `address.streetAddress === venueAddress`; gambar ikut hanya bila ada.
  - JSON-LD Promo/Kabar: `BlogPosting` dengan `datePublished`, `publisher.@type==='Organization'`, `image` hanya bila ada.
  - Validitas Rich Results (properti wajib Google untuk Event: `name`, `startDate`, `location` dengan `name`+`address`): helper `requiredEventProps(ld)` mengembalikan daftar kosong.
  - `kabarIndexHead`: `<title>`/description ≤160, ada canonical, JSON-LD `CollectionPage` dengan `mainEntity.ItemList`.
  - `kabarSitemapEntries` memuat `/kabar/` dan detail (termasuk yang lewat) dengan `lastmod = publishedAt`; `kabarLlmsLines` hanya promo/acara aktif (lewat dan Kabar tidak ada).
  - `kabarBody` memuat "Promo telah berakhir" bila lewat; `branchBoxBody([])` = `''`.
- [ ] **Step 2:** Jalankan → FAIL.
- [ ] **Step 3:** Implementasi (reuse export dari `scripts/tips.ts`; tidak menyalin `renderMarkdown`).
- [ ] **Step 4:** Tes PASS; `npm run typecheck`.
- [ ] **Step 5:** Commit `feat(kabar): pipeline build (validasi, JSON-LD, ringkasan statis, sitemap, llms.txt)`.

---

### Task 4: Integrasi plugin Vite, template, navigasi, halaman cabang statis

**Files:**
- Create: `kabar/index.html` (turunan `tips/index.html`: komentar penanda `cutless:head-start/end`, `cutless:body`, `<!--cutless:kabar-data-->`, skrip `/src/kabar.tsx`)
- Modify: `vite.config.ts` (input `kabar`), `scripts/vite-content-plugin.ts` (muat/validasi kabar dalam `loadContent`, `virtual:kabar` berisi `KabarSummary[]` terbit hanya bila `kabarVisible`, `prerenderKabar` mengikuti `prerenderTips`, `disablePage('kabar', kabarRedirects(...), …)`, sitemap/llms/`waClickAllowlist` menerima `kabar`, kotak "Promo & acara" di `branchBody` halaman cabang, rute dev `/kabar/…`, invalidasi modul virtual), `src/vite-env.d.ts` (deklarasi `virtual:kabar`), `src/content/site.ts` (item menu `Kabar` → `/kabar/`), `src/lib/contentTransforms.ts` (saring menu bila `!features.kabar`), `tests/stubs/` (stub `virtual:kabar` seperti `tests/stubs/tips.ts`), `vitest.config.ts` (alias stub), `scripts/check-content.mjs` bila perlu
- Test: `tests/kabar-build.test.ts` (tambah), `tests/kabar-toggle.test.ts`

**Interfaces:**
- Consumes: Task 3. Produces: `sitemap(bundle, tips, services, kabar)` dan `llmsTxt(bundle, tips, services, kabar)` menerima argumen kabar opsional `KabarArticle[]`/`KabarSummary[]` (default `[]`, agar pemanggil lama dan tes lama tidak patah); `dist/kabar/…` hasil prerender; menu `Kabar` bertoggle.

- [ ] **Step 1: Tes gagal** `tests/kabar-toggle.test.ts`:
  - `contentFixture()` bawaan: `showKabar` false → `sitemap(...)` dan `llmsTxt(...)` tidak memuat `/kabar/`; `buildSite(...).nav` tanpa item `/kabar`; `kabarRedirects(false)` ada di keluaran `_redirects` fungsi plugin yang diekspor (ekspor fungsi kecil bila perlu).
  - `showKabar` true + dua item: sitemap memuat `/kabar/` dan dua detail; llms.txt memuat link `/kabar/` + promo aktif; menu memuat `Kabar`.
  - `branchBody` (ekspor yang ada) untuk cabang Cibubur memuat "Promo & acara" dan promo untuk Cibubur/semua, tidak memuat promo cabang lain atau yang lewat; kosong → tanpa kotak.
- [ ] **Step 2:** FAIL. **Step 3:** Implementasi mengikuti pola tips (baca `prerenderTips`, `tipsPage`, `disablePage` di plugin). `now` build = `Date.now()` satu kali per build, diteruskan ke seluruh fungsi. **Step 4:** `npm test` seluruh suite + `npm run build:staging` lokal dengan `showKabar` mati (tidak ada `dist/kabar`) lalu nyalakan sementara di `.env`/fixture e2e (Task 7) untuk memeriksa. **Step 5:** Commit `feat(kabar): integrasi build, menu, sitemap, llms.txt, 301 saat mati`.

---

### Task 5: Halaman React `/kabar/` dan `/kabar/<slug>/`

**Files:**
- Create: `src/kabar.tsx` (entry, meniru `src/tips.tsx`), `src/lib/kabar.ts` (`getKabar()`, `getCurrentKabar()` dari `#kabar-item`, `kabarImage()`), `src/components/pages/KabarPages.tsx` + `KabarPages.module.css`
- Modify: komponen artikel Tips yang diperlukan **hanya** agar bisa dipakai bersama (mis. ekspor `ArticleBody`/gaya prosa dari `TipsPages.tsx`); jangan menyalin.
- Test: `tests/kabar-ui.test.ts` (logika filter murni di `kabarSeo.ts`: `filterKabar(list, { branch?: string; kind?: KabarKind }): KabarSummary[]`; tambahkan ke Task 1 bila lebih mudah)

**Interfaces:**
- Consumes: `getKabar()`, `isKabarActive`, `groupKabar`, `filterKabar`, `useBooking` (lihat `src/lib/useBooking.ts` untuk opsi cabang/pesan), `useBranch`.
- Produces: `KabarIndex` (tiga grup berjudul "Sedang berlangsung & akan datang", "Kabar terbaru", "Sudah berakhir"; filter cabang dan jenis berupa tombol/`<select>`; **semua item ada di HTML statis**, filter sisi klien hanya menyembunyikan lewat atribut `hidden`), `KabarDetail` (judul, jenis, cabang, gambar, isi; Promo: periode; Acara: tanggal/jam/lokasi + tautan peta "Tempat lain" + tombol `linkUrl`; label "Promo telah berakhir"/"Acara telah selesai" dihitung dari jam pengunjung; tombol WA sesuai keputusan 5).

- [ ] **Step 1: Tes gagal** `filterKabar`: cabang `cibubur` memuat item `semua` + `cibubur`; jenis `Promo` saja; gabungan; tanpa penyaring mengembalikan semua.
- [ ] **Step 2:** FAIL → **Step 3:** implementasi `filterKabar` dan komponen. Kelas CSS memakai token yang ada (lihat `TipsPages.module.css`); gambar punya `width/height` (CLS). Rute: `/kabar/` dan `/kabar/<slug>/` dibedakan oleh `parseKabarPath` di `kabarSeo.ts` (sertakan di Task 1 bila belum). Item lewat dihitung di klien dengan `Date.now()`.
- [ ] **Step 4:** `npm run typecheck && npm run lint && npm test`.
- [ ] **Step 5:** Commit `feat(kabar): halaman daftar dan detail`.

---

### Task 6: Kotak "Promo & acara" di halaman cabang dan banner beranda

**Files:**
- Create: `src/components/sections/KabarBranchBox.tsx` (+ `.module.css`), `src/components/sections/KabarBanner.tsx` (+ `.module.css`)
- Modify: `src/components/pages/BranchPages.tsx` (sisipkan kotak), `src/App.tsx` (banner di dalam `Deferred`, sebelum `Promo`; jangan menambah pergeseran tata letak: tinggi tetap lewat `min-height` atau dirender sinkron di render pertama)
- Test: `tests/kabar.test.ts` (tambah kasus `branchBoxItems`/`bannerItem` bila belum), e2e Task 7

**Interfaces:**
- Consumes: `branchBoxItems`, `bannerItem`, `getKabar`, `useSite().site.features.kabar`, `kabarBannerVisible` via fitur (tambahkan `features.kabarBanner` di `buildSite`, Task 2).
- Produces: `<KabarBranchBox branchSlug />` (null bila kosong atau fitur mati), `<KabarBanner />` (null bila fitur/banner mati atau tidak ada yang aktif). Keduanya menghitung dari `Date.now()` di browser (kedaluwarsa otomatis tanpa build). Item `akan-datang` tampil dengan `kabarStartLabel`.
- Produces (**saringan pra-paint, tanpa CLS**, koreksi pemilik): keputusan tampil/sembunyi selesai **sebelum paint pertama**, bukan setelah React render. `kabarPrepaintScript(): string` di `scripts/kabar.ts` (JS inline kecil, tanpa dependensi): untuk setiap elemen `[data-kabar-end]` dengan `Number(end) <= Date.now()` (end = `kabarEndMs` + 1 untuk batas eksklusif, tentukan dan kunci dengan tes) set `hidden`; lalu untuk setiap `[data-kabar-box]` yang semua anaknya `hidden`, set `hidden` pada kotaknya. Skrip disisipkan **langsung setelah markup statis** kotak/banner di dalam `#root` (jalan sinkron saat parsing, sebelum paint). Markup statis memberi `data-kabar-box`, `data-kabar-end`, `data-kabar-start`; render React pertama harus menghasilkan keadaan yang sama (tinggi dan posisi) sehingga penggantian tidak menggeser tata letak. Banner beranda: bila beranda tidak punya ringkasan statis, plugin menyisipkan markup banner (dan skrip itu) ke `#root` beranda saat build; bila tidak memungkinkan, banner dirender sinkron pada render pertama dengan ruang tetap. Pilih yang memberi CLS < 0,005 dan laporkan pilihannya.

- [ ] **Step 1: Tes gagal** — `tests/kabar.test.ts`: batas tanggal (promo hari terakhir masih tampil, `00:00 WIB` esok hari hilang; acara tepat jam selesai hilang; promo akan datang tampil dengan label "Mulai"); `tests/kabar-build.test.ts`: `kabarPrepaintScript()` dijalankan di `jsdom`/`new Function` dengan DOM tiruan atau `happy-dom` bila sudah ada di devDependencies (cek dulu; bila tidak ada, uji dengan Playwright di Task 7 dan di sini uji string: berisi `data-kabar-end` dan tidak memakai `eval`, `innerHTML`); `branchBoxBody` memberi atribut `data-kabar-box`, `data-kabar-end`. **Step 2:** FAIL. **Step 3:** Implementasi komponen dan skrip. Teks kartu = teks ringkasan statis `branchBoxBody` agar tes static-content cocok. **Step 4:** typecheck, lint, test. **Step 5:** Commit `feat(kabar): kotak promo & acara di cabang, banner beranda, saringan pra-paint`.

---

### Task 7: Fixture dan e2e (360 px dan desktop)

**Files:**
- Modify: `e2e/fixtures/content.ts` (tambah `E2E_KABAR` konstanta dan `e2eKabarFiles()`; varian `uniform` menyalakan `showKabar` dan `showKabarBanner`, build bawaan mati), `e2e/static-content.spec.ts`, `e2e/single-main.spec.ts` (daftar halaman kabar), `playwright.config.ts` bila perlu
- Create: `e2e/kabar.spec.ts`, `e2e/fixtures/public/uploads/kabar/gambar-uji.webp` (ikuti cara foto tips/layanan uji disalin ke build E2E)

Fixture (tanggal tetap): Kabar biasa; Promo aktif `cibubur` (`validUntil 2099-12-31`); Promo `semua` lewat (`validUntil 2020-01-01`); Promo aktif dua cabang; Acara "Di cabang" aktif (2099); Acara "Tempat lain" aktif dengan `linkUrl`; Acara lewat (2020); satu Draf (tidak boleh muncul); satu item dengan gambar + alt.

- [ ] **Step 1: Tulis `e2e/kabar.spec.ts`** (proyek 360 dan desktop), dijalankan terhadap `UNIFORM_URL`:
  - `/kabar/`: tiga grup berurutan; Acara terdekat di atas; Draf tidak ada; semua item ada di HTML statis (cek lewat `request.get` tanpa JS); filter cabang `cibubur` menyembunyikan promo cabang lain; filter jenis `Acara`.
  - Detail Kabar, Promo (periode), Acara "Di cabang" (alamat cabang), Acara "Tempat lain" (tautan peta berisi `maps`, tombol pendaftaran `https`), Promo lewat ("Promo telah berakhir", status 200), Acara lewat ("Acara telah selesai").
  - Tombol WA: 1 cabang → `wa.me/<nomor cabang fixture>` dengan judul di `text`; dua cabang → dua tombol; `semua` → pemilih cabang terbuka.
  - Kotak cabang di `/cabang/cibubur/`: memuat promo cibubur + semua aktif, tidak memuat promo lewat; cabang tanpa item → tidak ada kotak.
  - Banner beranda: menaut ke detail item aktif terdekat; satu `<main>`; tanpa scroll horizontal (`scrollWidth <= innerWidth`); CLS < 0,005 (ikuti pengukur CLS di spec yang ada).
  - Build bawaan (toggle mati): `/kabar/` dan detail → 301 ke `/`, menu tanpa Kabar, `/sitemap.xml` tanpa `/kabar`, `/llms.txt` tanpa kabar.
  - Kedaluwarsa klien: `page.clock.setFixedTime` ke 2100-01-01 → kotak cabang dan banner kosong walau HTML statis masih memuatnya.
  - **CLS kasus "sudah lewat tapi masih di HTML statis"** (koreksi pemilik): dengan jam diset ke 2100 sebelum navigasi (`page.clock.install`/`setFixedTime` sebelum `goto`), ukur CLS pada `/cabang/cibubur/` dan `/` dengan `PerformanceObserver` (`layout-shift` tanpa `hadRecentInput`) selama load + 1 detik: total < 0,005, dan kotak/banner tidak pernah terlihat (cek `isVisible` false pada paint pertama lewat `page.addInitScript` yang mencatat visibilitas elemen via `requestAnimationFrame` pertama). Ulangi untuk kasus aktif (CLS < 0,005) dan akan-datang (label "Mulai …" tampil).
  - Status tiga: promo `validFrom` 2099 tampil di `/kabar/` dalam grup "Sedang berlangsung & akan datang" dengan "Mulai …", dan di kotak cabang/banner dengan label itu; fixture memuat promo akan datang dan acara akan datang.
  - Menu: ukur lebar menu desktop 1280 px (tidak ada pembungkusan/overflow `scrollWidth <= clientWidth`). Bila tidak muat, "Kabar" hanya di menu HP dan footer (bukan navbar desktop); laporkan hasil ukur (angka lebar) di laporan akhir.
- [ ] **Step 2:** Jalankan `npx playwright test e2e/kabar.spec.ts` → FAIL/PASS sesuai urutan implementasi; bila Task 4–6 sudah selesai, spec harus PASS; perbaiki kode (bukan melonggarkan tes).
- [ ] **Step 3: static-content**: tambahkan `KABAR_PAGES` (`/kabar/`, dua detail, `/cabang/cibubur/`) ke `e2e/static-content.spec.ts`: teks statis = teks React setelah render (aturan tes itu).
- [ ] **Step 4:** `npm run e2e` penuh → PASS. **Step 5:** Commit `test(kabar): fixture dan e2e 360 px dan desktop`.

---

### Task 8: Kedaluwarsa otomatis (build harian opsional)

**Mekanisme:** (a) **Inti, tanpa setelan baru, Rp0:** browser menyaring promo/acara dengan jam pengunjung (WIB), jadi kotak cabang dan banner hilang tepat waktu tanpa build; sudah dikerjakan di Task 5–6. (b) **Pelengkap:** build terjadwal harian memperbarui HTML statis, JSON-LD, sitemap, `llms.txt` (yang dibaca mesin pencari/AI tanpa JS). Dipicu GitHub Actions → Cloudflare Workers Builds *Deploy Hook* (dikonfirmasi ada di dokumentasi Cloudflare, rilis 1 Apr 2026). Alternatif ditolak: commit kosong terjadwal ke `main` (butuh bypass ruleset untuk Actions, mengotori riwayat), Cron Trigger Worker memanggil hook (butuh secret Worker dan kode Worker baru), HTMLRewriter di Worker (kompleks, tak perlu).

**Untung-rugi:** (a) saja: nol setelan, tetapi HTML statis yang dibaca crawler bisa basi sampai build berikutnya (Save CMS apa pun juga membangun ulang). (a)+(b): HTML statis segar ≤24 jam; butuh 2 langkah pemilik (hook + secret) dan memakai kuota build Workers Builds (1 build/hari, di bawah batas gratis).

**Files:**
- Create: `.github/workflows/build-harian.yml`, `docs/build-harian-kabar.md`
- Modify: `tests/workflows.test.ts` (kasus untuk workflow baru: blok `permissions` minimal `contents: read`, ada `schedule`, tidak mencetak secret)

**Interfaces:** Workflow `Build harian`: `on: schedule: cron '5 17 * * *'` (00.05 WIB), `workflow_dispatch`; `permissions: contents: read`; satu langkah: bila `secrets.CF_DEPLOY_HOOK_URL` kosong → `::notice::` dan keluar 0 (workflow tidak merah sebelum pemilik menyetel); bila ada → `curl -fsS -X POST "$HOOK"` dengan URL dari `env` (tidak di-echo). Jadwal GitHub hanya berjalan dari branch default (`main`), jadi aktif setelah rilis.

- [ ] **Step 1: Tes gagal** di `tests/workflows.test.ts` (ikuti gaya kasus yang ada) → FAIL (file belum ada).
- [ ] **Step 2:** Tulis workflow dan dokumen. **Langkah pemilik di `docs/build-harian-kabar.md`** (agen TIDAK membuat hook atau secret): Cloudflare → Workers & Pages → `cutlesshairstudio` → Settings → Builds → Deploy Hooks → buat hook `build-harian` untuk branch `main`, salin URL (rahasia) → GitHub repo → Settings → Secrets and variables → Actions → New repository secret `CF_DEPLOY_HOOK_URL` → Actions → *Build harian* → Run workflow untuk uji, cek build di Cloudflare ber-trigger `deploy_hook`. **Tambahkan di dokumen** (koreksi pemilik): GitHub menonaktifkan workflow terjadwal otomatis setelah 60 hari repo tanpa aktivitas; cara mengaktifkan lagi: tab Actions → *Build harian* → tombol *Enable workflow* (atau commit/push apa pun ke repo, lalu pastikan statusnya aktif; bisa juga Run workflow manual). Jadwal 00.05 WIB = cron `5 17 * * *` (UTC).
- [ ] **Step 3:** `npx vitest run tests/workflows.test.ts` → PASS. **Step 4:** Commit `chore(kabar): build harian opsional untuk menyegarkan HTML statis`.

---

### Task 9: Dokumentasi, CHANGELOG, verifikasi, push

**Files:** Modify `docs/panduan-admin.md` (bagian "Menerbitkan kabar, promo & acara": menyalakan toggle, membuat Kabar/Promo/Acara, **contoh promo cabang tertentu** (Cibubur saja, berlaku sampai), **contoh acara di tempat lain** (nama tempat + alamat + tautan pendaftaran), arti "berlaku sampai"/"selesai" (promo masih aktif sepanjang hari tersebut sampai 23.59 WIB; acara berakhir tepat jam selesai), apa yang terjadi setelah lewat: hilang dari kotak cabang/banner/tidak di llms.txt, halaman tetap ada dengan label "Promo telah berakhir"/"Acara telah selesai", pindah ke "Sudah berakhir"; kolom jenis lain harus dikosongkan saat mengganti jenis), `CHANGELOG.md` (`## [Belum dirilis]` → Ditambahkan), `README.md` bila memuat daftar halaman, `CONTRIBUTING.md` tidak diubah.

- [ ] **Step 1:** Tulis dokumentasi dan CHANGELOG.
- [ ] **Step 2: verification-before-completion** (jalankan dan tempel keluaran nyata): `npm run typecheck`, `npm run lint`, `npm test`, `npm run check:content`, `npm run build:staging`, `npm run e2e`.
- [ ] **Step 3: Rich Results:** keluarkan HTML `dist-e2e-uniform/kabar/<slug-acara>/index.html`, ekstrak JSON-LD, validasi dengan `requiredEventProps` + pemeriksaan manual daftar properti wajib/rekomendasi Google. Rich Results Test resmi butuh URL publik dan halaman web Google; tidak bisa dijalankan dari sesi ini → laporkan jujur dan beri URL staging untuk dicek pemilik setelah PR di-merge.
- [ ] **Step 4:** Push `git push -u origin feat/kabar` (set upstream ke `origin/feat/kabar`, bukan `origin/staging`), beri link compare `https://github.com/<owner>/<repo>/compare/staging...feat/kabar` (ambil owner/repo dari `git remote get-url origin`). **Jangan merge, jangan push ke main/staging.**
- [ ] **Step 5: Laporan akhir:** link compare, hasil tes (angka nyata), mekanisme kedaluwarsa + langkah pemilik, pertanyaan klien: (1) perlu paginasi /kabar/ bila jumlah item banyak? (2) perlu kolom "diperbarui" untuk `lastmod`? (3) alamat "Tempat lain" tanpa kota/kode pos: cukup untuk Google, atau tambah kolom kota? (4) laporkan hasil ukur menu "Kabar" di navbar desktop dan pilihan penempatan. (Sudah diputuskan pemilik, tidak ditanyakan: kolom jenis lain diabaikan; promo/acara akan datang berstatus tersendiri; satu tombol WA per cabang; banner tanpa saringan cabang.)

---

## Self-review

- **Cakupan:** A (Task 2), B1–B3 (Task 5, 3, 4, 6), B4 (Task 6), B5 (Task 2/4/7), B6 (Task 3 export `tips.ts`, Task 5 reuse), C (Task 1, 6, 8), D (Task 3, 7, 9). Dokumentasi (Task 9). Tes yang diminta: skema/simulasi simpan (2), filter (1/5), aktif vs lewat (1), toggle mati 301 + sitemap (4/7), JSON-LD (3), e2e 360/desktop (7), static-content (7).
- **Risiko yang diakui:** pemeriksaan Rich Results resmi tidak bisa dilakukan dari sesi ini; item menu baru bisa penuh di navbar desktop (diverifikasi di Task 7, dilaporkan); `Deferred` pada banner bisa menimbulkan CLS (diukur di Task 7).

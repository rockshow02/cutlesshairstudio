# API booking: Cutless Hair Studio

Base URL: domain situs (`/api/...`), JSON. Waktu = UTC ISO 8601 (`2026-10-20T03:00:00.000Z`); tanggal jadwal = tanggal lokal cabang `YYYY-MM-DD`.
Skema request ada di `shared/schemas.ts` (Zod, dipakai frontend & Worker).

## Konvensi

- **Login pelanggan**: cookie `cutless_session` (HttpOnly, Secure, SameSite=Lax). Endpoint bertanda 🔒 butuh login; 📝 butuh profil lengkap.
- **Admin** (`/api/admin/*`): Cloudflare Access (header `Cf-Access-Jwt-Assertion`) + email terdaftar aktif di `admin_users`.
- **CSRF**: request yang mengubah data (POST/PATCH/PUT/DELETE) wajib header `Origin` = domain situs.
- **Error**: `{ "error": { "code": "…", "message": "pesan bahasa Indonesia", "details": { … } } }`

| Kode | HTTP | Arti |
|---|---|---|
| `BAD_REQUEST` | 400 | Data tidak valid; `details.fields` berisi pesan per field |
| `TURNSTILE_FAILED` | 400 | Verifikasi anti-bot gagal/belum selesai |
| `UNAUTHENTICATED` | 401 | Belum login / sesi habis / JWT Access tidak valid |
| `PROFILE_INCOMPLETE` | 403 | Nama/nomor WA/persetujuan privasi belum diisi |
| `FORBIDDEN` | 403 | Tidak punya akses (peran/cabang) atau Origin tidak sah |
| `ACCOUNT_BLOCKED` | 403 | Akun diblokir / ≥ 3 kali tidak datang |
| `NOT_FOUND` | 404 | Data/endpoint tidak ada |
| `FEATURE_DISABLED` | 404/503 | Fitur nonaktif / belum dikonfigurasi |
| `SLOT_TAKEN` | 409 | Jam baru saja dibooking; `details.alternatives` = 3 slot terdekat |
| `SLOT_UNAVAILABLE` | 409 | Cabang belum menerima booking |
| `INVALID_TRANSITION` | 409 | Perubahan status tidak diizinkan |
| `DEADLINE_PASSED` | 409 | Lewat batas batal/jadwal ulang online |
| `LIMIT_ACTIVE` | 429 | Sudah 2 booking aktif |
| `LIMIT_DAILY` | 429 | Sudah 5 booking dalam 24 jam |
| `RATE_LIMITED` | 429 | Terlalu banyak request dari IP yang sama |
| `INTERNAL` | 500 | Kesalahan server |

### Paginasi (cursor)

Daftar yang bisa tumbuh panjang memakai **paginasi keyset**, bukan OFFSET: setiap halaman hanya membaca ±`limit + 1` baris D1.

- `?limit=` jumlah per halaman: default **20**, maksimum **50** (nilai di luar batas dibulatkan ke batas, nilai tidak valid → 20).
- `?cursor=` nilai `nextCursor` dari respons sebelumnya. Tanpa `cursor` = halaman pertama.
- Respons menyertakan `nextCursor` (string, atau `null` bila sudah habis). Cursor bersifat opak (base64url `[nilai urut, id]`); jangan dibuat sendiri. Cursor rusak → `400 BAD_REQUEST`.
- Urutan selalu memakai `id` sebagai pemecah seri, sehingga data dengan `start_at`/`created_at` sama tidak terlewat atau terulang antarhalaman.
- `total` hanya disertakan bila hitungannya murah (lihat tiap endpoint).
- Klien lama yang tidak mengirim `limit`/`cursor` tetap berfungsi (mendapat halaman pertama, kunci respons lama tetap ada).

| Endpoint | Urutan | Total |
|---|---|---|
| `GET /api/me/bookings` (riwayat) | `start_at` menurun | `historyTotal` (halaman pertama) |
| `GET /api/admin/customers` | aktivitas terakhir (`last_login_at` atau `created_at`) menurun | `total` (halaman pertama) |
| `GET /api/admin/customers/:id` (riwayat) · `GET /api/admin/customers/:id/bookings` | `start_at` menurun | `bookingsTotal` / `total` |
| `GET /api/admin/time-off` | `start_at` menaik | `total` |
| `GET /api/admin/audit` | `id` menurun | tidak ada (tabel terus tumbuh) |

## Publik

| Endpoint | Keterangan |
|---|---|
| `GET /api/health` | `{ ok, env, branches }` |
| `GET /api/public/catalog` | Cabang, hairstylist, harga dalam bentuk `branches/barbers/pricing.json` (cache 60 detik) |
| `GET /api/booking/branches` | Cabang + pengaturan booking + `dates` (tanggal yang bisa dipilih) + `bookable` |
| `GET /api/booking/services?branch=<slug>` | Layanan bisa-booking di cabang: `id, slug, name, category, duration_min, price, price_from` |
| `GET /api/booking/barbers?branch=<slug>&service=<id\|slug>` | Hairstylist yang bisa mengerjakan layanan |
| `GET /api/availability?branch=&service=&barber=<id\|any>&date=YYYY-MM-DD` | `{ date, timezone, service, slots: [{ time:"14:30", startAt, barberIds:[…] }] }` |

## Login & akun

| Endpoint | Keterangan |
|---|---|
| `GET /api/auth/config` | `{ google, phonePassword, mock, turnstileSiteKey }` |
| `GET /api/auth/google?next=/booking/…` | Redirect ke Google (PKCE, state). Callback: `GET /api/auth/google/callback` → redirect `next` atau `/profil/lengkapi?next=…`. Error → `/masuk?error=dibatalkan\|sesi\|google\|email` |
| `GET /api/auth/mock?email=&name=&secret=&next=` | Login uji (non-produksi; staging wajib `secret`) |
| `POST /api/auth/logout` | Hapus sesi |
| `POST /api/auth/phone` `{ phone, password, turnstileToken }` | Hanya bila `AUTH_PHONE_PASSWORD_ENABLED=true` |
| 🔒 `GET /api/me` | `{ customer: { email, name, phone, status, no_show_count, privacy_consent_at, profileComplete } }` |
| 🔒 `POST /api/me/profile` `{ name, phone, privacyConsent: true }` | Lengkapi profil (nomor → `62xxx`) |
| 🔒 `PATCH /api/me/profile` `{ name, phone }` | Ubah profil |
| 🔒 `DELETE /api/me` | Hapus akun: anonimisasi, booking mendatang dibatalkan |

## Booking pelanggan

| Endpoint | Keterangan |
|---|---|
| 🔒📝 `POST /api/bookings` `{ branch, service, barber: id\|"any", startAt, note?, turnstileToken }` | 201 `{ booking }`. Konfirmasi manual cabang → `status: "pending"` |
| 🔒 `GET /api/me/bookings?limit=&cursor=` | `{ active: […], history: […], nextCursor, historyTotal }`. `active` (menunggu/terkonfirmasi yang belum selesai) selalu lengkap dan hanya dikirim di halaman pertama; halaman berikutnya `active: []`. `history` dipaginasi; `historyTotal` hanya di halaman pertama |
| 🔒 `GET /api/bookings/:id` | Booking milik sendiri |
| 🔒 `POST /api/bookings/:id/cancel` `{ reason? }` | Sampai `cancel_deadline_min` sebelum jadwal |
| 🔒 `POST /api/bookings/:id/reschedule` `{ startAt, barber? }` | Atomik; bentrok → 409 + alternatif |
| 🔒 `GET /api/bookings/:id/ics` | File kalender |

Objek `booking` (pelanggan): `id, code, status, statusLabel, startAt, endAt, timezone, service{ id,name,durationMin,price }, barber{ id,name }, branch{ slug,name,address,whatsapp,mapsUrl }, note, active, canManage, cancelDeadlineMin, cancelledBy, cancelReason`.

## Admin (`/api/admin`, Cloudflare Access)

| Endpoint | Peran | Keterangan |
|---|---|---|
| `GET /me` | semua | Identitas, cabang & barber dalam cakupan, fitur |
| `GET /bookings?from=&to=&branch=&barber=&status=` | semua (barber: miliknya) | Jadwal + data pelanggan (nama, nomor) |
| `POST /bookings/:id/status` `{ status, reason? }` | owner/branch_admin; barber: `completed`/`no_show` miliknya | `confirmed`/`completed`/`no_show`/`cancelled` (alasan wajib untuk batal) |
| `POST /bookings/:id/reschedule` `{ startAt, barber? }` | owner/branch_admin | Pindah jadwal (tanpa batas waktu pelanggan) |
| `POST /bookings/:id/note` `{ note }` | semua dalam cakupan | Catatan admin |
| `POST /bookings` `{ branch, service, barber, startAt, source: walk_in\|admin, customerId \| guestName+guestPhone, note? }` | owner/branch_admin | Walk-in/telepon; tamu tidak membuat akun login |
| `GET /availability?branch=&service=&barber=&date=&exclude=<bookingId>` | semua dalam cakupan | Tanpa lead time |
| `GET /customers?q=&limit=&cursor=` | owner/branch_admin | `{ customers, nextCursor, total? }`. Cari nama/nomor/email; pencarian berlaku di semua halaman. `total` hanya di halaman pertama. branch_admin: pelanggan yang pernah booking di cabangnya |
| `GET /customers/:id?limit=` | owner/branch_admin | `{ customer, bookings, bookingsNextCursor, bookingsTotal }`: halaman pertama riwayat booking (branch_admin: hanya cabangnya) |
| `GET /customers/:id/bookings?limit=&cursor=` | owner/branch_admin | `{ bookings, nextCursor, total }`: halaman riwayat berikutnya |
| `POST /customers/:id/block` · `/unblock` | owner/branch_admin | Buka blokir mereset hitungan tidak datang |
| `POST /customers/:id/password` `{ password }` | owner/branch_admin | Hanya bila login nomor+password aktif |
| `GET /reports/summary` · `GET /reports/export.csv?from=&to=&branch=` | owner/branch_admin | Ringkasan & CSV |
| `GET /branches` · `PUT /branches/:id/settings` | owner/branch_admin (cabangnya) | Lead time, batas hari, batas batal, konfirmasi manual, Telegram, jam buka |
| `POST /branches` · `PUT /branches/:id` | owner | Data cabang |
| `GET /barbers` · `POST /barbers` · `PUT /barbers/:id` | owner/branch_admin | Termasuk `services[]` & `working[]` |
| `GET /services` · `POST /services` · `PUT /services/:id` | owner (lihat: branch_admin) | Layanan, durasi, buffer, harga dasar |
| `PUT /services/:id/branches/:branchId` `{ price\|null, is_active }` | owner/branch_admin (cabangnya) | Harga & ketersediaan per cabang |
| `GET /time-off?limit=&cursor=` · `POST /time-off` · `POST /time-off/:id/approve\|reject` · `DELETE /time-off/:id` | semua (barber: ajukan miliknya, status pending) | Libur cabang & cuti. GET: `{ timeOff, nextCursor, total }`, yang berakhir dalam 30 hari terakhir & mendatang |
| `GET /admin-users` · `PUT /admin-users` | owner | Akun admin |
| `GET /audit?limit=&cursor=` | owner | `{ entries, nextCursor }`, aksi terbaru dulu (tampil di Pengaturan → Log aktivitas) |

Semua aksi admin & pelanggan yang mengubah data tercatat di `audit_log`.

## Cutless Stamp (loyalitas)

Aktif bila env **`LOYALTY_ENABLED=true`** (staging) **dan** `loyalty_settings.enabled = 1` (owner). Produksi tidak punya variabel itu → fitur mati; perilaku booking tidak berubah. Saat mati, endpoint pelanggan mengembalikan `{ enabled: false }`.

| Endpoint | Peran | Keterangan |
|---|---|---|
| `GET /api/loyalty/program` | publik (cache 60 dtk) | `{ enabled, tier1: { stamps, services[] }, tier2, stampValidMonths, voucherValidDays }` |
| 🔒 `GET /api/me/loyalty` | pelanggan | `{ enabled, card: { stamps, cycle, tier1, tier2, next: { tier, remaining } }, vouchers: [aktif] }` |
| 🔒 `GET /api/me/loyalty/stamps?limit=&cursor=` | pelanggan | `{ stamps, nextCursor }` (terbaru dulu) |
| `GET /api/admin/loyalty/settings` · `PUT` | lihat: owner/branch_admin · ubah: owner | `{ available, settings }`; PUT `{ enabled, tier1_stamps, tier1_service_ids[], tier2_stamps, tier2_service_ids[], stamp_valid_months, voucher_valid_days }` |
| `GET /api/admin/customers/:id/loyalty` (+ `/stamps?cursor=`) | owner/branch_admin (cabangnya) | `{ card, vouchers, stamps, stampsNextCursor, mergeCandidates }` |
| `POST /api/admin/customers/:id/loyalty/adjust` `{ delta: 1\|-1, reason }` | owner | Penyesuaian manual (alasan wajib, audit) |
| `POST /api/admin/customers/:id/loyalty/merge` `{ guestId }` | owner/branch_admin | Pindah stempel & voucher tamu bernomor sama ke akun (hanya bila tepat 1 akun bernomor itu). Idempoten: `{ moved: { stamps, vouchers } }` |
| `GET /api/admin/bookings/:id/vouchers` | owner/branch_admin | `{ enabled, redeemed, eligible }` |
| `POST /api/admin/bookings/:id/voucher` `{ voucherId }` · `DELETE` | owner/branch_admin (cabangnya) | Tukar / batalkan penukaran (booking menunggu/terkonfirmasi). Harga booking → 0, booking itu tanpa stempel. Gagal → `409 VOUCHER_UNAVAILABLE` |
| `POST /api/admin/bookings` | | Tambahan opsional `voucherId` (pelanggan terdaftar). Booking tetap dibuat; bila voucher gagal → `voucherError` |
| `GET /api/admin/reports/summary` | | Tambahan `loyalty: { stamps, stampsByAdmin[], vouchersRedeemed, vouchersRedeemedValue, vouchersIssued?, vouchersExpired?, vouchersActive? }` |
| `GET /api/admin/bookings` | | Tambahan `voucher_code` per booking |

**Aturan di server** (semua dalam `db.batch` yang sama dengan perubahan status, idempoten, tercatat di `audit_log`):
- Status → `completed`: stempel bila layanan bisa dibooking & bukan kategori Paket, tidak dibayar voucher, dan belum ada stempel di tanggal lokal cabang yang sama (`UNIQUE(customer_id, stamp_date)` untuk stempel booking; `UNIQUE(booking_id)`). Lalu voucher tingkat 1/2 terbit bila target tercapai (`UNIQUE(issue_key)`); di tingkat 2 stempel siklus itu menjadi `used` dan siklus kartu +1.
- Status → `cancelled` / `no_show`: voucher yang ditukar di booking itu kembali `active` (atau `expired` bila lewat `expires_at`), harga booking dipulihkan.

Kode error baru: `VOUCHER_UNAVAILABLE` (409): voucher sudah ditukar, kedaluwarsa, layanan tidak cocok, atau booking sudah Selesai.

## Cron (Worker `scheduled`)

| Jadwal | Tugas |
|---|---|
| `*/15 * * * *` | Batalkan pending > 2 jam atau < 60 menit sebelum jadwal (`cancelled_by = system`, slot dilepas, notifikasi Telegram); hapus sesi kedaluwarsa & catatan rate limit > 1 hari |
| `0 19 * * *` (02.00 WIB) | Anonimkan pelanggan tanpa login & tanpa booking > 24 bulan; Cutless Stamp: stempel & voucher lewat masa berlaku → `expired` |

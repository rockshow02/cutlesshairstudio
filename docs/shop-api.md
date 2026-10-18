# Cutless Shop: API, data & migrasi

Toko produk (pomade, clay, dll.) di atas Worker + D1 yang sama dengan booking. **Rp0**: tanpa payment gateway berbayar, tanpa layanan ongkir berbayar (RajaOngkir Starter gratis 100 hit/hari, opsional, mati default).

## Flag

| Syarat | Di mana |
|---|---|
| `SHOP_ENABLED = "true"` | `wrangler.jsonc` → `env.staging.vars` saja. Produksi tidak punya variabel ini → toko mati. |
| Toko aktif | **Admin → Toko → Pengaturan → Toko aktif** (`shop_settings.enabled`, default 0) |

Toko mati: `/api/shop/config` → `{ "enabled": false }`, endpoint pesanan 404, landing page & `/produk` tetap memakai `src/content/products.json`.
Toko aktif: `GET /api/public/catalog` menambah `products` (bentuk sama dengan `products.json` + `slug`); kartu produk mengarah ke `/shop/<slug>`.

Ongkir otomatis hanya bila **ketiganya**: pengaturan `shipping_provider = rajaongkir`, env `SHIPPING_PROVIDER = "rajaongkir"`, secret `RAJAONGKIR_API_KEY` (dipasang owner: `wrangler secret put RAJAONGKIR_API_KEY --env staging`). Selain itu, atau bila kuota/galat → ongkir manual (admin mengisi). Checkout tidak pernah gagal karena ongkir.

## Aturan utama

- **Harga dihitung server** (`POST /api/shop/quote`, `POST /api/shop/orders`); klien hanya mengirim `variantId` + `qty`. Harga, nama, berat disimpan sebagai **snapshot** di `order_items`; ongkir & kode unik di `orders`. Semua uang = **rupiah bulat**.
- **Anti-oversell:** pesanan + `variant_stock.reserved += qty` dalam satu `db.batch`. `CHECK (reserved <= on_hand)` menolak kelebihan → seluruh batch batal → 409 `STOCK_UNAVAILABLE` (diuji 8 pembeli bersamaan untuk stok 3).
- **Stok fisik berkurang saat barang keluar:** diambil (Siap diambil → Sudah diambil), dikirim, atau dibayar di kasir (ambil saat booking). Batal/kedaluwarsa/refund sebelum keluar → reservasi dilepas.
- **Batas beli per pelanggan** (`per_customer_limit`): jumlah produk itu di **semua pesanan non-batal** (bukan `cancelled`/`expired`) + yang baru.
- **Drop:** `release_at` di masa depan → tampil "Segera", tidak bisa dipesan.
- Efek transisi memakai `orders.transition_id` (token per transisi), jadi stok/pembayaran/stempel/audit hanya ditulis sekali walau dua admin menekan bersamaan.

## Status pesanan

| Status | Arti | Masuk lewat |
|---|---|---|
| `awaiting_quote` | Kirim, ongkir manual belum diisi | checkout `ship_manual` |
| `awaiting_payment` | Menunggu transfer/QRIS (batas `payment_window_min`, default 24 jam) | checkout ambil/kirim otomatis, atau admin mengisi ongkir |
| `reserved_booking` | Diambil & dibayar di kasir saat booking | checkout/booking `with_booking` |
| `paid` → `ready` → `completed` | Ambil di cabang | admin |
| `paid` → `shipped` → `completed` | Kirim | admin (resi wajib) → pelanggan "Pesanan diterima" / admin / otomatis 7 hari |
| `cancelled` · `expired` · `refunded` | | pelanggan/admin · cron · admin |

| Aksi | Dari | Pelaku |
|---|---|---|
| `quote` (ongkir) | awaiting_quote | admin |
| `paid` (Tandai Lunas) | awaiting_payment | admin. Nominal ≠ total → 409 `AMOUNT_MISMATCH` `{ total, amount }`; kirim ulang dengan `confirmMismatch: true` |
| `ready` | paid (ambil di cabang) | admin; `pickup_due_at = ready + pickup_window_days` |
| `ship` | paid (kirim) | admin |
| `complete` | ready, reserved_booking (admin) · shipped (admin, pelanggan, sistem) | |
| `cancel` | awaiting_quote, awaiting_payment, reserved_booking | pelanggan, admin (alasan wajib), sistem (booking batal/tidak datang) |
| `expire` | awaiting_payment | sistem |
| `refund` | paid, ready, shipped | admin (alasan wajib) |

**Lewat batas ambil** (`ready` dan `pickup_due_at` lewat): tidak dibatalkan (sudah dibayar). Tampil di admin sebagai **Belum diambil** (filter `status=overdue`) dan Telegram cabang dikirim **sekali** (`pickup_overdue_notified_at`).

**Kode unik transfer** (per cabang, `unique_code_enabled`): total + Rp1–999 saat masuk `awaiting_payment`. QRIS statis: halaman pesanan menampilkan nominal persis untuk diketik pelanggan.

**Stempel Cutless Stamp:** pesanan `completed` dengan subtotal ≥ `stamp_min_subtotal` (default Rp100.000) → 1 stempel `kind='order'`. Batas 1/hari **gabungan** booking + belanja (indeks unik `loyalty_stamps_daily`). Pesanan batal tidak pernah memberi stempel.

## Endpoint pelanggan

| Metode | Path | Catatan |
|---|---|---|
| GET | `/api/shop/config` | `{ enabled, branches[{ id, slug, name, fulfillment[], payment{transfer,qris,uniqueCode} }], categories, paymentWindowMin, pickupWindowDays, returnPolicy, stampMinSubtotal }` |
| GET | `/api/shop/products?category=&limit=&cursor=` | keyset (`sort_order, id`), `{ products, nextCursor }`; stok tersedia per cabang di `variants[].stock` |
| GET | `/api/shop/products/:slug` | |
| POST | `/api/shop/quote` | `{ branch, items[{variantId, qty}], fulfillment?, regionId? }` → `{ lines[{…, error?}], subtotal, weightGram, ok, rates }` |
| GET | `/api/shop/regions?q=` | login; wilayah tujuan (cache D1) |
| POST | `/api/shop/orders` | login + profil lengkap, Turnstile, rate limit 10/jam/IP. `{ branch, items, fulfillment, paymentMethod, bookingId?, shipping?, rate?, note?, turnstileToken }` → 201 `{ order, fallbackToManual }` |
| POST | `/api/bookings/:id/products` | `{ items, note? }` → pesanan `with_booking` untuk booking aktif milik pelanggan |
| GET | `/api/me/orders?limit=&cursor=` | terbaru dulu |
| GET | `/api/me/orders/:id` | termasuk `payment` (nominal, kode unik, rekening/QRIS, batas bayar, WhatsApp cabang) & `actions` |
| POST | `/api/me/orders/:id/cancel` · `/received` | |

Halaman: `/shop`, `/shop/<slug>`, `/shop/checkout`, `/pesanan`, `/pesanan/<id>` (entri Vite booking; `run_worker_first` staging: `/shop*`, `/pesanan*`). Keranjang di `localStorage` (hanya id varian + jumlah).

## Endpoint admin (`/api/admin`, Cloudflare Access)

| Metode | Path | Peran |
|---|---|---|
| GET | `/shop/settings` | owner, admin cabang (lihat) |
| PUT | `/shop/settings` · `/shop/branches/:id` | owner |
| GET | `/shop/regions?q=` | owner (asal pengiriman) |
| GET | `/shop/products?q=&limit=&cursor=` | termasuk nonaktif |
| POST · PUT | `/shop/products` · `/shop/products/:id` | owner. Foto diganti semua; varian di-upsert, varian lama yang tidak dikirim **dinonaktifkan** (bukan dihapus) |
| PUT | `/shop/stock` `{ branchId, variantId, onHand, reason }` | owner semua cabang, admin cabang cabangnya; tidak boleh < reserved (409) |
| GET | `/shop/orders?status=&branch=&q=&limit=&cursor=` | admin cabang hanya cabangnya; `status=overdue` = belum diambil |
| GET | `/shop/orders/:id` | |
| POST | `/shop/orders/:id/(quote\|paid\|ready\|ship\|complete\|cancel\|refund)` | `{ shippingFee, courier, service, trackingNo, amount, method, confirmMismatch, reason, note }` |
| GET | `/shop/summary?branch=&days=30` | omzet, produk terlaris, stok menipis, perlu tindakan, belum diambil |
| GET | `/bookings/:id/orders` | produk yang diambil saat booking |

Hairstylist (barber) tidak punya akses toko.

## Cron (`*/15 * * * *`, sama dengan booking)

1. `awaiting_payment` lewat `payment_due_at` → `expired`, reservasi dilepas.
2. `shipped` lebih dari `auto_complete_days` (7) → `completed` (by `system`, dapat stempel bila memenuhi).
3. `ready` lewat `pickup_due_at` → ditandai + Telegram "Pesanan belum diambil" sekali.

Notifikasi Telegram cabang: pesanan baru, perlu isi ongkir, lunas, batal/refund, belum diambil. Pelanggan menghubungi cabang lewat tautan WhatsApp (kirim bukti bayar, tanya pesanan).

## Data & seed

`migrations/0003_shop.sql`: `shop_settings`, `shop_branch_settings`, `products`, `product_images`, `product_variants`, `variant_stock`, `orders`, `order_items`, `payments`, `shipping_regions`, `shipping_region_queries`, `shipping_rate_cache`, `shipping_api_usage`, plus **pembangunan ulang `loyalty_stamps`** (kolom `order_id`, kind `order`).

Seed produk sekali dari `products.json` (foto tetap path media Pages CMS; stok tidak diisi):

```
npm run db:seed:shop:local       # lokal
npm run db:seed:shop:staging     # staging (--remote, dijalankan owner)
```

Aman diulang: slug yang sudah ada tidak ditimpa.

## Langkah migrasi staging (dijalankan owner)

> Kode `feature/shop` merujuk tabel `orders` saat booking dibatalkan, jadi **migrasi 0003 harus sudah jalan di staging sebelum merge**.

1. **Cadangan** (pilih salah satu, sebaiknya keduanya):
   ```
   npx wrangler d1 export DB --env staging --remote --output backup-staging-sebelum-0003.sql
   npx wrangler d1 time-travel info DB --env staging     # catat bookmark sebelum migrasi
   ```
2. **Hitung baris sebelum:**
   ```
   npx wrangler d1 execute DB --env staging --remote --command "SELECT (SELECT COUNT(*) FROM loyalty_stamps) AS stamps, (SELECT COUNT(*) FROM loyalty_stamps WHERE status='active') AS active, (SELECT COUNT(*) FROM bookings) AS bookings, (SELECT COUNT(*) FROM loyalty_vouchers) AS vouchers"
   ```
3. **Migrasi:** `npm run db:migrate:staging` (hanya `0003_shop.sql` yang tertunda).
4. **Hitung baris sesudah** (perintah yang sama di langkah 2) → angka harus **identik**. Cek indeks:
   ```
   npx wrangler d1 execute DB --env staging --remote --command "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='loyalty_stamps' ORDER BY name"
   ```
   Harus ada `loyalty_stamps_card`, `loyalty_stamps_created`, `loyalty_stamps_daily`, `loyalty_stamps_expiry` + 3 `sqlite_autoindex_loyalty_stamps_*` (id, booking_id, order_id).
5. Bila ada yang tidak cocok: `npx wrangler d1 time-travel restore DB --env staging --bookmark <bookmark langkah 1>` lalu laporkan.
6. Setelah merge & deploy: `curl https://<staging>/api/shop/config` → `{"enabled":false}`. Toko dinyalakan owner di Admin → Toko → Pengaturan setelah seed & stok diisi.

Tes migrasi di D1 lokal berisi data: `tests/migration-0003.test.ts` (jumlah & isi baris sama, semua indeks & constraint lama ada, constraint baru bekerja).

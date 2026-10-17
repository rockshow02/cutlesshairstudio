-- Cutless Shop (produk, varian, stok per cabang, pesanan, pembayaran manual, ongkir) + stempel dari belanja.
-- Aman untuk database berisi data: tabel baru saja, KECUALI loyalty_stamps yang dibangun ulang (lihat bawah)
-- agar stempel bisa berasal dari pesanan dan batas 1 stempel/hari berlaku gabungan booking + belanja.
-- Toko MATI secara default (shop_settings.enabled = 0; env SHOP_ENABLED juga harus 'true').

-- ---------------------------------------------------------------- Pengaturan
CREATE TABLE shop_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  -- Batas waktu bayar sejak pesanan dibuat / ongkir diisi (menit)
  payment_window_min INTEGER NOT NULL DEFAULT 1440 CHECK (payment_window_min BETWEEN 30 AND 20160),
  -- Batas ambil sejak "siap diambil" (hari): lewat = ditandai "belum diambil" (tanpa batal otomatis)
  pickup_window_days INTEGER NOT NULL DEFAULT 7 CHECK (pickup_window_days BETWEEN 1 AND 60),
  -- Pesanan dikirim otomatis Selesai N hari setelah dikirim
  auto_complete_days INTEGER NOT NULL DEFAULT 7 CHECK (auto_complete_days BETWEEN 1 AND 60),
  -- Subtotal produk minimal untuk 1 stempel Cutless Stamp
  stamp_min_subtotal INTEGER NOT NULL DEFAULT 100000 CHECK (stamp_min_subtotal >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 3 CHECK (low_stock_threshold >= 0),
  return_policy TEXT NOT NULL DEFAULT '',
  -- manual | rajaongkir (rajaongkir juga butuh env SHIPPING_PROVIDER & secret RAJAONGKIR_API_KEY)
  shipping_provider TEXT NOT NULL DEFAULT 'manual' CHECK (shipping_provider IN ('manual', 'rajaongkir')),
  -- Batas hit API ongkir per hari (paket gratis RajaOngkir: 100/hari); habis → ongkir manual
  shipping_daily_limit INTEGER NOT NULL DEFAULT 90 CHECK (shipping_daily_limit BETWEEN 0 AND 100000),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT
);
INSERT OR IGNORE INTO shop_settings (id, return_policy) VALUES (
  1,
  'Produk yang sudah dibuka tidak dapat dikembalikan. Produk rusak/salah kirim dapat ditukar maksimal 2 hari setelah diterima dengan menghubungi WhatsApp cabang.'
);

CREATE TABLE shop_branch_settings (
  branch_id INTEGER PRIMARY KEY REFERENCES branches(id),
  pickup_enabled INTEGER NOT NULL DEFAULT 1 CHECK (pickup_enabled IN (0, 1)),
  with_booking_enabled INTEGER NOT NULL DEFAULT 1 CHECK (with_booking_enabled IN (0, 1)),
  ship_manual_enabled INTEGER NOT NULL DEFAULT 0 CHECK (ship_manual_enabled IN (0, 1)),
  ship_auto_enabled INTEGER NOT NULL DEFAULT 0 CHECK (ship_auto_enabled IN (0, 1)),
  bank_name TEXT,
  bank_account_no TEXT,
  bank_account_name TEXT,
  -- Path gambar QRIS statis (upload lewat media Pages CMS)
  qris_image TEXT,
  payment_note TEXT,
  -- Tambah kode unik 1–999 rupiah ke total transfer (memudahkan cocokkan mutasi)
  unique_code_enabled INTEGER NOT NULL DEFAULT 0 CHECK (unique_code_enabled IN (0, 1)),
  -- Asal pengiriman untuk ongkir otomatis (id wilayah penyedia) + label
  origin_region_id TEXT,
  origin_label TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT OR IGNORE INTO shop_branch_settings (branch_id) SELECT id FROM branches;

-- ---------------------------------------------------------------- Katalog
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug GLOB '[a-z0-9]*' AND slug NOT GLOB '*[^a-z0-9-]*'),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  -- Catatan pemakaian / detail
  notes TEXT,
  badge TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 100,
  -- Drop: sebelum waktu ini tampil hitung mundur, tidak bisa dibeli
  release_at TEXT,
  -- Batas beli per pelanggan (semua pesanan non-batal untuk produk ini); NULL = tanpa batas
  per_customer_limit INTEGER CHECK (per_customer_limit IS NULL OR per_customer_limit >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX products_list ON products (is_active, sort_order, id);
CREATE INDEX products_category ON products (category);

CREATE TABLE product_images (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  alt TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX product_images_product ON product_images (product_id, sort_order);

CREATE TABLE product_variants (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT UNIQUE,
  -- Nama tampilan, mis. "100 gr · Original"
  name TEXT NOT NULL,
  -- JSON opsi, mis. {"ukuran":"100 gr","aroma":"Original"}
  options TEXT NOT NULL DEFAULT '{}',
  price INTEGER NOT NULL CHECK (price >= 0),
  compare_at_price INTEGER CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  weight_gram INTEGER NOT NULL DEFAULT 200 CHECK (weight_gram > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX product_variants_product ON product_variants (product_id, sort_order);

-- Stok per cabang per varian. reserved = sudah dipesan (belum diambil/dikirim).
-- Anti-oversell: CHECK reserved <= on_hand → reservasi melebihi stok membatalkan seluruh batch pesanan.
CREATE TABLE variant_stock (
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  on_hand INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (branch_id, variant_id),
  CHECK (reserved <= on_hand)
);

-- ---------------------------------------------------------------- Pesanan
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  -- Cabang asal: stok, ambil di cabang, asal pengiriman
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  fulfillment TEXT NOT NULL CHECK (fulfillment IN ('pickup', 'with_booking', 'ship_manual', 'ship_auto')),
  booking_id TEXT REFERENCES bookings(id),
  status TEXT NOT NULL CHECK (status IN ('awaiting_quote', 'awaiting_payment', 'reserved_booking', 'paid', 'ready', 'shipped', 'completed', 'cancelled', 'expired', 'refunded')),
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
  shipping_fee INTEGER CHECK (shipping_fee IS NULL OR shipping_fee >= 0),
  -- Kode unik transfer (0–999) ditambahkan ke total bila diaktifkan cabang
  unique_code INTEGER NOT NULL DEFAULT 0 CHECK (unique_code BETWEEN 0 AND 999),
  discount INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total INTEGER NOT NULL CHECK (total >= 0),
  -- transfer | qris | cashier (bayar di kasir saat booking) | gateway (kelak)
  payment_method TEXT NOT NULL CHECK (payment_method IN ('transfer', 'qris', 'cashier', 'gateway')),
  payment_due_at TEXT,
  paid_at TEXT,
  recipient_name TEXT,
  recipient_phone TEXT,
  address TEXT,
  region_id TEXT,
  region_label TEXT,
  postal_code TEXT,
  weight_gram INTEGER NOT NULL DEFAULT 0,
  courier TEXT,
  courier_service TEXT,
  tracking_no TEXT,
  ready_at TEXT,
  pickup_due_at TEXT,
  -- Notifikasi "belum diambil" sudah dikirim (sekali)
  pickup_overdue_notified_at TEXT,
  shipped_at TEXT,
  completed_at TEXT,
  -- customer | admin | system
  completed_by TEXT,
  cancelled_at TEXT,
  cancelled_by TEXT CHECK (cancelled_by IS NULL OR cancelled_by IN ('customer', 'admin', 'system')),
  cancel_reason TEXT,
  customer_note TEXT,
  admin_note TEXT,
  -- Penanda transisi status terakhir (UUID): pernyataan stok/stempel dalam batch yang sama hanya berlaku
  -- untuk transisi yang benar-benar terjadi (aman dari permintaan bersamaan)
  transition_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX orders_transition ON orders (transition_id);
CREATE INDEX orders_customer ON orders (customer_id, created_at);
CREATE INDEX orders_branch_status ON orders (branch_id, status, created_at);
CREATE INDEX orders_status_due ON orders (status, payment_due_at);
CREATE INDEX orders_booking ON orders (booking_id);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER NOT NULL REFERENCES product_variants(id),
  product_name TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  sku TEXT,
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  qty INTEGER NOT NULL CHECK (qty >= 1),
  line_total INTEGER NOT NULL CHECK (line_total >= 0),
  weight_gram INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX order_items_order ON order_items (order_id);
CREATE INDEX order_items_product ON order_items (product_id);

-- Pembayaran (manual sekarang; gateway kelak cukup menambah provider + provider_ref)
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  method TEXT NOT NULL CHECK (method IN ('transfer', 'qris', 'cashier', 'gateway')),
  provider TEXT NOT NULL DEFAULT 'manual',
  provider_ref TEXT UNIQUE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
  note TEXT,
  confirmed_by TEXT,
  confirmed_at TEXT,
  raw TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX payments_order ON payments (order_id);

-- ---------------------------------------------------------------- Ongkir otomatis (cache, hemat kuota API)
CREATE TABLE shipping_regions (
  provider TEXT NOT NULL,
  id TEXT NOT NULL,
  label TEXT NOT NULL,
  search_text TEXT NOT NULL,
  postal_code TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (provider, id)
);
CREATE INDEX shipping_regions_search ON shipping_regions (provider, search_text);
CREATE TABLE shipping_region_queries (
  provider TEXT NOT NULL,
  query TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (provider, query)
);
CREATE TABLE shipping_rate_cache (
  key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE shipping_api_usage (
  provider TEXT NOT NULL,
  day TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (provider, day)
);

-- ---------------------------------------------------------------- Cutless Stamp: stempel dari belanja
-- SQLite tidak bisa mengubah CHECK: loyalty_stamps dibangun ulang (salin semua baris), ditambah order_id
-- (UNIQUE) dan kind 'order'. Semua constraint & indeks lama dibuat ulang; indeks harian kini mencakup
-- booking + order (maks. 1 stempel per pelanggan per tanggal lokal, gabungan).
CREATE TABLE loyalty_stamps_new (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  booking_id TEXT UNIQUE REFERENCES bookings(id),
  order_id TEXT UNIQUE REFERENCES orders(id),
  branch_id INTEGER REFERENCES branches(id),
  stamp_date TEXT NOT NULL,
  cycle INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('booking', 'manual', 'order')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'removed')),
  reason TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  CHECK (booking_id IS NULL OR order_id IS NULL)
);
INSERT INTO loyalty_stamps_new (id, customer_id, booking_id, order_id, branch_id, stamp_date, cycle, kind, status, reason, created_by, created_at, expires_at)
SELECT id, customer_id, booking_id, NULL, branch_id, stamp_date, cycle, kind, status, reason, created_by, created_at, expires_at FROM loyalty_stamps;
DROP TABLE loyalty_stamps;
ALTER TABLE loyalty_stamps_new RENAME TO loyalty_stamps;
CREATE UNIQUE INDEX loyalty_stamps_daily ON loyalty_stamps (customer_id, stamp_date) WHERE kind IN ('booking', 'order');
CREATE INDEX loyalty_stamps_card ON loyalty_stamps (customer_id, status, cycle);
CREATE INDEX loyalty_stamps_expiry ON loyalty_stamps (status, expires_at);
CREATE INDEX loyalty_stamps_created ON loyalty_stamps (created_at);

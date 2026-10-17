-- Cutless Stamp (kartu stempel loyalitas). Aman untuk database yang sudah berisi data:
-- hanya tabel & indeks baru + satu baris pengaturan default (program MATI). Tidak mengubah tabel lama.

-- ---------------------------------------------------------------- Pengaturan program (satu baris)
CREATE TABLE loyalty_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  -- Program aktif (owner). Juga butuh env LOYALTY_ENABLED=true di Worker.
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  tier1_stamps INTEGER NOT NULL DEFAULT 5 CHECK (tier1_stamps >= 1),
  -- JSON array id layanan hadiah, mis. [14,5]
  tier1_service_ids TEXT NOT NULL DEFAULT '[]',
  tier2_stamps INTEGER NOT NULL DEFAULT 10 CHECK (tier2_stamps >= 2),
  tier2_service_ids TEXT NOT NULL DEFAULT '[]',
  stamp_valid_months INTEGER NOT NULL DEFAULT 12 CHECK (stamp_valid_months >= 1),
  voucher_valid_days INTEGER NOT NULL DEFAULT 60 CHECK (voucher_valid_days >= 1),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT,
  CHECK (tier1_stamps < tier2_stamps)
);

-- Default hadiah: stempel ke-5 = Hair Wash & Styling / Hot Towel Shave, ke-10 = Signature Haircut
-- (bila layanan dengan slug itu ada; bisa diubah owner di Admin → Pengaturan → Cutless Stamp)
INSERT OR IGNORE INTO loyalty_settings (id, tier1_service_ids, tier2_service_ids)
VALUES (
  1,
  COALESCE((SELECT json_group_array(id) FROM services WHERE slug IN ('hair-wash-styling', 'hot-towel-shave')), '[]'),
  COALESCE((SELECT json_group_array(id) FROM services WHERE slug = 'signature-haircut'), '[]')
);

-- ---------------------------------------------------------------- Kartu (siklus) per pelanggan
CREATE TABLE loyalty_cards (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id),
  -- Siklus kartu ke-n; naik setelah hadiah tingkat 2 (kartu kembali ke 0)
  cycle INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------------------------------------------------------------- Stempel
CREATE TABLE loyalty_stamps (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  -- Satu booking tidak pernah mendapat dua stempel. NULL = penyesuaian manual owner.
  booking_id TEXT UNIQUE REFERENCES bookings(id),
  branch_id INTEGER REFERENCES branches(id),
  -- Tanggal lokal cabang (YYYY-MM-DD) dari jam mulai booking: batas 1 stempel/hari lintas cabang
  stamp_date TEXT NOT NULL,
  cycle INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('booking', 'manual')),
  -- active = dihitung di kartu; used = sudah ditukar jadi hadiah tingkat 2; expired = hangus; removed = dicabut owner
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'removed')),
  reason TEXT,
  -- Email admin/hairstylist yang menandai Selesai (atau owner untuk manual)
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL
);
CREATE UNIQUE INDEX loyalty_stamps_daily ON loyalty_stamps (customer_id, stamp_date) WHERE kind = 'booking';
CREATE INDEX loyalty_stamps_card ON loyalty_stamps (customer_id, status, cycle);
CREATE INDEX loyalty_stamps_expiry ON loyalty_stamps (status, expires_at);
CREATE INDEX loyalty_stamps_created ON loyalty_stamps (created_at);

-- ---------------------------------------------------------------- Voucher hadiah
CREATE TABLE loyalty_vouchers (
  id TEXT PRIMARY KEY,
  -- Kode untuk ditunjukkan di kasir, mis. CS-7K2Q9M
  code TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  -- "<pelanggan>:<siklus>:<tingkat>" saat terbit: satu voucher per tingkat per siklus (tetap walau digabung)
  issue_key TEXT NOT NULL UNIQUE,
  tier INTEGER NOT NULL CHECK (tier IN (1, 2)),
  -- Snapshot layanan yang boleh ditukar (JSON array id)
  service_ids TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired')),
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  -- Satu voucher untuk satu booking
  redeemed_booking_id TEXT UNIQUE REFERENCES bookings(id),
  redeemed_at TEXT,
  redeemed_by TEXT,
  -- Harga layanan saat ditukar (untuk laporan; harga booking menjadi 0)
  value_snapshot INTEGER
);
CREATE INDEX loyalty_vouchers_customer ON loyalty_vouchers (customer_id, status);
CREATE INDEX loyalty_vouchers_expiry ON loyalty_vouchers (status, expires_at);

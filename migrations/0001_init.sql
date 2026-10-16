-- Skema awal sistem booking Cutless Hair Studio (Cloudflare D1 / SQLite).
-- Semua waktu disimpan UTC sebagai teks ISO 8601 (Date#toISOString, mis. 2026-10-20T03:00:00.000Z),
-- sehingga perbandingan teks = perbandingan waktu. Jam kerja/buka disimpan sebagai jam lokal cabang "HH:MM".
-- Hari: 0 = Minggu … 6 = Sabtu (sama dengan Date#getDay).

-- ---------------------------------------------------------------- Cabang
CREATE TABLE branches (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug GLOB '[a-z0-9]*' AND slug NOT GLOB '*[^a-z0-9-]*'),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  address TEXT,
  maps_url TEXT,
  lat REAL,
  lng REAL,
  whatsapp TEXT NOT NULL CHECK (whatsapp GLOB '62[0-9]*'),
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta' CHECK (timezone IN ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'coming_soon', 'closed')),
  photo TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  booking_lead_min INTEGER NOT NULL DEFAULT 60 CHECK (booking_lead_min >= 0),
  booking_max_days INTEGER NOT NULL DEFAULT 14 CHECK (booking_max_days BETWEEN 1 AND 90),
  cancel_deadline_min INTEGER NOT NULL DEFAULT 120 CHECK (cancel_deadline_min >= 0),
  require_manual_confirmation INTEGER NOT NULL DEFAULT 0 CHECK (require_manual_confirmation IN (0, 1)),
  telegram_chat_id TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Jam buka cabang per hari (tidak ada baris = tutup hari itu)
CREATE TABLE branch_hours (
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  open_time TEXT NOT NULL CHECK (open_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  close_time TEXT NOT NULL CHECK (close_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  PRIMARY KEY (branch_id, weekday),
  CHECK (open_time < close_time)
);

-- ---------------------------------------------------------------- Layanan & harga
CREATE TABLE services (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  duration_min INTEGER NOT NULL CHECK (duration_min BETWEEN 5 AND 600),
  buffer_min INTEGER NOT NULL DEFAULT 10 CHECK (buffer_min BETWEEN 0 AND 120),
  -- Harga dasar (global). Harga khusus cabang di branch_services.price
  base_price INTEGER NOT NULL CHECK (base_price >= 0),
  price_from INTEGER NOT NULL DEFAULT 0 CHECK (price_from IN (0, 1)),
  badge TEXT,
  -- 0 = hanya tampil di daftar harga (mis. Paket/membership), tidak bisa dibooking per jam
  is_bookable INTEGER NOT NULL DEFAULT 1 CHECK (is_bookable IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE branch_services (
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  -- NULL = memakai services.base_price
  price INTEGER CHECK (price IS NULL OR price >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  PRIMARY KEY (branch_id, service_id)
);

-- ---------------------------------------------------------------- Hairstylist & jadwal kerja
CREATE TABLE barbers (
  id INTEGER PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  name TEXT NOT NULL,
  role TEXT,
  photo TEXT,
  specialty TEXT,
  instagram TEXT,
  -- Opsional: WA pribadi (tombol "Booking via WhatsApp" di kartu barber); NULL = WA cabang
  whatsapp TEXT CHECK (whatsapp IS NULL OR whatsapp GLOB '62[0-9]*'),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX barbers_branch ON barbers (branch_id, is_active, sort_order);

CREATE TABLE barber_services (
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (barber_id, service_id)
);

-- Boleh lebih dari satu rentang per hari (mis. 10:00–13:00 dan 14:00–21:00)
CREATE TABLE working_hours (
  id INTEGER PRIMARY KEY,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL CHECK (start_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  end_time TEXT NOT NULL CHECK (end_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  CHECK (start_time < end_time)
);
CREATE INDEX working_hours_barber ON working_hours (barber_id, weekday);

-- Cuti/sakit barber (barber_id) atau libur cabang/hari raya (branch_id)
CREATE TABLE time_off (
  id INTEGER PRIMARY KEY,
  barber_id INTEGER REFERENCES barbers(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('cuti', 'sakit', 'libur_cabang', 'hari_raya', 'lainnya')),
  note TEXT,
  -- Pengajuan barber: pending sampai disetujui admin; yang dibuat admin langsung approved
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (barber_id IS NOT NULL OR branch_id IS NOT NULL),
  CHECK (start_at < end_at)
);
CREATE INDEX time_off_barber ON time_off (barber_id, start_at);
CREATE INDEX time_off_branch ON time_off (branch_id, start_at);

-- ---------------------------------------------------------------- Pelanggan & sesi
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE,
  email TEXT,
  name TEXT NOT NULL DEFAULT '',
  -- 62xxx; NULL sampai profil dilengkapi
  phone TEXT CHECK (phone IS NULL OR phone GLOB '62[0-9]*'),
  password_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  no_show_count INTEGER NOT NULL DEFAULT 0,
  privacy_consent_at TEXT,
  -- 1 = tamu walk-in/telepon yang dicatat admin (tidak bisa login)
  is_guest INTEGER NOT NULL DEFAULT 0 CHECK (is_guest IN (0, 1)),
  anonymized_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_login_at TEXT
);
CREATE INDEX customers_phone ON customers (phone);
CREATE INDEX customers_email ON customers (email);
CREATE INDEX customers_last_login ON customers (last_login_at);

-- Yang disimpan hanya hash SHA-256 dari ID sesi di cookie
CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  user_agent TEXT
);
CREATE INDEX sessions_customer ON sessions (customer_id);
CREATE INDEX sessions_expires ON sessions (expires_at);

-- ---------------------------------------------------------------- Booking
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  barber_id INTEGER NOT NULL REFERENCES barbers(id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  price_snapshot INTEGER NOT NULL,
  duration_snapshot INTEGER NOT NULL,
  service_name_snapshot TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'no_show', 'cancelled')),
  source TEXT NOT NULL CHECK (source IN ('online', 'walk_in', 'admin')),
  customer_note TEXT,
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  confirmed_at TEXT,
  cancelled_at TEXT,
  -- system = dibatalkan otomatis (pending tidak dikonfirmasi)
  cancelled_by TEXT CHECK (cancelled_by IS NULL OR cancelled_by IN ('customer', 'admin', 'system')),
  cancel_reason TEXT,
  completed_at TEXT,
  no_show_at TEXT,
  CHECK (start_at < end_at)
);
CREATE INDEX bookings_branch_start ON bookings (branch_id, start_at);
CREATE INDEX bookings_barber_start ON bookings (barber_id, start_at);
CREATE INDEX bookings_customer ON bookings (customer_id, status);
CREATE INDEX bookings_status ON bookings (status, created_at);

-- Kunci anti-bentrok: satu baris per 15 menit yang dipakai (durasi + buffer). UNIQUE mencegah dobel booking.
CREATE TABLE booking_slots (
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  barber_id INTEGER NOT NULL REFERENCES barbers(id),
  slot_start TEXT NOT NULL,
  UNIQUE (barber_id, slot_start)
);
CREATE INDEX booking_slots_booking ON booking_slots (booking_id);

-- ---------------------------------------------------------------- Admin & audit
CREATE TABLE admin_users (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  name TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'branch_admin', 'barber')),
  branch_id INTEGER REFERENCES branches(id),
  -- Untuk role barber: barber yang dimiliki akun ini
  barber_id INTEGER REFERENCES barbers(id),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (role = 'owner' OR branch_id IS NOT NULL),
  CHECK (role <> 'barber' OR barber_id IS NOT NULL)
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'customer', 'system')),
  actor_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX audit_entity ON audit_log (entity, entity_id);
CREATE INDEX audit_created ON audit_log (created_at);

-- Batas pembuatan booking per IP (rate limit sederhana tanpa layanan berbayar)
CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

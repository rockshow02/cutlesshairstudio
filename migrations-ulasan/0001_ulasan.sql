-- Balasan ulasan Google (database terpisah dari hitungan klik): cutless-ulasan / cutless-ulasan-staging.
-- Hanya data yang tampil di Google + status kerja. Tanpa email, nomor HP, IP, atau data pribadi lain.
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  branch TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL DEFAULT '',
  reviewed_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('baru', 'antre', 'terkirim', 'dilewati', 'gagal')),
  draft TEXT NOT NULL DEFAULT '',
  approved_by TEXT,
  approved_at TEXT,
  sent_auto INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT,
  emailed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reviews_status_time ON reviews (status, reviewed_at);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

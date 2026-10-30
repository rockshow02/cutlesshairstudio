-- Penghitung klik tombol WhatsApp per hari (WIB). Satu baris = satu kombinasi; klik berikutnya menambah `clicks` (UPSERT).
-- TIDAK ada kolom IP, nomor HP, isi pesan, cookie, atau ID pengunjung: hanya nilai dari daftar yang diizinkan
-- (src/content/waClicks.ts). Database: cutless-analytics (produksi) & cutless-analytics-staging (staging).
CREATE TABLE IF NOT EXISTS wa_clicks (
  day TEXT NOT NULL,              -- tanggal WIB, YYYY-MM-DD
  kind TEXT NOT NULL,             -- jenis tombol: umum, cabang, kapster, tips, cuci-sepatu, produk, promo
  branch TEXT NOT NULL DEFAULT '', -- slug cabang ('' = belum memilih cabang)
  barber TEXT NOT NULL DEFAULT '', -- kunci kapster dari nama ('' = bukan tombol kapster)
  page TEXT NOT NULL,             -- halaman asal, mis. /cabang/cibubur/ ('lainnya' = halaman tak dikenal)
  source TEXT NOT NULL,           -- asal kunjungan: google, instagram, ..., langsung, lainnya
  clicks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, branch, barber, page, source)
) WITHOUT ROWID;

-- Statistik per cabang dalam rentang tanggal (filter rentang tanggal memakai awalan primary key: day)
CREATE INDEX IF NOT EXISTS wa_clicks_branch_day ON wa_clicks (branch, day);

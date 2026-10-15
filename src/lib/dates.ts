/**
 * Tanggal dari Pages CMS disimpan tanpa zona waktu (mis. "2026-10-20T10:00"), diisi admin dalam WIB.
 * Fungsi ini mengubahnya menjadi waktu absolut sehingga perbandingan "sekarang" benar di zona mana pun.
 */
export function parseWIB(value: string, endOfDay = false): number {
  const v = value.trim().replace(' ', 'T');
  // Hanya tanggal: mulai = 00:00 WIB, selesai = 23:59:59 WIB
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return Date.parse(`${v}T${endOfDay ? '23:59:59' : '00:00:00'}+07:00`);
  // Sudah ada zona waktu (Z / +07:00)
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(v)) return Date.parse(v);
  const withSeconds = /T\d{2}:\d{2}$/.test(v) ? `${v}:00` : v;
  return Date.parse(`${withSeconds}+07:00`);
}

/** Nilai tanggal → ISO 8601 UTC (untuk tipe frontend) */
export function toIsoWIB(value: string, endOfDay = false): string {
  return new Date(parseWIB(value, endOfDay)).toISOString();
}

/** Aktif sekarang? Tanggal kosong = tidak dibatasi. Dievaluasi di browser saat halaman dibuka. */
export function isActiveNow(start?: string | null, end?: string | null, now = Date.now()): boolean {
  if (start && parseWIB(start) > now) return false;
  if (end && parseWIB(end, true) < now) return false;
  return true;
}

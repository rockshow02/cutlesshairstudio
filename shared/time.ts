/**
 * Waktu: database menyimpan UTC (ISO), jadwal cabang memakai jam lokal "HH:MM" di zona waktu cabang.
 * Dipakai Worker & frontend. Tanpa library: Intl.DateTimeFormat (tersedia di Workers & browser).
 */

const MINUTE = 60_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatters.set(tz, f);
  }
  return f;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function localParts(ms: number, tz: string): LocalParts {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== 'literal' && p.type !== 'weekday') out[p.type] = Number(p.value);
  }
  return out as unknown as LocalParts;
}

/** Selisih zona waktu (menit) pada saat `ms`, mis. Asia/Jakarta → 420 */
export function tzOffsetMinutes(ms: number, tz: string): number {
  const p = localParts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / MINUTE);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "HH:MM" → menit sejak tengah malam */
export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
/** menit sejak tengah malam → "HH:MM" */
export const fromMinutes = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/** Tanggal lokal "YYYY-MM-DD" + menit lokal → epoch ms (UTC) */
export function zonedToUtc(date: string, minutes: number, tz: string): number {
  const [y, mo, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, 0, minutes);
  // Dua kali agar tepat di sekitar perubahan offset (Indonesia tidak memakai DST, tapi tetap aman)
  let ms = guess - tzOffsetMinutes(guess, tz) * MINUTE;
  ms = guess - tzOffsetMinutes(ms, tz) * MINUTE;
  return ms;
}

/** epoch ms → tanggal lokal "YYYY-MM-DD" */
export function localDate(ms: number, tz: string): string {
  const p = localParts(ms, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** epoch ms → jam lokal "HH:MM" */
export function localTime(ms: number, tz: string): string {
  const p = localParts(ms, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Hari dalam minggu untuk tanggal kalender "YYYY-MM-DD": 0 = Minggu … 6 = Sabtu */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "YYYY-MM-DD" + n hari */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Selisih hari kalender b − a */
export function daysBetween(a: string, b: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** Awal & akhir hari lokal dalam UTC ms: [mulai, akhir) */
export function localDayRange(date: string, tz: string): [number, number] {
  return [zonedToUtc(date, 0, tz), zonedToUtc(addDays(date, 1), 0, tz)];
}

export const iso = (ms: number) => new Date(ms).toISOString();
export const MINUTE_MS = MINUTE;

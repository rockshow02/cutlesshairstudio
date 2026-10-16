/** Format tanggal/jam di zona waktu cabang, Rupiah, dan link WhatsApp untuk halaman booking & admin. */
import { formatPhone } from '@shared/booking';

export const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

const fmt = (tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('id-ID', { timeZone: tz, ...o });

/** "Senin, 20 Oktober 2026" */
export const longDate = (iso: string, tz: string) => fmt(tz, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
/** "Sen, 20 Okt" */
export const shortDate = (iso: string, tz: string) => fmt(tz, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
/** "14.30" */
export const clock = (iso: string, tz: string) => fmt(tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
/** Label zona: WIB/WITA/WIT */
export const tzLabel = (tz: string) => ({ 'Asia/Jakarta': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' })[tz] ?? tz;

/** Tanggal kalender "YYYY-MM-DD" → label chip ("Hari ini", "Besok", "Rab 22 Okt") */
export function dateChip(date: string, index: number): { top: string; bottom: string } {
  const d = new Date(`${date}T12:00:00Z`);
  const day = new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'UTC' }).format(d);
  const dm = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
  return { top: index === 0 ? 'Hari ini' : index === 1 ? 'Besok' : day, bottom: dm };
}

export const waLink = (number: string, text: string) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
export { formatPhone };

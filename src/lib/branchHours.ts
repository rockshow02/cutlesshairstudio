import type { Announcement, Branch, BranchCopy, BranchOpenStatus, DayIndex, OpeningHour } from '@/types';
import { formatTime } from './format';
import { fillTemplate } from './whatsapp';

const WEEKDAY_INDEX: Record<string, DayIndex> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_LABEL: Record<DayIndex, string> = { 0: 'Minggu', 1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu' };

/** Hari & menit sekarang di zona waktu cabang (bukan zona waktu perangkat pengunjung). */
export function nowInTimezone(timeZone: string, now = Date.now()): { day: DayIndex; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(now));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { day: WEEKDAY_INDEX[get('weekday')] ?? 0, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

const toMinutes = (hhmm?: string) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

const isOpenDay = (h?: OpeningHour): h is OpeningHour & { open: string; close: string } =>
  Boolean(h && !h.closed && h.open && h.close);

/** Pengumuman aktif yang berlaku untuk cabang (semua cabang, atau cabang ini) */
export function announcementsFor(branch: Branch, announcements: Announcement[]): Announcement[] {
  return announcements.filter((a) => a.branchSlugs.length === 0 || a.branchSlugs.includes(branch.slug));
}

/**
 * Status buka cabang saat ini, dihitung dari jam buka dalam zona waktu cabang.
 * Pengumuman aktif bertipe "Tutup" / "Jam Khusus" untuk cabang ini mengalahkan jadwal biasa.
 */
export function getOpenStatus(
  branch: Branch,
  labels: BranchCopy['labels'],
  announcements: Announcement[] = [],
  now = Date.now(),
): BranchOpenStatus {
  if (branch.status === 'Segera Dibuka') return { state: 'coming-soon', label: labels.comingSoonNote };
  if (branch.status === 'Tutup Sementara') return { state: 'temporarily-closed', label: labels.temporarilyClosedNote };

  const relevant = announcementsFor(branch, announcements);
  if (relevant.some((a) => a.type === 'Tutup')) return { state: 'closed-today', label: labels.closedToday };
  const special = relevant.find((a) => a.type === 'Jam Khusus');
  if (special) return { state: 'special', label: fillTemplate(labels.specialHours, { message: special.message }) };

  if (!branch.hours.some(isOpenDay)) return { state: 'unknown', label: '' };

  const { day, minutes } = nowInTimezone(branch.timezone, now);
  const today = branch.hours.find((h) => h.day === day);
  if (isOpenDay(today)) {
    const open = toMinutes(today.open) ?? 0;
    const close = toMinutes(today.close) ?? 0;
    const vars = { open: formatTime(today.open), close: formatTime(today.close) };
    if (minutes >= open && minutes < close) return { state: 'open', label: fillTemplate(labels.openNow, vars) };
    if (minutes < open) return { state: 'later-today', label: fillTemplate(labels.opensLaterToday, vars) };
  }

  // Hari ini tutup, atau sudah lewat jam tutup → cari hari buka berikutnya
  for (let offset = 1; offset <= 7; offset += 1) {
    const next = branch.hours.find((h) => h.day === (day + offset) % 7);
    if (!isOpenDay(next)) continue;
    if (offset === 1) return { state: 'opens-tomorrow', label: fillTemplate(labels.opensTomorrow, { open: formatTime(next.open) }) };
    if (!isOpenDay(today)) return { state: 'closed-today', label: labels.closedToday };
    return { state: 'opens-later', label: fillTemplate(labels.opensOn, { day: DAY_LABEL[next.day], open: formatTime(next.open) }) };
  }
  return { state: 'closed-today', label: labels.closedToday };
}

/** Hari ini (zona waktu cabang) untuk menandai baris tabel jam buka */
export const todayIndex = (branch: Branch, now = Date.now()) => nowInTimezone(branch.timezone, now).day;

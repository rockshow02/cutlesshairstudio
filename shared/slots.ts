/**
 * Mesin slot (fungsi murni, tanpa database) dipakai API ketersediaan, pembuatan booking,
 * jadwal ulang, dan tes.
 *
 * Slot tersedia = jam kerja barber ∩ jam buka cabang − time off (barber/cabang) − booking aktif,
 * untuk durasi layanan + buffer, langkah 15 menit, dan layanan harus SELESAI sebelum jam kerja berakhir.
 * Batas: mulai ≥ sekarang + lead time; tanggal ≤ hari ini + batas hari.
 */
import { addDays, daysBetween, iso, localDate, MINUTE_MS, toMinutes, zonedToUtc, fromMinutes } from './time';

export const SLOT_MINUTES = 15;
const SLOT_MS = SLOT_MINUTES * MINUTE_MS;

export interface TimeRange {
  /** epoch ms UTC */
  start: number;
  end: number;
}

export interface BarberInput {
  id: number;
  sortOrder: number;
  /** Jam kerja pada hari itu (jam lokal cabang), boleh lebih dari satu rentang */
  working: { start: string; end: string }[];
  /** Cuti/sakit barber yang beririsan dengan hari itu */
  timeOff: TimeRange[];
  /** Awal blok 15 menit yang sudah terpakai booking aktif (epoch ms) */
  busy: Set<number>;
  /** Jumlah booking aktif barber pada hari itu (untuk "Siapa saja") */
  bookingsThatDay: number;
}

export interface AvailabilityInput {
  /** Tanggal lokal cabang "YYYY-MM-DD" */
  date: string;
  timezone: string;
  /** Jam buka cabang hari itu; null = tutup */
  branchHours: { open: string; close: string } | null;
  /** Libur cabang / hari raya yang beririsan dengan hari itu */
  branchTimeOff: TimeRange[];
  barbers: BarberInput[];
  durationMin: number;
  bufferMin: number;
  /** epoch ms "sekarang" (disuntikkan agar bisa dites) */
  now: number;
  leadMin: number;
  maxDays: number;
}

export interface Slot {
  /** Jam lokal "HH:MM" */
  time: string;
  /** UTC ISO */
  startAt: string;
  /** Barber yang bisa melayani di jam ini (urut sort_order) */
  barberIds: number[];
}

/** Jumlah blok 15 menit yang dikunci untuk durasi + buffer */
export const blocksFor = (durationMin: number, bufferMin: number) => Math.ceil((durationMin + bufferMin) / SLOT_MINUTES);

/** Awal semua blok 15 menit (ISO) yang dikunci booking ini → baris booking_slots */
export function slotStartsFor(startMs: number, durationMin: number, bufferMin: number): string[] {
  return Array.from({ length: blocksFor(durationMin, bufferMin) }, (_, i) => iso(startMs + i * SLOT_MS));
}

const overlaps = (aStart: number, aEnd: number, ranges: TimeRange[]) => ranges.some((r) => aStart < r.end && r.start < aEnd);

/** Tanggal masih dalam jendela booking? (tidak lampau, ≤ maxDays hari ke depan) */
export function isDateBookable(date: string, timezone: string, now: number, maxDays: number): boolean {
  const today = localDate(now, timezone);
  const diff = daysBetween(today, date);
  return diff >= 0 && diff <= maxDays;
}

/** Daftar tanggal yang bisa dipilih (hari ini … hari ini + maxDays) */
export function bookableDates(timezone: string, now: number, maxDays: number): string[] {
  const today = localDate(now, timezone);
  return Array.from({ length: maxDays + 1 }, (_, i) => addDays(today, i));
}

export function computeSlots(input: AvailabilityInput): Slot[] {
  const { date, timezone, branchHours, durationMin, bufferMin } = input;
  if (!branchHours || !isDateBookable(date, timezone, input.now, input.maxDays)) return [];

  const earliest = input.now + input.leadMin * MINUTE_MS;
  const blocks = blocksFor(durationMin, bufferMin);
  const openMin = toMinutes(branchHours.open);
  const closeMin = toMinutes(branchHours.close);
  const byStart = new Map<number, number[]>();

  const sortedBarbers = [...input.barbers].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  for (const barber of sortedBarbers) {
    for (const range of barber.working) {
      // Jam kerja ∩ jam buka cabang (menit lokal)
      const from = Math.max(toMinutes(range.start), openMin);
      const to = Math.min(toMinutes(range.end), closeMin);
      // Mulai pada kelipatan 15 menit
      let startMin = Math.ceil(from / SLOT_MINUTES) * SLOT_MINUTES;
      for (; startMin + durationMin <= to; startMin += SLOT_MINUTES) {
        const start = zonedToUtc(date, startMin, timezone);
        if (start < earliest) continue;
        const lockEnd = start + blocks * SLOT_MS;
        if (overlaps(start, lockEnd, barber.timeOff) || overlaps(start, lockEnd, input.branchTimeOff)) continue;
        let free = true;
        for (let k = 0; k < blocks && free; k++) if (barber.busy.has(start + k * SLOT_MS)) free = false;
        if (!free) continue;
        const list = byStart.get(start) ?? [];
        if (!list.includes(barber.id)) list.push(barber.id);
        byStart.set(start, list);
      }
    }
  }

  return [...byStart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([start, barberIds]) => ({
      time: fromMinutes(Math.round((start - zonedToUtc(date, 0, timezone)) / MINUTE_MS)),
      startAt: iso(start),
      barberIds,
    }));
}

/**
 * "Siapa saja": barber yang tersedia dengan booking paling sedikit hari itu; seri → sort_order.
 */
export function pickBarber(candidateIds: number[], barbers: Pick<BarberInput, 'id' | 'sortOrder' | 'bookingsThatDay'>[]): number | undefined {
  return barbers
    .filter((b) => candidateIds.includes(b.id))
    .sort((a, b) => a.bookingsThatDay - b.bookingsThatDay || a.sortOrder - b.sortOrder || a.id - b.id)[0]?.id;
}

/** 3 slot terdekat dari waktu yang diminta (untuk pesan "Jam ini baru saja dibooking") */
export function nearestSlots(slots: Slot[], targetIso: string, count = 3): Slot[] {
  const target = Date.parse(targetIso);
  return [...slots].sort((a, b) => Math.abs(Date.parse(a.startAt) - target) - Math.abs(Date.parse(b.startAt) - target)).slice(0, count).sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/** Memuat data jadwal dari D1 lalu menghitung slot dengan mesin slot bersama (shared/slots.ts). */
import { computeSlots, type BarberInput, type Slot, type TimeRange } from '../../shared/slots';
import { localDayRange, weekdayOf } from '../../shared/time';
import { notFound, badRequest } from './errors';

export interface BranchRow {
  id: number;
  slug: string;
  name: string;
  city: string;
  province: string;
  address: string | null;
  maps_url: string | null;
  lat: number | null;
  lng: number | null;
  whatsapp: string;
  timezone: string;
  status: 'active' | 'coming_soon' | 'closed';
  photo: string | null;
  sort_order: number;
  booking_lead_min: number;
  booking_max_days: number;
  cancel_deadline_min: number;
  require_manual_confirmation: number;
  telegram_chat_id: string | null;
}

export interface ServiceRow {
  id: number;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  duration_min: number;
  buffer_min: number;
  base_price: number;
  price_from: number;
  badge: string | null;
  is_bookable: number;
  is_active: number;
  sort_order: number;
}

export interface BranchServiceRow extends ServiceRow {
  /** Harga efektif di cabang (harga khusus atau harga dasar) */
  price: number;
}

export async function getBranch(db: D1Database, ref: string | number): Promise<BranchRow> {
  const row =
    typeof ref === 'number' || /^\d+$/.test(String(ref))
      ? await db.prepare('SELECT * FROM branches WHERE id = ?').bind(Number(ref)).first<BranchRow>()
      : await db.prepare('SELECT * FROM branches WHERE slug = ?').bind(ref).first<BranchRow>();
  if (!row) throw notFound('Cabang tidak ditemukan.');
  return row;
}

/** Layanan yang bisa dibooking di cabang, dengan harga efektif */
export async function getBranchService(db: D1Database, branchId: number, serviceRef: string | number): Promise<BranchServiceRow> {
  const byId = typeof serviceRef === 'number' || /^\d+$/.test(String(serviceRef));
  const row = await db
    .prepare(
      `SELECT s.*, COALESCE(bs.price, s.base_price) AS price
       FROM services s JOIN branch_services bs ON bs.service_id = s.id AND bs.branch_id = ?
       WHERE ${byId ? 's.id = ?' : 's.slug = ?'} AND s.is_active = 1 AND s.is_bookable = 1 AND bs.is_active = 1`,
    )
    .bind(branchId, byId ? Number(serviceRef) : serviceRef)
    .first<BranchServiceRow>();
  if (!row) throw notFound('Layanan tidak tersedia di cabang ini.');
  return row;
}

interface LoadOptions {
  branch: BranchRow;
  service: { id: number; duration_min: number; buffer_min: number };
  /** Barber tertentu; undefined = "Siapa saja" */
  barberId?: number;
  date: string;
  now: number;
  /** Booking yang sedang dijadwal ulang: slotnya dianggap kosong */
  excludeBookingId?: string;
  /** Admin (walk-in): abaikan lead time */
  ignoreLead?: boolean;
}

export interface AvailabilityResult {
  slots: Slot[];
  barbers: BarberInput[];
}

/** Semua data untuk satu cabang + layanan + tanggal → slot */
export async function loadAvailability(db: D1Database, o: LoadOptions): Promise<AvailabilityResult> {
  const { branch, service, date } = o;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('Format tanggal harus YYYY-MM-DD.');
  if (branch.status !== 'active') return { slots: [], barbers: [] };

  const weekday = weekdayOf(date);
  const [dayStart, dayEnd] = localDayRange(date, branch.timezone);
  const dayStartIso = new Date(dayStart).toISOString();
  // Blok booking yang dimulai sebelum tengah malam bisa meluber ±4 jam ke hari ini
  const busyFromIso = new Date(dayStart - 4 * 3_600_000).toISOString();
  const dayEndIso = new Date(dayEnd).toISOString();

  const barberFilter = o.barberId !== undefined ? 'AND b.id = ?' : '';
  const barberBind = o.barberId !== undefined ? [o.barberId] : [];

  const [hoursRes, barbersRes, workingRes, timeOffRes, busyRes, countRes] = await db.batch([
    db.prepare('SELECT open_time, close_time FROM branch_hours WHERE branch_id = ? AND weekday = ?').bind(branch.id, weekday),
    db
      .prepare(
        `SELECT b.id, b.sort_order FROM barbers b JOIN barber_services bs ON bs.barber_id = b.id AND bs.service_id = ?
         WHERE b.branch_id = ? AND b.is_active = 1 ${barberFilter} ORDER BY b.sort_order, b.id`,
      )
      .bind(service.id, branch.id, ...barberBind),
    db
      .prepare(
        `SELECT w.barber_id, w.start_time, w.end_time FROM working_hours w JOIN barbers b ON b.id = w.barber_id
         WHERE b.branch_id = ? AND w.weekday = ? ORDER BY w.start_time`,
      )
      .bind(branch.id, weekday),
    db
      .prepare(
        `SELECT barber_id, branch_id, start_at, end_at FROM time_off
         WHERE status = 'approved' AND start_at < ? AND end_at > ?
           AND (branch_id = ? OR barber_id IN (SELECT id FROM barbers WHERE branch_id = ?))`,
      )
      .bind(dayEndIso, dayStartIso, branch.id, branch.id),
    db
      .prepare(
        `SELECT s.barber_id, s.slot_start FROM booking_slots s JOIN barbers b ON b.id = s.barber_id
         WHERE b.branch_id = ? AND s.slot_start >= ? AND s.slot_start < ? AND s.booking_id <> ?`,
      )
      .bind(branch.id, busyFromIso, dayEndIso, o.excludeBookingId ?? ''),
    db
      .prepare(
        `SELECT barber_id, COUNT(*) AS n FROM bookings
         WHERE branch_id = ? AND status IN ('pending', 'confirmed') AND start_at >= ? AND start_at < ? GROUP BY barber_id`,
      )
      .bind(branch.id, dayStartIso, dayEndIso),
  ]);

  const hours = (hoursRes.results as { open_time: string; close_time: string }[])[0];
  const working = workingRes.results as { barber_id: number; start_time: string; end_time: string }[];
  const timeOff = timeOffRes.results as { barber_id: number | null; branch_id: number | null; start_at: string; end_at: string }[];
  const busy = busyRes.results as { barber_id: number; slot_start: string }[];
  const counts = new Map((countRes.results as { barber_id: number; n: number }[]).map((r) => [r.barber_id, r.n]));
  const range = (t: { start_at: string; end_at: string }): TimeRange => ({ start: Date.parse(t.start_at), end: Date.parse(t.end_at) });

  const barbers: BarberInput[] = (barbersRes.results as { id: number; sort_order: number }[]).map((b) => ({
    id: b.id,
    sortOrder: b.sort_order,
    working: working.filter((w) => w.barber_id === b.id).map((w) => ({ start: w.start_time, end: w.end_time })),
    timeOff: timeOff.filter((t) => t.barber_id === b.id).map(range),
    busy: new Set(busy.filter((s) => s.barber_id === b.id).map((s) => Date.parse(s.slot_start))),
    bookingsThatDay: counts.get(b.id) ?? 0,
  }));

  const slots = computeSlots({
    date,
    timezone: branch.timezone,
    branchHours: hours ? { open: hours.open_time, close: hours.close_time } : null,
    branchTimeOff: timeOff.filter((t) => t.barber_id === null && t.branch_id === branch.id).map(range),
    barbers,
    durationMin: service.duration_min,
    bufferMin: service.buffer_min,
    now: o.now,
    leadMin: o.ignoreLead ? 0 : branch.booking_lead_min,
    maxDays: branch.booking_max_days,
  });
  return { slots, barbers };
}

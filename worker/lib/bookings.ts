/**
 * Operasi booking. Anti-bentrok: booking + SEMUA baris booking_slots (durasi + buffer) ditulis dalam satu
 * db.batch() (transaksi atomik D1). UNIQUE(barber_id, slot_start) menolak request kedua untuk jam yang sama;
 * seluruh batch dibatalkan sehingga tidak ada booking setengah jadi.
 */
import {
  ACTIVE_STATUSES,
  MAX_ACTIVE_BOOKINGS,
  MAX_BOOKINGS_PER_DAY,
  MAX_NO_SHOW,
  NO_SHOW_AFTER_MIN,
  canTransition,
  generateBookingCode,
  type Actor,
  type BookingStatus,
} from '../../shared/booking';
import { completionStatements, releaseVoucherStatements } from './loyalty';
import { cancelBookingOrdersStatements } from './shopStock';
import { nearestSlots, pickBarber, slotStartsFor, type Slot } from '../../shared/slots';
import { iso, localDate, MINUTE_MS } from '../../shared/time';
import { ApiError, badRequest, notFound } from './errors';
import { getBranch, getBranchService, loadAvailability, type BranchRow } from './availability';

export interface BookingRow {
  id: string;
  code: string;
  branch_id: number;
  barber_id: number;
  service_id: number;
  customer_id: string;
  start_at: string;
  end_at: string;
  price_snapshot: number;
  duration_snapshot: number;
  service_name_snapshot: string;
  status: BookingStatus;
  source: 'online' | 'walk_in' | 'admin';
  customer_note: string | null;
  admin_note: string | null;
  created_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: 'customer' | 'admin' | 'system' | null;
  cancel_reason: string | null;
  completed_at: string | null;
  no_show_at: string | null;
}

export interface AuditActor {
  type: 'admin' | 'customer' | 'system';
  id: string | null;
}

const isUniqueViolation = (e: unknown, table: string) => String((e as Error)?.message ?? e).includes(`UNIQUE constraint failed: ${table}`);

export const auditStmt = (db: D1Database, actor: AuditActor, action: string, entity: string, entityId: string | number, payload?: unknown) =>
  db
    .prepare('INSERT INTO audit_log (actor_type, actor_id, action, entity, entity_id, payload) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(actor.type, actor.id, action, entity, String(entityId), payload === undefined ? null : JSON.stringify(payload));

function slotTakenError(slots: Slot[], startAt: string) {
  return new ApiError(409, 'SLOT_TAKEN', 'Jam ini baru saja dibooking, silakan pilih jam lain.', { alternatives: nearestSlots(slots, startAt) });
}

export interface CreateBookingInput {
  branch: string | number;
  service: string | number;
  /** undefined / 'any' = Siapa saja */
  barberId?: number;
  /** UTC ISO jam mulai yang dipilih dari daftar slot */
  startAt: string;
  customerId: string;
  source: 'online' | 'walk_in' | 'admin';
  customerNote?: string | null;
  adminNote?: string | null;
  actor: AuditActor;
  now?: number;
}

export interface CreatedBooking {
  booking: BookingRow;
  branch: BranchRow;
}

export async function createBooking(db: D1Database, input: CreateBookingInput): Promise<CreatedBooking> {
  const now = input.now ?? Date.now();
  const branch = await getBranch(db, input.branch);
  if (branch.status !== 'active') throw new ApiError(409, 'SLOT_UNAVAILABLE', 'Cabang ini belum menerima booking.');
  const service = await getBranchService(db, branch.id, input.service);
  const startMs = Date.parse(input.startAt);
  if (!Number.isFinite(startMs)) throw badRequest('Jam mulai tidak valid.');

  const online = input.source === 'online';
  if (online) await assertCustomerCanBook(db, input.customerId, now);

  const date = localDate(startMs, branch.timezone);
  const { slots, barbers } = await loadAvailability(db, {
    branch,
    service,
    barberId: input.barberId,
    date,
    now,
    ignoreLead: !online,
  });
  const slot = slots.find((s) => s.startAt === iso(startMs));
  if (!slot) throw slotTakenError(slots, input.startAt);
  const barberId = input.barberId ?? pickBarber(slot.barberIds, barbers);
  if (!barberId || !slot.barberIds.includes(barberId)) throw slotTakenError(slots, input.startAt);

  const status: BookingStatus = online && branch.require_manual_confirmation ? 'pending' : 'confirmed';
  const endMs = startMs + service.duration_min * MINUTE_MS;
  const nowIso = iso(now);

  for (let attempt = 0; attempt < 3; attempt++) {
    const id = crypto.randomUUID();
    const code = generateBookingCode();
    const statements = [
      db
        .prepare(
          `INSERT INTO bookings (id, code, branch_id, barber_id, service_id, customer_id, start_at, end_at, price_snapshot,
             duration_snapshot, service_name_snapshot, status, source, customer_note, admin_note, created_at, confirmed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id, code, branch.id, barberId, service.id, input.customerId, iso(startMs), iso(endMs), service.price,
          service.duration_min, service.name, status, input.source, input.customerNote ?? null, input.adminNote ?? null, nowIso,
          status === 'confirmed' ? nowIso : null,
        ),
      ...slotStartsFor(startMs, service.duration_min, service.buffer_min).map((s) =>
        db.prepare('INSERT INTO booking_slots (booking_id, barber_id, slot_start) VALUES (?, ?, ?)').bind(id, barberId, s),
      ),
      auditStmt(db, input.actor, 'booking.create', 'booking', id, { code, status, source: input.source, startAt: iso(startMs), barberId }),
    ];
    try {
      await db.batch(statements);
    } catch (e) {
      if (isUniqueViolation(e, 'bookings.code')) continue; // kode kebetulan sama → coba kode lain
      if (isUniqueViolation(e, 'booking_slots')) {
        const fresh = await loadAvailability(db, { branch, service, barberId: input.barberId, date, now, ignoreLead: !online });
        throw slotTakenError(fresh.slots, input.startAt);
      }
      throw e;
    }
    const booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first<BookingRow>();
    return { booking: booking!, branch };
  }
  throw new ApiError(500, 'INTERNAL', 'Gagal membuat kode booking, silakan coba lagi.');
}

/** Batas anti-spam per akun: diblokir, ≥ 3 no-show, 2 booking aktif, 5 booking per 24 jam */
async function assertCustomerCanBook(db: D1Database, customerId: string, now: number) {
  const row = await db
    .prepare(
      `SELECT c.status, c.no_show_count,
         (SELECT COUNT(*) FROM bookings WHERE customer_id = c.id AND status IN ('pending', 'confirmed') AND end_at > ?) AS active,
         (SELECT COUNT(*) FROM bookings WHERE customer_id = c.id AND source = 'online' AND created_at > ?) AS recent
       FROM customers c WHERE c.id = ?`,
    )
    .bind(iso(now), iso(now - 24 * 3_600_000), customerId)
    .first<{ status: string; no_show_count: number; active: number; recent: number }>();
  if (!row) throw new ApiError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.');
  if (row.status === 'blocked' || row.no_show_count >= MAX_NO_SHOW) {
    throw new ApiError(403, 'ACCOUNT_BLOCKED', 'Akun Anda tidak bisa booking online. Silakan hubungi cabang via WhatsApp.');
  }
  if (row.active >= MAX_ACTIVE_BOOKINGS) {
    throw new ApiError(429, 'LIMIT_ACTIVE', `Maksimal ${MAX_ACTIVE_BOOKINGS} booking aktif per akun. Batalkan atau selesaikan booking lain dulu.`);
  }
  if (row.recent >= MAX_BOOKINGS_PER_DAY) {
    throw new ApiError(429, 'LIMIT_DAILY', `Maksimal ${MAX_BOOKINGS_PER_DAY} booking per 24 jam. Silakan coba lagi nanti.`);
  }
}

export async function getBooking(db: D1Database, id: string): Promise<BookingRow> {
  const row = await db.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first<BookingRow>();
  if (!row) throw notFound('Booking tidak ditemukan.');
  return row;
}

/** Pelanggan masih boleh batal/jadwal ulang? (sebelum cancel_deadline_min sebelum jadwal) */
export function withinCustomerDeadline(booking: BookingRow, branch: BranchRow, now = Date.now()): boolean {
  return Date.parse(booking.start_at) - now >= branch.cancel_deadline_min * MINUTE_MS;
}

export interface TransitionInput {
  bookingId: string;
  to: BookingStatus;
  actor: Actor;
  audit: AuditActor;
  reason?: string | null;
  now?: number;
  /** Cutless Stamp aktif di env (LOYALTY_ENABLED): Selesai → stempel dalam batch yang sama */
  loyalty?: boolean;
}

/**
 * Ubah status sesuai aturan transisi. Batal & no-show melepas booking_slots dalam batch yang sama.
 * UPDATE memakai syarat status lama (optimistic) agar dua admin yang menekan bersamaan tidak saling menimpa.
 */
export async function transitionBooking(db: D1Database, input: TransitionInput): Promise<BookingRow> {
  const now = input.now ?? Date.now();
  const booking = await getBooking(db, input.bookingId);
  const { to, actor } = input;
  if (!canTransition(booking.status, to, actor)) {
    throw new ApiError(409, 'INVALID_TRANSITION', `Status "${booking.status}" tidak bisa diubah menjadi "${to}".`);
  }
  if (to === 'no_show' && now < Date.parse(booking.start_at) + NO_SHOW_AFTER_MIN * MINUTE_MS) {
    throw new ApiError(409, 'INVALID_TRANSITION', `Tidak datang baru bisa ditandai ${NO_SHOW_AFTER_MIN} menit setelah jam mulai.`);
  }
  if (to === 'completed' && now < Date.parse(booking.start_at)) {
    throw new ApiError(409, 'INVALID_TRANSITION', 'Booking belum dimulai.');
  }
  if (to === 'cancelled' && actor === 'customer') {
    const branch = await getBranch(db, booking.branch_id);
    if (!withinCustomerDeadline(booking, branch, now)) {
      throw new ApiError(409, 'DEADLINE_PASSED', `Batas pembatalan online sudah lewat (${branch.cancel_deadline_min} menit sebelum jadwal). Silakan hubungi cabang.`);
    }
  }
  if (to === 'cancelled' && actor === 'admin' && !input.reason?.trim()) throw badRequest('Alasan pembatalan wajib diisi.');

  const nowIso = iso(now);
  const stampColumn: Partial<Record<BookingStatus, string>> = { confirmed: 'confirmed_at', completed: 'completed_at', no_show: 'no_show_at' };
  const update =
    to === 'cancelled'
      ? db
          .prepare(`UPDATE bookings SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ? WHERE id = ? AND status = ?`)
          .bind(nowIso, actor === 'barber' ? 'admin' : actor, input.reason ?? null, booking.id, booking.status)
      : db.prepare(`UPDATE bookings SET status = ?, ${stampColumn[to]} = ? WHERE id = ? AND status = ?`).bind(to, nowIso, booking.id, booking.status);

  const statements = [update];
  if (to === 'cancelled' || to === 'no_show') {
    // Hanya dilepas bila UPDATE di atas benar-benar terjadi (status sekarang = status baru)
    statements.push(
      db
        .prepare(`DELETE FROM booking_slots WHERE booking_id = ? AND EXISTS (SELECT 1 FROM bookings WHERE id = ? AND status = ?)`)
        .bind(booking.id, booking.id, to),
    );
  }
  if (to === 'no_show') {
    statements.push(
      db
        .prepare(
          `UPDATE customers SET no_show_count = no_show_count + 1,
             status = CASE WHEN no_show_count + 1 >= ? AND is_guest = 0 THEN 'blocked' ELSE status END
           WHERE id = ? AND EXISTS (SELECT 1 FROM bookings WHERE id = ? AND status = 'no_show')`,
        )
        .bind(MAX_NO_SHOW, booking.customer_id, booking.id),
    );
  }
  statements.push(auditStmt(db, input.audit, `booking.${to}`, 'booking', booking.id, { from: booking.status, reason: input.reason ?? undefined }));
  // Cutless Stamp. Semua pernyataan bersyarat (status sudah berubah, program aktif) → tanpa efek bila tidak berlaku.
  if (to === 'cancelled' || to === 'no_show') {
    statements.push(...releaseVoucherStatements(db, booking.id, input.audit, now));
    // Cutless Shop: pesanan "ambil saat booking" ikut batal, reservasi stok dilepas
    statements.push(...cancelBookingOrdersStatements(db, booking.id, input.audit, now));
  }
  if (to === 'completed' && input.loyalty) {
    const branch = await getBranch(db, booking.branch_id);
    statements.push(...completionStatements(db, booking, branch.timezone, input.audit, now));
  }

  const results = await db.batch(statements);
  if (!results[0].meta.changes) {
    throw new ApiError(409, 'INVALID_TRANSITION', 'Status booking baru saja diubah orang lain. Muat ulang halaman.');
  }
  return getBooking(db, booking.id);
}

export interface RescheduleInput {
  bookingId: string;
  startAt: string;
  /** Barber baru (admin) atau undefined = barber yang sama bila tersedia, lainnya "Siapa saja" */
  barberId?: number;
  actor: 'customer' | 'admin';
  audit: AuditActor;
  now?: number;
}

/** Jadwal ulang: lepas slot lama + kunci slot baru + ubah booking dalam SATU batch (bentrok → semua batal) */
export async function rescheduleBooking(db: D1Database, input: RescheduleInput): Promise<BookingRow> {
  const now = input.now ?? Date.now();
  const booking = await getBooking(db, input.bookingId);
  if (booking.status !== 'pending' && booking.status !== 'confirmed') {
    throw new ApiError(409, 'INVALID_TRANSITION', 'Booking ini tidak bisa dijadwal ulang.');
  }
  const branch = await getBranch(db, booking.branch_id);
  if (input.actor === 'customer' && !withinCustomerDeadline(booking, branch, now)) {
    throw new ApiError(409, 'DEADLINE_PASSED', `Batas jadwal ulang online sudah lewat (${branch.cancel_deadline_min} menit sebelum jadwal). Silakan hubungi cabang.`);
  }
  const service = await db
    .prepare('SELECT id, duration_min, buffer_min FROM services WHERE id = ?')
    .bind(booking.service_id)
    .first<{ id: number; duration_min: number; buffer_min: number }>();
  if (!service) throw notFound('Layanan tidak ditemukan.');
  // Durasi mengikuti booking awal (snapshot), buffer mengikuti layanan saat ini
  const svc = { ...service, duration_min: booking.duration_snapshot };

  const startMs = Date.parse(input.startAt);
  if (!Number.isFinite(startMs)) throw badRequest('Jam mulai tidak valid.');
  const date = localDate(startMs, branch.timezone);
  const { slots, barbers } = await loadAvailability(db, {
    branch,
    service: svc,
    barberId: input.barberId,
    date,
    now,
    excludeBookingId: booking.id,
    ignoreLead: input.actor === 'admin',
  });
  const slot = slots.find((s) => s.startAt === iso(startMs));
  if (!slot) throw slotTakenError(slots, input.startAt);
  const barberId =
    input.barberId ?? (slot.barberIds.includes(booking.barber_id) ? booking.barber_id : pickBarber(slot.barberIds, barbers));
  if (!barberId) throw slotTakenError(slots, input.startAt);

  const endMs = startMs + booking.duration_snapshot * MINUTE_MS;
  const statements = [
    db.prepare('DELETE FROM booking_slots WHERE booking_id = ?').bind(booking.id),
    ...slotStartsFor(startMs, booking.duration_snapshot, service.buffer_min).map((s) =>
      db.prepare('INSERT INTO booking_slots (booking_id, barber_id, slot_start) VALUES (?, ?, ?)').bind(booking.id, barberId, s),
    ),
    db
      .prepare(`UPDATE bookings SET start_at = ?, end_at = ?, barber_id = ? WHERE id = ? AND status IN ('pending', 'confirmed')`)
      .bind(iso(startMs), iso(endMs), barberId, booking.id),
    auditStmt(db, input.audit, 'booking.reschedule', 'booking', booking.id, {
      from: { startAt: booking.start_at, barberId: booking.barber_id },
      to: { startAt: iso(startMs), barberId },
    }),
  ];
  try {
    await db.batch(statements);
  } catch (e) {
    if (isUniqueViolation(e, 'booking_slots')) {
      const fresh = await loadAvailability(db, { branch, service: svc, barberId: input.barberId, date, now, excludeBookingId: booking.id });
      throw slotTakenError(fresh.slots, input.startAt);
    }
    throw e;
  }
  return getBooking(db, booking.id);
}

export { ACTIVE_STATUSES };

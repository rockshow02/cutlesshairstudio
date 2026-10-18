/** Admin: jadwal booking, aksi status, pindah jadwal, catatan, walk-in, ketersediaan admin. */
import { adminBookingsQuery, adminNoteBody, adminStatusBody, availabilityQuery, rescheduleBody, walkInBody } from '../../../shared/schemas';
import { loyaltyEnv, redeemVoucher } from '../../lib/loyalty';
import { localDayRange } from '../../../shared/time';
import type { Context } from 'hono';
import { createRouter, type AppEnv } from '../../app';
import { getBranch, getBranchService, loadAvailability } from '../../lib/availability';
import { auditStmt, createBooking, getBooking, rescheduleBooking, transitionBooking } from '../../lib/bookings';
import { badRequest, forbidden } from '../../lib/errors';
import { body, defer, query } from '../../lib/http';
import { notifyBranch } from '../../lib/notify';
import { assertBranch, auditActor, branchScope } from '../../middleware/admin';
import { settleBookingOrders } from '../../lib/shop';

export const adminBookingRoutes = createRouter();

export const ADMIN_BOOKING_SQL = `SELECT b.*, br.name AS branch_name, br.timezone, ba.name AS barber_name,
    c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email, c.is_guest AS customer_is_guest,
    c.no_show_count AS customer_no_show,
    (SELECT code FROM loyalty_vouchers v WHERE v.redeemed_booking_id = b.id) AS voucher_code
  FROM bookings b JOIN branches br ON br.id = b.branch_id JOIN barbers ba ON ba.id = b.barber_id JOIN customers c ON c.id = b.customer_id`;

/** GET /api/admin/bookings?from=&to=&branch=&barber=&status= (tanggal lokal cabang, inklusif) */
adminBookingRoutes.get('/bookings', async (c) => {
  const admin = c.get('admin')!;
  const q = query(c, adminBookingsQuery);
  const branchId = branchScope(admin, q.branch);
  const where: string[] = [];
  const binds: unknown[] = [];
  // Rentang tanggal memakai WIB sebagai acuan umum; ±9 jam mencakup WITA/WIT
  const [from] = localDayRange(q.from, 'Asia/Jakarta');
  const [, to] = localDayRange(q.to, 'Asia/Jakarta');
  where.push('b.start_at >= ? AND b.start_at < ?');
  binds.push(new Date(from - 2 * 3_600_000).toISOString(), new Date(to + 2 * 3_600_000).toISOString());
  if (branchId !== undefined) {
    where.push('b.branch_id = ?');
    binds.push(branchId);
  }
  if (admin.role === 'barber') {
    where.push('b.barber_id = ?');
    binds.push(admin.barber_id);
  } else if (q.barber) {
    where.push('b.barber_id = ?');
    binds.push(q.barber);
  }
  if (q.status) {
    where.push('b.status = ?');
    binds.push(q.status);
  }
  const { results } = await c.env.DB.prepare(`${ADMIN_BOOKING_SQL} WHERE ${where.join(' AND ')} ORDER BY b.start_at LIMIT 1000`)
    .bind(...binds)
    .all();
  return c.json({ bookings: results, serverTime: new Date().toISOString() });
});

/** Booking dalam cakupan admin (cabang & barber) */
export async function scopedBooking(c: Context<AppEnv>, id: string) {
  const admin = c.get('admin')!;
  const b = await getBooking(c.env.DB, id);
  assertBranch(admin, b.branch_id);
  if (admin.role === 'barber' && b.barber_id !== admin.barber_id) throw forbidden('Ini bukan booking Anda.');
  return b;
}

/** Ubah status: konfirmasi / selesai / tidak datang / batal (alasan wajib) */
adminBookingRoutes.post('/bookings/:id/status', async (c) => {
  const admin = c.get('admin')!;
  const input = await body(c, adminStatusBody);
  const b = await scopedBooking(c, c.req.param('id'));
  if (admin.role === 'barber' && !['completed', 'no_show'].includes(input.status)) {
    throw forbidden('Hairstylist hanya bisa menandai Selesai atau Tidak datang.');
  }
  // Pesanan produk hanya diproses owner/admin cabang (hairstylist tidak punya akses toko)
  const settle = input.status === 'completed' && input.productOrders && input.productOrders !== 'keep' ? input.productOrders : null;
  if (settle && admin.role === 'barber') throw forbidden('Pesanan produk diproses admin cabang.');
  const updated = await transitionBooking(c.env.DB, {
    bookingId: b.id,
    to: input.status,
    actor: admin.role === 'barber' ? 'barber' : 'admin',
    audit: auditActor(admin),
    reason: input.reason,
    loyalty: loyaltyEnv(c.env),
  });
  if (input.status === 'cancelled') {
    const branch = await getBranch(c.env.DB, b.branch_id);
    await defer(c, notifyBranch(c.env, branch, 'cancelled', b.id));
  }
  // Setelah booking Selesai: produk dibayar & diambil di kasir, atau dibatalkan. Gagal → pesanan tetap terbuka ("Belum diambil")
  const productOrders = settle ? await settleBookingOrders(c.env, b.id, settle, auditActor(admin)) : undefined;
  return c.json({ booking: updated, ...(productOrders ? { productOrders } : {}) });
});

adminBookingRoutes.post('/bookings/:id/reschedule', async (c) => {
  const admin = c.get('admin')!;
  if (admin.role === 'barber') throw forbidden();
  const input = await body(c, rescheduleBody);
  const b = await scopedBooking(c, c.req.param('id'));
  const updated = await rescheduleBooking(c.env.DB, { bookingId: b.id, startAt: input.startAt, barberId: input.barber, actor: 'admin', audit: auditActor(admin) });
  return c.json({ booking: updated });
});

adminBookingRoutes.post('/bookings/:id/note', async (c) => {
  const admin = c.get('admin')!;
  const input = await body(c, adminNoteBody);
  const b = await scopedBooking(c, c.req.param('id'));
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE bookings SET admin_note = ? WHERE id = ?').bind(input.note || null, b.id),
    auditStmt(c.env.DB, auditActor(admin), 'booking.note', 'booking', b.id),
  ]);
  return c.json({ ok: true });
});

/** Booking walk-in / telepon untuk pelanggan terdaftar atau tamu tanpa akun (tidak membuat akun login) */
adminBookingRoutes.post('/bookings', async (c) => {
  const admin = c.get('admin')!;
  if (admin.role === 'barber') throw forbidden();
  const input = await body(c, walkInBody);
  assertBranch(admin, input.branch);
  let customerId = input.customerId;
  if (customerId) {
    const exists = await c.env.DB.prepare('SELECT id FROM customers WHERE id = ? AND anonymized_at IS NULL').bind(customerId).first();
    if (!exists) throw badRequest('Pelanggan tidak ditemukan.');
  } else {
    if (!input.guestName || !input.guestPhone) throw badRequest('Isi nama dan nomor WhatsApp tamu, atau pilih pelanggan terdaftar.');
    const guest = await c.env.DB.prepare('SELECT id FROM customers WHERE is_guest = 1 AND phone = ?').bind(input.guestPhone).first<{ id: string }>();
    customerId = guest?.id ?? crypto.randomUUID();
    if (!guest) {
      await c.env.DB.batch([
        c.env.DB.prepare('INSERT INTO customers (id, name, phone, is_guest) VALUES (?, ?, ?, 1)').bind(customerId, input.guestName, input.guestPhone),
        auditStmt(c.env.DB, auditActor(admin), 'customer.guest_create', 'customer', customerId),
      ]);
    } else {
      await c.env.DB.prepare('UPDATE customers SET name = ? WHERE id = ?').bind(input.guestName, customerId).run();
    }
  }
  const { booking } = await createBooking(c.env.DB, {
    branch: input.branch,
    service: input.service,
    barberId: input.barber,
    startAt: input.startAt,
    customerId,
    source: input.source,
    adminNote: input.note,
    actor: auditActor(admin),
  });
  // Cutless Stamp: tukar voucher pelanggan terdaftar. Booking tetap tersimpan bila voucher gagal (pesan dikembalikan).
  let voucherError: string | undefined;
  if (input.voucherId && input.customerId && loyaltyEnv(c.env)) {
    try {
      await redeemVoucher(c.env.DB, { voucherId: input.voucherId, booking: await getBooking(c.env.DB, booking.id), actor: auditActor(admin) });
    } catch (e) {
      voucherError = e instanceof Error ? e.message : 'Voucher tidak bisa ditukar.';
    }
  }
  return c.json({ booking, ...(voucherError ? { voucherError } : {}) }, 201);
});

/** Ketersediaan versi admin (tanpa lead time, untuk walk-in & pindah jadwal) */
adminBookingRoutes.get('/availability', async (c) => {
  const admin = c.get('admin')!;
  const q = query(c, availabilityQuery);
  const branch = await getBranch(c.env.DB, q.branch);
  assertBranch(admin, branch.id);
  const service = await getBranchService(c.env.DB, branch.id, q.service);
  const exclude = c.req.query('exclude') ?? undefined;
  let svc = service as { id: number; duration_min: number; buffer_min: number };
  if (exclude) {
    const b = await getBooking(c.env.DB, exclude);
    svc = { ...service, duration_min: b.duration_snapshot };
  }
  const { slots } = await loadAvailability(c.env.DB, { branch, service: svc, barberId: q.barber, date: q.date, now: Date.now(), ignoreLead: true, excludeBookingId: exclude });
  return c.json({ date: q.date, timezone: branch.timezone, slots });
});

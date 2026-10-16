/** Booking pelanggan: buat, lihat, batalkan, jadwal ulang, file .ics, daftar booking saya. */
import type { Context } from 'hono';
import { ACTIVE_STATUSES, STATUS_LABEL } from '../../shared/booking';
import { cancelBody, createBookingBody, rescheduleBody } from '../../shared/schemas';
import { createRouter, type AppEnv } from '../app';
import { notFound } from '../lib/errors';
import { assertSameOrigin, rateLimit, verifyTurnstile } from '../lib/guard';
import { body } from '../lib/http';
import { createBooking, rescheduleBooking, transitionBooking, type BookingRow } from '../lib/bookings';
import { getBranch } from '../lib/availability';
import { notifyBranch } from '../lib/notify';
import { requireCompleteProfile, requireCustomer } from '../middleware/customer';

export const bookingRoutes = createRouter();
bookingRoutes.use('/bookings', requireCustomer);
bookingRoutes.use('/bookings/*', requireCustomer);
bookingRoutes.use('/me/bookings', requireCustomer);

interface BookingView extends BookingRow {
  branch_slug: string;
  branch_name: string;
  branch_address: string | null;
  branch_whatsapp: string;
  branch_maps_url: string | null;
  timezone: string;
  cancel_deadline_min: number;
  barber_name: string;
}

const VIEW_SQL = `SELECT b.*, br.slug AS branch_slug, br.name AS branch_name, br.address AS branch_address, br.whatsapp AS branch_whatsapp,
    br.maps_url AS branch_maps_url, br.timezone, br.cancel_deadline_min, ba.name AS barber_name
  FROM bookings b JOIN branches br ON br.id = b.branch_id JOIN barbers ba ON ba.id = b.barber_id`;

/** Bentuk respons booking untuk pelanggan (tanpa catatan admin) */
function present(v: BookingView, now = Date.now()) {
  const active = (ACTIVE_STATUSES as string[]).includes(v.status) && Date.parse(v.end_at) > now;
  const canManage = active && Date.parse(v.start_at) - now >= v.cancel_deadline_min * 60_000;
  return {
    id: v.id,
    code: v.code,
    status: v.status,
    statusLabel: STATUS_LABEL[v.status],
    startAt: v.start_at,
    endAt: v.end_at,
    timezone: v.timezone,
    service: { id: v.service_id, name: v.service_name_snapshot, durationMin: v.duration_snapshot, price: v.price_snapshot },
    barber: { id: v.barber_id, name: v.barber_name },
    branch: { slug: v.branch_slug, name: v.branch_name, address: v.branch_address, whatsapp: v.branch_whatsapp, mapsUrl: v.branch_maps_url },
    note: v.customer_note,
    createdAt: v.created_at,
    cancelledBy: v.cancelled_by,
    cancelReason: v.cancelled_by === 'customer' ? v.cancel_reason : v.cancelled_by ? v.cancel_reason ?? 'Dibatalkan cabang' : null,
    active,
    canManage,
    cancelDeadlineMin: v.cancel_deadline_min,
  };
}

async function ownBooking(c: Context<AppEnv>, id: string): Promise<BookingView> {
  const row = await c.env.DB.prepare(`${VIEW_SQL} WHERE b.id = ? AND b.customer_id = ?`).bind(id, c.get('customer')!.id).first<BookingView>();
  if (!row) throw notFound('Booking tidak ditemukan.');
  return row;
}

/** POST /api/bookings: wajib login + profil lengkap + Turnstile */
bookingRoutes.post('/bookings', requireCompleteProfile, async (c) => {
  assertSameOrigin(c);
  await rateLimit(c, 'booking-create', 20, 60);
  const input = await body(c, createBookingBody);
  await verifyTurnstile(c, input.turnstileToken);
  const me = c.get('customer')!;
  const { booking, branch } = await createBooking(c.env.DB, {
    branch: input.branch,
    service: input.service,
    barberId: input.barber,
    startAt: input.startAt,
    customerId: me.id,
    source: 'online',
    customerNote: input.note,
    actor: { type: 'customer', id: me.id },
  });
  c.executionCtx.waitUntil(notifyBranch(c.env, branch, booking.status === 'pending' ? 'pending' : 'new', booking.id));
  return c.json({ booking: present(await ownBooking(c, booking.id)) }, 201);
});

/** GET /api/me/bookings → booking aktif & riwayat */
bookingRoutes.get('/me/bookings', async (c) => {
  const { results } = await c.env.DB.prepare(`${VIEW_SQL} WHERE b.customer_id = ? ORDER BY b.start_at DESC LIMIT 100`)
    .bind(c.get('customer')!.id)
    .all<BookingView>();
  const now = Date.now();
  const items = results.map((r) => present(r, now));
  return c.json({
    active: items.filter((b) => b.active).sort((a, b) => a.startAt.localeCompare(b.startAt)),
    history: items.filter((b) => !b.active),
  });
});

bookingRoutes.get('/bookings/:id', async (c) => c.json({ booking: present(await ownBooking(c, c.req.param('id'))) }));

bookingRoutes.post('/bookings/:id/cancel', async (c) => {
  assertSameOrigin(c);
  const input = await body(c, cancelBody);
  const own = await ownBooking(c, c.req.param('id'));
  const me = c.get('customer')!;
  await transitionBooking(c.env.DB, { bookingId: own.id, to: 'cancelled', actor: 'customer', audit: { type: 'customer', id: me.id }, reason: input.reason || 'Dibatalkan pelanggan' });
  const branch = await getBranch(c.env.DB, own.branch_id);
  c.executionCtx.waitUntil(notifyBranch(c.env, branch, 'cancelled', own.id));
  return c.json({ booking: present(await ownBooking(c, own.id)) });
});

bookingRoutes.post('/bookings/:id/reschedule', async (c) => {
  assertSameOrigin(c);
  const input = await body(c, rescheduleBody);
  const own = await ownBooking(c, c.req.param('id'));
  const me = c.get('customer')!;
  await rescheduleBooking(c.env.DB, { bookingId: own.id, startAt: input.startAt, barberId: input.barber, actor: 'customer', audit: { type: 'customer', id: me.id } });
  const branch = await getBranch(c.env.DB, own.branch_id);
  c.executionCtx.waitUntil(notifyBranch(c.env, branch, 'rescheduled', own.id));
  return c.json({ booking: present(await ownBooking(c, own.id)) });
});

/** File kalender (.ics) untuk ditambahkan ke Google Calendar / iPhone */
bookingRoutes.get('/bookings/:id/ics', async (c) => {
  const b = await ownBooking(c, c.req.param('id'));
  const stamp = (s: string) => s.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cutless Hair Studio//Booking//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${b.id}@cutlesshairstudio`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(b.start_at)}`,
    `DTEND:${stamp(b.end_at)}`,
    `SUMMARY:${esc(`${b.service_name_snapshot} – Cutless ${b.branch_name}`)}`,
    `DESCRIPTION:${esc(`Kode booking: ${b.code}\nHairstylist: ${b.barber_name}\nKelola booking: ${new URL(c.req.url).origin}/booking/saya`)}`,
    `LOCATION:${esc(b.branch_address ?? b.branch_name)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Booking Cutless 1 jam lagi',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="cutless-${b.code}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
});

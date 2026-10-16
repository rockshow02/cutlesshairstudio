/** API publik (tanpa login): data untuk alur booking & ketersediaan jam. */
import { availabilityQuery } from '../../shared/schemas';
import { bookableDates } from '../../shared/slots';
import { createRouter } from '../app';
import { getBranch, getBranchService, loadAvailability } from '../lib/availability';
import { query } from '../lib/http';

export const publicRoutes = createRouter();

/** Cabang yang tampil di alur booking (nomor pelanggan tidak pernah dikirim; WA cabang memang publik) */
publicRoutes.get('/booking/branches', async (c) => {
  const now = Date.now();
  const { results } = await c.env.DB.prepare(
    `SELECT id, slug, name, city, address, timezone, status, whatsapp, booking_lead_min, booking_max_days,
            cancel_deadline_min, require_manual_confirmation,
            (SELECT COUNT(*) FROM barbers WHERE branch_id = branches.id AND is_active = 1) AS barber_count
     FROM branches WHERE status <> 'closed' ORDER BY sort_order, id`,
  ).all<Record<string, unknown> & { timezone: string; booking_max_days: number; status: string }>();
  return c.json({
    branches: results.map((b) => ({
      ...b,
      require_manual_confirmation: Boolean(b.require_manual_confirmation),
      bookable: b.status === 'active' && Number(b.barber_count) > 0,
      dates: bookableDates(b.timezone, now, b.booking_max_days),
    })),
  });
});

/** Layanan yang bisa dibooking di cabang + harga cabang + durasi */
publicRoutes.get('/booking/services', async (c) => {
  const branch = await getBranch(c.env.DB, c.req.query('branch') ?? '');
  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.slug, s.name, s.category, s.description, s.duration_min, s.price_from, COALESCE(bs.price, s.base_price) AS price
     FROM services s JOIN branch_services bs ON bs.service_id = s.id AND bs.branch_id = ?
     WHERE s.is_active = 1 AND s.is_bookable = 1 AND bs.is_active = 1
       AND EXISTS (SELECT 1 FROM barber_services x JOIN barbers b ON b.id = x.barber_id
                   WHERE x.service_id = s.id AND b.branch_id = ? AND b.is_active = 1)
     ORDER BY s.sort_order, s.id`,
  )
    .bind(branch.id, branch.id)
    .all<Record<string, unknown>>();
  return c.json({ services: results.map((s) => ({ ...s, price_from: Boolean(s.price_from) })) });
});

/** Hairstylist cabang yang bisa mengerjakan layanan */
publicRoutes.get('/booking/barbers', async (c) => {
  const branch = await getBranch(c.env.DB, c.req.query('branch') ?? '');
  const service = await getBranchService(c.env.DB, branch.id, c.req.query('service') ?? '');
  const { results } = await c.env.DB.prepare(
    `SELECT b.id, b.name, b.role, b.photo, b.specialty FROM barbers b
     JOIN barber_services x ON x.barber_id = b.id AND x.service_id = ?
     WHERE b.branch_id = ? AND b.is_active = 1 ORDER BY b.sort_order, b.id`,
  )
    .bind(service.id, branch.id)
    .all();
  return c.json({ barbers: results });
});

/** GET /api/availability?branch=&service=&barber=&date= → slot per tanggal (jam lokal cabang) */
publicRoutes.get('/availability', async (c) => {
  const q = query(c, availabilityQuery);
  const branch = await getBranch(c.env.DB, q.branch);
  const service = await getBranchService(c.env.DB, branch.id, q.service);
  const { slots } = await loadAvailability(c.env.DB, { branch, service, barberId: q.barber, date: q.date, now: Date.now() });
  c.header('Cache-Control', 'no-store');
  return c.json({
    date: q.date,
    timezone: branch.timezone,
    service: { id: service.id, name: service.name, duration_min: service.duration_min, price: service.price },
    slots,
  });
});

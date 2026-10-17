/** Admin: pelanggan (cari, riwayat, blokir/buka, reset password), ringkasan, ekspor CSV. */
import { resetPasswordBody } from '../../../shared/schemas';
import { localDayRange, localDate } from '../../../shared/time';
import { createRouter } from '../../app';
import { auditStmt } from '../../lib/bookings';
import { ApiError, badRequest, forbidden, notFound } from '../../lib/errors';
import { body, defer } from '../../lib/http';
import { finishPage, keysetWhere, pageParams } from '../../lib/pagination';
import { hashPassword } from '../../lib/password';
import { loyaltyActive } from '../../lib/loyalty';
import { allowRoles, auditActor, branchScope } from '../../middleware/admin';
import { ADMIN_BOOKING_SQL } from './bookings';

export const adminCustomerRoutes = createRouter();
adminCustomerRoutes.use('/customers', allowRoles('owner', 'branch_admin'));
adminCustomerRoutes.use('/customers/*', allowRoles('owner', 'branch_admin'));

/** Urutan daftar pelanggan: aktivitas terakhir (login, atau tanggal daftar untuk tamu) terbaru dulu */
const CUSTOMER_SORT = 'COALESCE(c.last_login_at, c.created_at)';

/**
 * GET /api/admin/customers?q=&limit=&cursor= (nama / nomor / email). branch_admin: hanya yang pernah booking di cabangnya.
 * Respons: { customers, nextCursor, total } — total hanya di halaman pertama (tanpa cursor).
 */
adminCustomerRoutes.get('/customers', async (c) => {
  const admin = c.get('admin')!;
  const raw = (c.req.query('q') ?? '').trim();
  const digits = raw.replace(/\D/g, '').replace(/^0/, '62');
  const like = `%${raw.toLowerCase()}%`;
  const branchId = branchScope(admin);
  const page = pageParams(c);
  const filter = `c.anonymized_at IS NULL
       AND (?2 = '' OR lower(c.name) LIKE ?3 OR lower(COALESCE(c.email, '')) LIKE ?3 OR (?4 <> '' AND c.phone LIKE '%' || ?4 || '%'))
       ${branchId !== undefined ? 'AND EXISTS (SELECT 1 FROM bookings b WHERE b.customer_id = c.id AND b.branch_id = ?1)' : ''}`;
  const binds = [branchId ?? null, raw, like, digits.length >= 4 ? digits : ''];
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.name, c.email, c.phone, c.status, c.no_show_count, c.is_guest, c.created_at, c.last_login_at,
       ${CUSTOMER_SORT} AS sort_at,
       (SELECT COUNT(*) FROM bookings b WHERE b.customer_id = c.id ${branchId !== undefined ? 'AND b.branch_id = ?1' : ''}) AS bookings
     FROM customers c
     WHERE ${filter}
       ${page.cursor ? `AND ${keysetWhere(CUSTOMER_SORT, 'c.id', 'desc', 5)}` : ''}
     ORDER BY sort_at DESC, c.id DESC LIMIT ?7`,
  )
    .bind(...binds, page.cursor?.[0] ?? null, page.cursor?.[1] ?? null, page.limit + 1)
    .all<Record<string, unknown> & { id: string; sort_at: string }>();
  const { items, nextCursor } = finishPage(results, page.limit, (r) => [r.sort_at, r.id]);
  // Total hanya sekali (halaman pertama): satu COUNT dengan filter yang sama
  const total = page.cursor
    ? undefined
    : ((await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM customers c WHERE ${filter}`).bind(...binds).first<{ n: number }>())?.n ?? 0);
  return c.json({ customers: items.map(({ sort_at: _s, ...r }) => r), nextCursor, ...(total !== undefined ? { total } : {}) });
});

/** Riwayat booking pelanggan (terbaru dulu), satu halaman. branchId: batasi ke cabang admin. */
async function customerBookings(db: D1Database, customerId: string, branchId: number | undefined, page: ReturnType<typeof pageParams>) {
  const binds: unknown[] = [customerId];
  let where = 'b.customer_id = ?1';
  if (branchId !== undefined) {
    where += ' AND b.branch_id = ?2';
    binds.push(branchId);
  } else binds.push(null);
  const { results } = await db
    .prepare(`${ADMIN_BOOKING_SQL} WHERE ${where} ${page.cursor ? `AND ${keysetWhere('b.start_at', 'b.id', 'desc', 3)}` : ''} ORDER BY b.start_at DESC, b.id DESC LIMIT ?5`)
    .bind(...binds, page.cursor?.[0] ?? null, page.cursor?.[1] ?? null, page.limit + 1)
    .all<Record<string, unknown> & { id: string; start_at: string }>();
  const { items, nextCursor } = finishPage(results, page.limit, (r) => [r.start_at, r.id]);
  // Hitungan murah: indeks bookings_customer
  const total = (await db.prepare(`SELECT COUNT(*) AS n FROM bookings b WHERE ${where}`).bind(...binds.slice(0, branchId !== undefined ? 2 : 1)).first<{ n: number }>())?.n ?? 0;
  return { bookings: items, nextCursor, total };
}

adminCustomerRoutes.get('/customers/:id', async (c) => {
  const admin = c.get('admin')!;
  const id = c.req.param('id');
  const customer = await c.env.DB.prepare(
    'SELECT id, name, email, phone, status, no_show_count, is_guest, created_at, last_login_at, privacy_consent_at, password_hash IS NOT NULL AS has_password FROM customers WHERE id = ?',
  )
    .bind(id)
    .first();
  if (!customer) throw notFound('Pelanggan tidak ditemukan.');
  const branchId = branchScope(admin);
  // Halaman pertama riwayat (?limit=); halaman berikutnya lewat GET /customers/:id/bookings?cursor=
  const page = await customerBookings(c.env.DB, id, branchId, { ...pageParams(c), cursor: null });
  if (branchId !== undefined && page.total === 0) throw forbidden('Pelanggan ini belum pernah booking di cabang Anda.');
  return c.json({ customer, bookings: page.bookings, bookingsNextCursor: page.nextCursor, bookingsTotal: page.total });
});

/** GET /api/admin/customers/:id/bookings?limit=&cursor= → { bookings, nextCursor, total } */
adminCustomerRoutes.get('/customers/:id/bookings', async (c) => {
  const admin = c.get('admin')!;
  const branchId = branchScope(admin);
  const page = await customerBookings(c.env.DB, c.req.param('id'), branchId, pageParams(c));
  if (branchId !== undefined && page.total === 0) throw forbidden('Pelanggan ini belum pernah booking di cabang Anda.');
  return c.json(page);
});

/** Blokir / buka blokir. Buka blokir juga mereset hitungan no-show (bisa booking online lagi). */
adminCustomerRoutes.post('/customers/:id/:action{block|unblock}', async (c) => {
  const admin = c.get('admin')!;
  const id = c.req.param('id');
  const action = c.req.param('action');
  const res = await c.env.DB.batch([
    action === 'block'
      ? c.env.DB.prepare(`UPDATE customers SET status = 'blocked' WHERE id = ? AND anonymized_at IS NULL`).bind(id)
      : c.env.DB.prepare(`UPDATE customers SET status = 'active', no_show_count = 0 WHERE id = ? AND anonymized_at IS NULL`).bind(id),
    auditStmt(c.env.DB, auditActor(admin), `customer.${action}`, 'customer', id),
  ]);
  if (!res[0].meta.changes) throw notFound('Pelanggan tidak ditemukan.');
  if (action === 'block') await c.env.DB.prepare('DELETE FROM sessions WHERE customer_id = ?').bind(id).run();
  return c.json({ ok: true });
});

/** Reset password (fitur nomor WA + password; hanya bila diaktifkan) */
adminCustomerRoutes.post('/customers/:id/password', async (c) => {
  if (c.env.AUTH_PHONE_PASSWORD_ENABLED !== 'true') throw new ApiError(404, 'FEATURE_DISABLED', 'Login nomor WA + password belum diaktifkan.');
  const admin = c.get('admin')!;
  const input = await body(c, resetPasswordBody);
  const id = c.req.param('id');
  const hash = await hashPassword(input.password, Number(c.env.PBKDF2_ITERATIONS) || 100_000);
  const res = await c.env.DB.batch([
    c.env.DB.prepare('UPDATE customers SET password_hash = ? WHERE id = ? AND is_guest = 0 AND anonymized_at IS NULL AND phone IS NOT NULL').bind(hash, id),
    c.env.DB.prepare('DELETE FROM sessions WHERE customer_id = ?').bind(id),
    auditStmt(c.env.DB, auditActor(admin), 'customer.password_reset', 'customer', id),
  ]);
  if (!res[0].meta.changes) throw badRequest('Pelanggan tidak ditemukan atau belum punya nomor WhatsApp.');
  return c.json({ ok: true });
});

/* ---------- Ringkasan & ekspor ---------- */

export const adminReportRoutes = createRouter();
adminReportRoutes.use('*', allowRoles('owner', 'branch_admin'));

/** Ringkasan: booking hari ini/minggu ini per cabang, tingkat no-show (30 hari), layanan terpopuler (30 hari) */
adminReportRoutes.get('/summary', async (c) => {
  const admin = c.get('admin')!;
  const branchId = branchScope(admin, c.req.query('branch') ? Number(c.req.query('branch')) : undefined);
  const now = Date.now();
  const today = localDate(now, 'Asia/Jakarta');
  const [dayStart, dayEnd] = localDayRange(today, 'Asia/Jakarta');
  const weekEnd = dayStart + 7 * 86_400_000;
  const monthAgo = now - 30 * 86_400_000;
  const iso = (n: number) => new Date(n).toISOString();
  const scope = branchId !== undefined ? 'AND b.branch_id = ?' : '';
  const sb = branchId !== undefined ? [branchId] : [];
  const [perBranch, noShow, popular, pending] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT br.id, br.name,
         SUM(CASE WHEN b.start_at >= ? AND b.start_at < ? AND b.status IN ('pending','confirmed','completed') THEN 1 ELSE 0 END) AS today,
         SUM(CASE WHEN b.start_at >= ? AND b.start_at < ? AND b.status IN ('pending','confirmed','completed') THEN 1 ELSE 0 END) AS week
       FROM branches br LEFT JOIN bookings b ON b.branch_id = br.id
       WHERE 1 = 1 ${branchId !== undefined ? 'AND br.id = ?' : ''} GROUP BY br.id ORDER BY br.sort_order`,
    ).bind(iso(dayStart), iso(dayEnd), iso(dayStart), iso(weekEnd), ...sb),
    c.env.DB.prepare(
      `SELECT SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS no_show, SUM(CASE WHEN status IN ('completed','no_show') THEN 1 ELSE 0 END) AS finished
       FROM bookings b WHERE start_at >= ? AND start_at < ? ${scope}`,
    ).bind(iso(monthAgo), iso(now), ...sb),
    c.env.DB.prepare(
      `SELECT service_name_snapshot AS service, COUNT(*) AS n FROM bookings b
       WHERE start_at >= ? AND status IN ('pending','confirmed','completed') ${scope}
       GROUP BY service_name_snapshot ORDER BY n DESC LIMIT 5`,
    ).bind(iso(monthAgo), ...sb),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM bookings b WHERE status = 'pending' ${scope}`).bind(...sb),
  ]);
  const ns = (noShow.results[0] ?? {}) as { no_show: number | null; finished: number | null };
  return c.json({
    branches: perBranch.results,
    noShowRate: ns.finished ? Math.round(((ns.no_show ?? 0) / ns.finished) * 1000) / 10 : 0,
    noShowCount: ns.no_show ?? 0,
    popularServices: popular.results,
    pendingCount: (pending.results[0] as { n: number }).n,
    ...(await loyaltySummary(c.env, branchId, iso(monthAgo))),
  });
});

/**
 * Ringkasan Cutless Stamp 30 hari (hanya bila program aktif): stempel diberikan (juga per admin/hairstylist,
 * untuk memantau kejanggalan), voucher terbit/ditukar/hangus, voucher aktif. Admin cabang: stempel & penukaran
 * di cabangnya saja; voucher terbit/hangus berlaku lintas cabang → tidak ditampilkan.
 */
async function loyaltySummary(env: Parameters<typeof loyaltyActive>[0], branchId: number | undefined, since: string) {
  if (!(await loyaltyActive(env))) return {};
  const db = env.DB;
  const own = branchId !== undefined;
  const stampScope = own ? 'AND branch_id = ?2' : '';
  const redeemScope = own ? 'AND EXISTS (SELECT 1 FROM bookings b WHERE b.id = v.redeemed_booking_id AND b.branch_id = ?2)' : '';
  const binds = own ? [since, branchId] : [since];
  const [stamps, perAdmin, redeemed, issued, expired, active] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS n FROM loyalty_stamps WHERE created_at >= ?1 AND status <> 'removed' ${stampScope}`).bind(...binds),
    db.prepare(
      `SELECT COALESCE(created_by, '-') AS admin, kind, COUNT(*) AS n FROM loyalty_stamps WHERE created_at >= ?1 ${stampScope}
       GROUP BY created_by, kind ORDER BY n DESC LIMIT 20`,
    ).bind(...binds),
    db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(value_snapshot), 0) AS value FROM loyalty_vouchers v WHERE status = 'redeemed' AND redeemed_at >= ?1 ${redeemScope}`).bind(...binds),
    db.prepare(`SELECT COUNT(*) AS n FROM loyalty_vouchers WHERE issued_at >= ?1`).bind(since),
    db.prepare(`SELECT COUNT(*) AS n FROM loyalty_vouchers WHERE status = 'expired' AND expires_at >= ?1`).bind(since),
    db.prepare(`SELECT COUNT(*) AS n FROM loyalty_vouchers WHERE status = 'active'`),
  ]);
  const n = (r: D1Result) => (r.results[0] as { n: number } | undefined)?.n ?? 0;
  return {
    loyalty: {
      stamps: n(stamps),
      stampsByAdmin: perAdmin.results,
      vouchersRedeemed: n(redeemed),
      vouchersRedeemedValue: (redeemed.results[0] as { value: number } | undefined)?.value ?? 0,
      ...(own ? {} : { vouchersIssued: n(issued), vouchersExpired: n(expired), vouchersActive: n(active) }),
    },
  };
}

/** GET /api/admin/export.csv?from=&to=&branch= */
adminReportRoutes.get('/export.csv', async (c) => {
  const admin = c.get('admin')!;
  const from = c.req.query('from') ?? '';
  const to = c.req.query('to') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw badRequest('Isi tanggal dari & sampai (YYYY-MM-DD).');
  const branchId = branchScope(admin, c.req.query('branch') ? Number(c.req.query('branch')) : undefined);
  const [start] = localDayRange(from, 'Asia/Jakarta');
  const [, end] = localDayRange(to, 'Asia/Jakarta');
  const { results } = await c.env.DB.prepare(
    `${ADMIN_BOOKING_SQL} WHERE b.start_at >= ? AND b.start_at < ? ${branchId !== undefined ? 'AND b.branch_id = ?' : ''} ORDER BY b.start_at`,
  )
    .bind(new Date(start).toISOString(), new Date(end).toISOString(), ...(branchId !== undefined ? [branchId] : []))
    .all<Record<string, string | number | null>>();
  const cols: [string, (r: Record<string, string | number | null>) => unknown][] = [
    ['kode', (r) => r.code],
    ['cabang', (r) => r.branch_name],
    ['tanggal', (r) => localDate(Date.parse(String(r.start_at)), String(r.timezone))],
    ['jam_mulai', (r) => new Intl.DateTimeFormat('id-ID', { timeZone: String(r.timezone), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(String(r.start_at)))],
    ['layanan', (r) => r.service_name_snapshot],
    ['durasi_menit', (r) => r.duration_snapshot],
    ['harga', (r) => r.price_snapshot],
    ['hairstylist', (r) => r.barber_name],
    ['pelanggan', (r) => r.customer_name],
    ['whatsapp', (r) => r.customer_phone],
    ['status', (r) => r.status],
    ['sumber', (r) => r.source],
    ['catatan_pelanggan', (r) => r.customer_note],
    ['catatan_admin', (r) => r.admin_note],
    ['alasan_batal', (r) => r.cancel_reason],
    ['dibuat', (r) => r.created_at],
  ];
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    // Cegah formula injection di Excel/Sheets
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const csv = '﻿' + [cols.map(([h]) => h).join(','), ...results.map((r) => cols.map(([, f]) => cell(f(r))).join(','))].join('\r\n');
  await defer(c, c.env.DB.prepare('INSERT INTO audit_log (actor_type, actor_id, action, entity, payload) VALUES (?, ?, ?, ?, ?)').bind('admin', admin.email, 'export.csv', 'booking', JSON.stringify({ from, to, branchId, rows: results.length })).run());
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="booking-${from}_${to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});

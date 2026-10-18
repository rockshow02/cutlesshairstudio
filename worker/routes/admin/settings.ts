/** Admin: data master (cabang, hairstylist, jam kerja, layanan & harga, libur/cuti, akun admin). */
import { adminUserBody, barberBody, branchBody, branchPriceBody, branchSettingsBody, serviceBody, timeOffBody } from '../../../shared/schemas';
import { createRouter } from '../../app';
import { auditStmt } from '../../lib/bookings';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { body } from '../../lib/http';
import { finishPage, keysetWhere, pageParams } from '../../lib/pagination';
import { allowRoles, assertBranch, auditActor, branchScope } from '../../middleware/admin';

export const adminSettingsRoutes = createRouter();
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_/+&]+/g, '-').replace(/-+/g, '-');

/** Identitas admin + data untuk filter (cabang & barber dalam cakupannya) */
adminSettingsRoutes.get('/me', async (c) => {
  const admin = c.get('admin')!;
  const scope = branchScope(admin);
  const [branches, barbers] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT id, slug, name, timezone, status FROM branches ${scope !== undefined ? 'WHERE id = ?' : ''} ORDER BY sort_order, id`).bind(
      ...(scope !== undefined ? [scope] : []),
    ),
    c.env.DB.prepare(
      `SELECT id, branch_id, name, is_active, sort_order FROM barbers ${scope !== undefined ? 'WHERE branch_id = ?' : ''} ORDER BY sort_order, id`,
    ).bind(...(scope !== undefined ? [scope] : [])),
  ]);
  return c.json({
    admin,
    branches: branches.results,
    barbers: admin.role === 'barber' ? barbers.results.filter((b) => (b as { id: number }).id === admin.barber_id) : barbers.results,
    features: { phonePassword: c.env.AUTH_PHONE_PASSWORD_ENABLED === 'true', shop: c.env.SHOP_ENABLED === 'true' },
  });
});

/* ---------- Cabang ---------- */

adminSettingsRoutes.get('/branches', allowRoles('owner', 'branch_admin'), async (c) => {
  const scope = branchScope(c.get('admin')!);
  const [branches, hours] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT * FROM branches ${scope !== undefined ? 'WHERE id = ?' : ''} ORDER BY sort_order, id`).bind(...(scope !== undefined ? [scope] : [])),
    c.env.DB.prepare('SELECT * FROM branch_hours ORDER BY weekday'),
  ]);
  const h = hours.results as { branch_id: number }[];
  return c.json({ branches: (branches.results as Record<string, unknown>[]).map((b) => ({ ...b, hours: h.filter((x) => x.branch_id === b.id) })) });
});

/** Pengaturan booking cabang + jam buka (owner semua, branch_admin cabangnya) */
adminSettingsRoutes.put('/branches/:id/settings', allowRoles('owner', 'branch_admin'), async (c) => {
  const admin = c.get('admin')!;
  const id = Number(c.req.param('id'));
  assertBranch(admin, id);
  const s = await body(c, branchSettingsBody);
  const stmts = [
    c.env.DB.prepare(
      `UPDATE branches SET booking_lead_min = ?, booking_max_days = ?, cancel_deadline_min = ?, require_manual_confirmation = ?,
         telegram_chat_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    ).bind(s.booking_lead_min, s.booking_max_days, s.cancel_deadline_min, s.require_manual_confirmation ? 1 : 0, s.telegram_chat_id || null, id),
  ];
  if (s.hours) {
    stmts.push(c.env.DB.prepare('DELETE FROM branch_hours WHERE branch_id = ?').bind(id));
    for (const h of s.hours) {
      stmts.push(c.env.DB.prepare('INSERT INTO branch_hours (branch_id, weekday, open_time, close_time) VALUES (?, ?, ?, ?)').bind(id, h.weekday, h.open, h.close));
    }
  }
  stmts.push(auditStmt(c.env.DB, auditActor(admin), 'branch.settings', 'branch', id, s));
  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

/** Tambah / ubah data cabang (owner) */
adminSettingsRoutes.post('/branches', allowRoles('owner'), async (c) => {
  const b = await body(c, branchBody);
  const res = await c.env.DB.prepare(
    `INSERT INTO branches (slug, name, city, province, address, maps_url, lat, lng, whatsapp, timezone, status, photo, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(b.slug, b.name, b.city, b.province, b.address ?? null, b.maps_url || null, b.lat ?? null, b.lng ?? null, b.whatsapp, b.timezone, b.status, b.photo ?? null, b.sort_order)
    .first<{ id: number }>();
  await auditStmt(c.env.DB, auditActor(c.get('admin')!), 'branch.create', 'branch', res!.id, b).run();
  return c.json({ id: res!.id }, 201);
});

adminSettingsRoutes.put('/branches/:id', allowRoles('owner'), async (c) => {
  const id = Number(c.req.param('id'));
  const b = await body(c, branchBody);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE branches SET slug = ?, name = ?, city = ?, province = ?, address = ?, maps_url = ?, lat = ?, lng = ?, whatsapp = ?, timezone = ?,
         status = ?, photo = ?, sort_order = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    ).bind(b.slug, b.name, b.city, b.province, b.address ?? null, b.maps_url || null, b.lat ?? null, b.lng ?? null, b.whatsapp, b.timezone, b.status, b.photo ?? null, b.sort_order, id),
    auditStmt(c.env.DB, auditActor(c.get('admin')!), 'branch.update', 'branch', id, b),
  ]);
  return c.json({ ok: true });
});

/* ---------- Hairstylist ---------- */

adminSettingsRoutes.get('/barbers', allowRoles('owner', 'branch_admin'), async (c) => {
  const scope = branchScope(c.get('admin')!, c.req.query('branch') ? Number(c.req.query('branch')) : undefined);
  const where = scope !== undefined ? 'WHERE b.branch_id = ?' : '';
  const binds = scope !== undefined ? [scope] : [];
  const [barbers, services, working] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT b.* FROM barbers b ${where} ORDER BY b.branch_id, b.sort_order, b.id`).bind(...binds),
    c.env.DB.prepare(`SELECT x.barber_id, x.service_id FROM barber_services x JOIN barbers b ON b.id = x.barber_id ${where}`).bind(...binds),
    c.env.DB.prepare(`SELECT w.barber_id, w.weekday, w.start_time AS start, w.end_time AS "end" FROM working_hours w JOIN barbers b ON b.id = w.barber_id ${where} ORDER BY w.weekday, w.start_time`).bind(...binds),
  ]);
  const sv = services.results as { barber_id: number; service_id: number }[];
  const wk = working.results as { barber_id: number }[];
  return c.json({
    barbers: (barbers.results as Record<string, unknown>[]).map((b) => {
      const id = b.id;
      return { ...b, services: sv.filter((s) => s.barber_id === id).map((s) => s.service_id), working: wk.filter((w) => w.barber_id === id) };
    }),
  });
});

async function saveBarber(db: D1Database, id: number, input: ReturnType<typeof barberBody.parse>, extra: D1PreparedStatement[]) {
  const stmts = [...extra, db.prepare('DELETE FROM barber_services WHERE barber_id = ?').bind(id)];
  for (const sid of input.services) stmts.push(db.prepare('INSERT INTO barber_services (barber_id, service_id) VALUES (?, ?)').bind(id, sid));
  if (input.working) {
    stmts.push(db.prepare('DELETE FROM working_hours WHERE barber_id = ?').bind(id));
    for (const w of input.working) {
      stmts.push(db.prepare('INSERT INTO working_hours (barber_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)').bind(id, w.weekday, w.start, w.end));
    }
  }
  await db.batch(stmts);
}

adminSettingsRoutes.post('/barbers', allowRoles('owner', 'branch_admin'), async (c) => {
  const admin = c.get('admin')!;
  const input = await body(c, barberBody);
  assertBranch(admin, input.branch_id);
  const row = await c.env.DB.prepare(
    `INSERT INTO barbers (branch_id, name, role, photo, specialty, instagram, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(input.branch_id, input.name, input.role ?? null, input.photo ?? null, input.specialty ?? null, input.instagram ?? null, input.is_active ? 1 : 0, input.sort_order)
    .first<{ id: number }>();
  await saveBarber(c.env.DB, row!.id, input, [auditStmt(c.env.DB, auditActor(admin), 'barber.create', 'barber', row!.id, input)]);
  return c.json({ id: row!.id }, 201);
});

adminSettingsRoutes.put('/barbers/:id', allowRoles('owner', 'branch_admin'), async (c) => {
  const admin = c.get('admin')!;
  const id = Number(c.req.param('id'));
  const current = await c.env.DB.prepare('SELECT branch_id FROM barbers WHERE id = ?').bind(id).first<{ branch_id: number }>();
  if (!current) throw notFound('Hairstylist tidak ditemukan.');
  assertBranch(admin, current.branch_id);
  const input = await body(c, barberBody);
  assertBranch(admin, input.branch_id);
  await saveBarber(c.env.DB, id, input, [
    c.env.DB.prepare(`UPDATE barbers SET branch_id = ?, name = ?, role = ?, photo = ?, specialty = ?, instagram = ?, is_active = ?, sort_order = ? WHERE id = ?`).bind(
      input.branch_id, input.name, input.role ?? null, input.photo ?? null, input.specialty ?? null, input.instagram ?? null, input.is_active ? 1 : 0, input.sort_order, id,
    ),
    auditStmt(c.env.DB, auditActor(admin), 'barber.update', 'barber', id, input),
  ]);
  return c.json({ ok: true });
});

/* ---------- Layanan & harga ---------- */

adminSettingsRoutes.get('/services', allowRoles('owner', 'branch_admin'), async (c) => {
  const [services, prices] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT * FROM services ORDER BY sort_order, id'),
    c.env.DB.prepare('SELECT * FROM branch_services'),
  ]);
  const p = prices.results as { service_id: number }[];
  return c.json({ services: (services.results as Record<string, unknown>[]).map((s) => ({ ...s, branches: p.filter((x) => x.service_id === s.id) })) });
});

adminSettingsRoutes.post('/services', allowRoles('owner'), async (c) => {
  const s = await body(c, serviceBody);
  const row = await c.env.DB.prepare(
    `INSERT INTO services (slug, name, category, description, duration_min, buffer_min, base_price, price_from, badge, is_bookable, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(slugify(s.name), s.name, s.category, s.description ?? null, s.duration_min, s.buffer_min, s.base_price, s.price_from ? 1 : 0, s.badge ?? null, s.is_bookable ? 1 : 0, s.is_active ? 1 : 0, s.sort_order)
    .first<{ id: number }>();
  // Layanan baru langsung tersedia di semua cabang dengan harga dasar
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO branch_services (branch_id, service_id, price, is_active) SELECT id, ?, NULL, 1 FROM branches').bind(row!.id),
    auditStmt(c.env.DB, auditActor(c.get('admin')!), 'service.create', 'service', row!.id, s),
  ]);
  return c.json({ id: row!.id }, 201);
});

adminSettingsRoutes.put('/services/:id', allowRoles('owner'), async (c) => {
  const id = Number(c.req.param('id'));
  const s = await body(c, serviceBody);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE services SET name = ?, category = ?, description = ?, duration_min = ?, buffer_min = ?, base_price = ?, price_from = ?, badge = ?,
         is_bookable = ?, is_active = ?, sort_order = ? WHERE id = ?`,
    ).bind(s.name, s.category, s.description ?? null, s.duration_min, s.buffer_min, s.base_price, s.price_from ? 1 : 0, s.badge ?? null, s.is_bookable ? 1 : 0, s.is_active ? 1 : 0, s.sort_order, id),
    auditStmt(c.env.DB, auditActor(c.get('admin')!), 'service.update', 'service', id, s),
  ]);
  return c.json({ ok: true });
});

/** Harga & ketersediaan layanan di satu cabang (owner, atau branch_admin untuk cabangnya) */
adminSettingsRoutes.put('/services/:id/branches/:branchId', allowRoles('owner', 'branch_admin'), async (c) => {
  const admin = c.get('admin')!;
  const id = Number(c.req.param('id'));
  const branchId = Number(c.req.param('branchId'));
  assertBranch(admin, branchId);
  const p = await body(c, branchPriceBody);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO branch_services (branch_id, service_id, price, is_active) VALUES (?, ?, ?, ?)
       ON CONFLICT (branch_id, service_id) DO UPDATE SET price = excluded.price, is_active = excluded.is_active`,
    ).bind(branchId, id, p.price, p.is_active ? 1 : 0),
    auditStmt(c.env.DB, auditActor(admin), 'service.branch_price', 'service', id, { branchId, ...p }),
  ]);
  return c.json({ ok: true });
});

/* ---------- Libur & cuti ---------- */

/**
 * GET /api/admin/time-off?limit=&cursor= → { timeOff, nextCursor, total }
 * Yang berakhir dalam 30 hari terakhir & mendatang, urut tanggal mulai (menaik).
 */
adminSettingsRoutes.get('/time-off', async (c) => {
  const admin = c.get('admin')!;
  const scope = branchScope(admin);
  const page = pageParams(c);
  const binds: unknown[] = [new Date(Date.now() - 30 * 86_400_000).toISOString()];
  let where = 't.end_at > ?';
  if (scope !== undefined) {
    where += ' AND (t.branch_id = ? OR b.branch_id = ?)';
    binds.push(scope, scope);
  }
  if (admin.role === 'barber') {
    where += ' AND t.barber_id = ?';
    binds.push(admin.barber_id);
  }
  const from = `FROM time_off t
     LEFT JOIN barbers b ON b.id = t.barber_id LEFT JOIN branches br ON br.id = COALESCE(t.branch_id, b.branch_id)
     WHERE ${where}`;
  const n = binds.length;
  const { results } = await c.env.DB.prepare(
    `SELECT t.*, b.name AS barber_name, br.name AS branch_name ${from}
       ${page.cursor ? `AND ${keysetWhere('t.start_at', 't.id', 'asc', n + 1)}` : ''}
     ORDER BY t.start_at, t.id LIMIT ?${n + 3}`,
  )
    .bind(...binds, page.cursor?.[0] ?? null, page.cursor ? Number(page.cursor[1]) : null, page.limit + 1)
    .all<Record<string, unknown> & { id: number; start_at: string }>();
  const { items, nextCursor } = finishPage(results, page.limit, (r) => [r.start_at, r.id]);
  const total = (await c.env.DB.prepare(`SELECT COUNT(*) AS n ${from}`).bind(...binds).first<{ n: number }>())?.n ?? 0;
  return c.json({ timeOff: items, nextCursor, total });
});

/** Admin: langsung disetujui. Barber: hanya untuk dirinya sendiri, status pending (perlu disetujui). */
adminSettingsRoutes.post('/time-off', async (c) => {
  const admin = c.get('admin')!;
  const t = await body(c, timeOffBody);
  if (Date.parse(t.end_at) <= Date.parse(t.start_at)) throw badRequest('Waktu selesai harus setelah waktu mulai.');
  let status: 'approved' | 'pending' = 'approved';
  if (admin.role === 'barber') {
    if (t.branch_id || t.barber_id !== admin.barber_id) throw forbidden('Hairstylist hanya bisa mengajukan cuti untuk dirinya sendiri.');
    status = 'pending';
  }
  if (t.branch_id) assertBranch(admin, t.branch_id);
  if (t.barber_id) {
    const b = await c.env.DB.prepare('SELECT branch_id FROM barbers WHERE id = ?').bind(t.barber_id).first<{ branch_id: number }>();
    if (!b) throw notFound('Hairstylist tidak ditemukan.');
    assertBranch(admin, b.branch_id);
  }
  if (!t.branch_id && !t.barber_id) throw badRequest('Pilih cabang (libur cabang) atau hairstylist (cuti).');
  const row = await c.env.DB.prepare(
    `INSERT INTO time_off (barber_id, branch_id, start_at, end_at, reason, note, status, requested_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(t.barber_id ?? null, t.branch_id ?? null, new Date(t.start_at).toISOString(), new Date(t.end_at).toISOString(), t.reason, t.note ?? null, status, admin.email)
    .first<{ id: number }>();
  await auditStmt(c.env.DB, auditActor(admin), 'time_off.create', 'time_off', row!.id, { ...t, status }).run();
  return c.json({ id: row!.id, status }, 201);
});

adminSettingsRoutes.post('/time-off/:id/:action{approve|reject}', allowRoles('owner', 'branch_admin'), async (c) => {
  const admin = c.get('admin')!;
  const id = Number(c.req.param('id'));
  const t = await c.env.DB.prepare('SELECT t.*, b.branch_id AS barber_branch FROM time_off t LEFT JOIN barbers b ON b.id = t.barber_id WHERE t.id = ?')
    .bind(id)
    .first<{ branch_id: number | null; barber_branch: number | null }>();
  if (!t) throw notFound();
  assertBranch(admin, (t.branch_id ?? t.barber_branch)!);
  const status = c.req.param('action') === 'approve' ? 'approved' : 'rejected';
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE time_off SET status = ? WHERE id = ?').bind(status, id),
    auditStmt(c.env.DB, auditActor(admin), `time_off.${status}`, 'time_off', id),
  ]);
  return c.json({ ok: true });
});

adminSettingsRoutes.delete('/time-off/:id', allowRoles('owner', 'branch_admin'), async (c) => {
  const admin = c.get('admin')!;
  const id = Number(c.req.param('id'));
  const t = await c.env.DB.prepare('SELECT t.branch_id, b.branch_id AS barber_branch FROM time_off t LEFT JOIN barbers b ON b.id = t.barber_id WHERE t.id = ?')
    .bind(id)
    .first<{ branch_id: number | null; barber_branch: number | null }>();
  if (!t) throw notFound();
  assertBranch(admin, (t.branch_id ?? t.barber_branch)!);
  await c.env.DB.batch([c.env.DB.prepare('DELETE FROM time_off WHERE id = ?').bind(id), auditStmt(c.env.DB, auditActor(admin), 'time_off.delete', 'time_off', id)]);
  return c.json({ ok: true });
});

/* ---------- Akun admin (owner) ---------- */

adminSettingsRoutes.get('/admin-users', allowRoles('owner'), async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM admin_users ORDER BY role, email').all();
  return c.json({ users: results });
});

adminSettingsRoutes.put('/admin-users', allowRoles('owner'), async (c) => {
  const admin = c.get('admin')!;
  const u = await body(c, adminUserBody);
  if (u.role !== 'owner' && !u.branch_id) throw badRequest('Admin cabang & hairstylist wajib punya cabang.');
  if (u.role === 'barber' && !u.barber_id) throw badRequest('Pilih hairstylist untuk akun barber.');
  if (u.email === admin.email && (!u.is_active || u.role !== 'owner')) throw badRequest('Tidak bisa menonaktifkan atau menurunkan akun Anda sendiri.');
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO admin_users (email, name, role, branch_id, barber_id, is_active) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (email) DO UPDATE SET name = excluded.name, role = excluded.role, branch_id = excluded.branch_id,
         barber_id = excluded.barber_id, is_active = excluded.is_active`,
    ).bind(u.email, u.name ?? null, u.role, u.role === 'owner' ? null : u.branch_id, u.role === 'barber' ? u.barber_id : null, u.is_active ? 1 : 0),
    auditStmt(c.env.DB, auditActor(admin), 'admin_user.upsert', 'admin_user', u.email, u),
  ]);
  return c.json({ ok: true });
});

/**
 * Riwayat aksi (audit) terbaru, owner. GET /api/admin/audit?limit=&cursor= → { entries, nextCursor }.
 * Urut id menurun (id naik seiring waktu); tanpa total (COUNT tabel audit mahal karena terus tumbuh).
 */
adminSettingsRoutes.get('/audit', allowRoles('owner'), async (c) => {
  const page = pageParams(c);
  const { results } = await c.env.DB.prepare(`SELECT * FROM audit_log ${page.cursor ? 'WHERE id < ?1' : ''} ORDER BY id DESC LIMIT ?2`)
    .bind(page.cursor ? Number(page.cursor[1]) : null, page.limit + 1)
    .all<Record<string, unknown> & { id: number }>();
  const { items, nextCursor } = finishPage(results, page.limit, (r) => [r.id, r.id]);
  return c.json({ entries: items, nextCursor });
});

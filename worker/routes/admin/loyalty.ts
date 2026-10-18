/** Admin Cutless Stamp: pengaturan program, kartu pelanggan, penyesuaian manual, gabung tamu, tukar voucher. */
import type { Context } from 'hono';
import { localDate } from '../../../shared/time';
import { loyaltyAdjustBody, loyaltyMergeBody, loyaltySettingsBody, voucherRedeemBody } from '../../../shared/schemas';
import { createRouter, type AppEnv } from '../../app';
import { auditStmt } from '../../lib/bookings';
import { ApiError, badRequest, forbidden, notFound } from '../../lib/errors';
import { body } from '../../lib/http';
import {
  cardView,
  evaluateStatements,
  getLoyaltySettings,
  loyaltyActive,
  loyaltyEnv,
  presentVouchers,
  redeemVoucher,
  unredeemStatements,
  type LoyaltySettings,
  type VoucherRow,
} from '../../lib/loyalty';
import { finishPage, keysetWhere, pageParams } from '../../lib/pagination';
import { allowRoles, auditActor, branchScope } from '../../middleware/admin';
import { scopedBooking } from './bookings';

export const adminLoyaltyRoutes = createRouter();

const ISO = `'%Y-%m-%dT%H:%M:%fZ'`;

async function requireProgram(c: Context<AppEnv>): Promise<LoyaltySettings> {
  const s = await loyaltyActive(c.env);
  if (!s) throw new ApiError(404, 'FEATURE_DISABLED', 'Program Cutless Stamp belum aktif.');
  return s;
}

/** Admin cabang hanya boleh melihat/mengubah pelanggan yang pernah booking di cabangnya */
async function scopedCustomer(c: Context<AppEnv>, id: string) {
  const admin = c.get('admin')!;
  const customer = await c.env.DB.prepare('SELECT id, name, phone, is_guest, status FROM customers WHERE id = ? AND anonymized_at IS NULL')
    .bind(id)
    .first<{ id: string; name: string; phone: string | null; is_guest: number; status: string }>();
  if (!customer) throw notFound('Pelanggan tidak ditemukan.');
  const scope = branchScope(admin);
  if (scope !== undefined) {
    const ok = await c.env.DB.prepare('SELECT 1 AS x FROM bookings WHERE customer_id = ? AND branch_id = ? LIMIT 1').bind(id, scope).first();
    if (!ok) throw forbidden('Pelanggan ini belum pernah booking di cabang Anda.');
  }
  return customer;
}

/* ---------- Pengaturan ---------- */

/** GET /api/admin/loyalty/settings → { available (env), settings } */
adminLoyaltyRoutes.get('/loyalty/settings', allowRoles('owner', 'branch_admin'), async (c) => {
  return c.json({ available: loyaltyEnv(c.env), settings: await getLoyaltySettings(c.env.DB) });
});

/** PUT /api/admin/loyalty/settings (owner) */
adminLoyaltyRoutes.put('/loyalty/settings', allowRoles('owner'), async (c) => {
  if (!loyaltyEnv(c.env)) throw new ApiError(404, 'FEATURE_DISABLED', 'Fitur Cutless Stamp belum tersedia di server ini (LOYALTY_ENABLED).');
  const admin = c.get('admin')!;
  const s = await body(c, loyaltySettingsBody);
  const ids = [...s.tier1_service_ids, ...s.tier2_service_ids];
  const { results } = await c.env.DB.prepare(`SELECT id FROM services WHERE id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(ids)).all<{ id: number }>();
  if (new Set(results.map((r) => r.id)).size !== new Set(ids).size) throw badRequest('Ada layanan hadiah yang tidak ditemukan.');
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE loyalty_settings SET enabled = ?, tier1_stamps = ?, tier1_service_ids = ?, tier2_stamps = ?, tier2_service_ids = ?,
         stamp_valid_months = ?, voucher_valid_days = ?, updated_at = strftime(${ISO}, 'now'), updated_by = ? WHERE id = 1`,
    ).bind(
      s.enabled ? 1 : 0,
      s.tier1_stamps,
      JSON.stringify(s.tier1_service_ids),
      s.tier2_stamps,
      JSON.stringify(s.tier2_service_ids),
      s.stamp_valid_months,
      s.voucher_valid_days,
      admin.email,
    ),
    auditStmt(c.env.DB, auditActor(admin), 'loyalty.settings', 'loyalty', 'settings', s),
  ]);
  return c.json({ settings: await getLoyaltySettings(c.env.DB) });
});

/* ---------- Kartu pelanggan ---------- */

async function stampsPage(db: D1Database, customerId: string, page: ReturnType<typeof pageParams>) {
  const { results } = await db
    .prepare(
      `SELECT st.id, st.booking_id, st.stamp_date, st.status, st.kind, st.reason, st.created_by, st.created_at, st.expires_at, st.cycle,
              br.name AS branch_name, b.service_name_snapshot AS service_name, b.code AS booking_code
       FROM loyalty_stamps st LEFT JOIN branches br ON br.id = st.branch_id LEFT JOIN bookings b ON b.id = st.booking_id
       WHERE st.customer_id = ?1 ${page.cursor ? `AND ${keysetWhere('st.created_at', 'st.id', 'desc', 2)}` : ''}
       ORDER BY st.created_at DESC, st.id DESC LIMIT ?4`,
    )
    .bind(customerId, page.cursor?.[0] ?? null, page.cursor?.[1] ?? null, page.limit + 1)
    .all<{ id: string; created_at: string } & Record<string, unknown>>();
  return finishPage(results, page.limit, (r) => [r.created_at, r.id]);
}

/** Tamu (walk-in) dengan nomor sama yang punya stempel/voucher → bisa digabung (hanya bila tepat 1 akun terdaftar bernomor itu) */
async function mergeCandidates(db: D1Database, customer: { id: string; phone: string | null; is_guest: number }) {
  if (customer.is_guest || !customer.phone) return [];
  const owners = await db.prepare(`SELECT COUNT(*) AS n FROM customers WHERE phone = ? AND is_guest = 0 AND anonymized_at IS NULL`).bind(customer.phone).first<{ n: number }>();
  if ((owners?.n ?? 0) !== 1) return [];
  const { results } = await db
    .prepare(
      `SELECT g.id, g.name,
         (SELECT COUNT(*) FROM loyalty_stamps s WHERE s.customer_id = g.id AND s.status = 'active') AS stamps,
         (SELECT COUNT(*) FROM loyalty_vouchers v WHERE v.customer_id = g.id AND v.status = 'active') AS vouchers
       FROM customers g WHERE g.is_guest = 1 AND g.phone = ? AND g.anonymized_at IS NULL`,
    )
    .bind(customer.phone)
    .all<{ id: string; name: string; stamps: number; vouchers: number }>();
  return results.filter((g) => g.stamps > 0 || g.vouchers > 0);
}

/** GET /api/admin/customers/:id/loyalty → kartu, voucher, riwayat (halaman pertama), kandidat gabung */
adminLoyaltyRoutes.get('/customers/:id/loyalty', allowRoles('owner', 'branch_admin'), async (c) => {
  const s = await loyaltyActive(c.env);
  if (!s) return c.json({ enabled: false });
  const customer = await scopedCustomer(c, c.req.param('id')!);
  const { results } = await c.env.DB.prepare(
    `SELECT v.*, b.code AS booking_code FROM loyalty_vouchers v LEFT JOIN bookings b ON b.id = v.redeemed_booking_id
     WHERE v.customer_id = ? ORDER BY CASE v.status WHEN 'active' THEN 0 ELSE 1 END, v.issued_at DESC LIMIT 20`,
  )
    .bind(customer.id)
    .all<VoucherRow & { booking_code: string | null }>();
  const vouchers = (await presentVouchers(c.env.DB, results)).map((v, i) => ({ ...v, bookingCode: results[i].booking_code }));
  const stamps = await stampsPage(c.env.DB, customer.id, { ...pageParams(c), cursor: null });
  return c.json({
    enabled: true,
    card: await cardView(c.env.DB, customer.id, s),
    vouchers,
    stamps: stamps.items,
    stampsNextCursor: stamps.nextCursor,
    mergeCandidates: await mergeCandidates(c.env.DB, customer),
  });
});

/** GET /api/admin/customers/:id/loyalty/stamps?limit=&cursor= */
adminLoyaltyRoutes.get('/customers/:id/loyalty/stamps', allowRoles('owner', 'branch_admin'), async (c) => {
  await requireProgram(c);
  const customer = await scopedCustomer(c, c.req.param('id')!);
  const page = await stampsPage(c.env.DB, customer.id, pageParams(c));
  return c.json({ stamps: page.items, nextCursor: page.nextCursor });
});

/** POST /api/admin/customers/:id/loyalty/adjust { delta: 1 | -1, reason } (owner) */
adminLoyaltyRoutes.post('/customers/:id/loyalty/adjust', allowRoles('owner'), async (c) => {
  await requireProgram(c);
  const admin = c.get('admin')!;
  const input = await body(c, loyaltyAdjustBody);
  const customer = await scopedCustomer(c, c.req.param('id')!);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const db = c.env.DB;
  const ensure = db.prepare('INSERT OR IGNORE INTO loyalty_cards (customer_id) VALUES (?)').bind(customer.id);
  if (input.delta === 1) {
    const stampId = crypto.randomUUID();
    await db.batch([
      ensure,
      db
        .prepare(
          `INSERT INTO loyalty_stamps (id, customer_id, booking_id, branch_id, stamp_date, cycle, kind, status, reason, created_by, created_at, expires_at)
           SELECT ?1, ?2, NULL, NULL, ?3, card.cycle, 'manual', 'active', ?4, ?5, ?6, strftime(${ISO}, ?6, '+' || s.stamp_valid_months || ' months')
           FROM loyalty_settings s JOIN loyalty_cards card ON card.customer_id = ?2 WHERE s.id = 1`,
        )
        .bind(stampId, customer.id, localDate(now, 'Asia/Jakarta'), input.reason, admin.email, nowIso),
      auditStmt(db, auditActor(admin), 'loyalty.adjust', 'customer', customer.id, { delta: 1, reason: input.reason, stamp: stampId }),
      ...evaluateStatements(db, customer.id, nowIso),
    ]);
  } else {
    const res = await db.batch([
      db
        .prepare(
          `UPDATE loyalty_stamps SET status = 'removed', reason = ?2 WHERE id = (
             SELECT st.id FROM loyalty_stamps st JOIN loyalty_cards card ON card.customer_id = st.customer_id
             WHERE st.customer_id = ?1 AND st.status = 'active' AND st.cycle = card.cycle ORDER BY st.created_at DESC, st.id DESC LIMIT 1)`,
        )
        .bind(customer.id, input.reason),
      auditStmt(db, auditActor(admin), 'loyalty.adjust', 'customer', customer.id, { delta: -1, reason: input.reason }),
    ]);
    if (!res[0].meta.changes) throw new ApiError(409, 'INVALID_TRANSITION', 'Tidak ada stempel aktif yang bisa dicabut.');
  }
  const s = (await getLoyaltySettings(db))!;
  return c.json({ card: await cardView(db, customer.id, s) });
});

/**
 * POST /api/admin/customers/:id/loyalty/merge { guestId } (owner/admin cabang)
 * Pindahkan stempel & voucher tamu walk-in bernomor sama ke akun terdaftar ini. Idempoten: dijalankan lagi → { moved: 0 }.
 * Stempel di tanggal yang sudah ada di akun tidak dipindah (batas 1 stempel per hari).
 */
adminLoyaltyRoutes.post('/customers/:id/loyalty/merge', allowRoles('owner', 'branch_admin'), async (c) => {
  await requireProgram(c);
  const admin = c.get('admin')!;
  const { guestId } = await body(c, loyaltyMergeBody);
  const account = await scopedCustomer(c, c.req.param('id')!);
  const candidates = await mergeCandidates(c.env.DB, account);
  const guest = await c.env.DB.prepare('SELECT id, phone, is_guest FROM customers WHERE id = ?').bind(guestId).first<{ id: string; phone: string | null; is_guest: number }>();
  if (!guest || !guest.is_guest || !account.phone || guest.phone !== account.phone) throw badRequest('Tamu ini tidak bisa digabung ke akun tersebut.');
  if (!candidates.some((g) => g.id === guestId)) {
    // Tidak ada lagi yang bisa dipindah (sudah digabung) → idempoten
    const owners = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM customers WHERE phone = ? AND is_guest = 0 AND anonymized_at IS NULL`).bind(account.phone).first<{ n: number }>();
    if ((owners?.n ?? 0) !== 1) throw badRequest('Nomor ini dipakai lebih dari satu akun terdaftar; gabungkan tidak bisa otomatis.');
  }
  const db = c.env.DB;
  const movable = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM loyalty_stamps g WHERE g.customer_id = ?1
            AND NOT (g.kind IN ('booking', 'order') AND EXISTS (SELECT 1 FROM loyalty_stamps a WHERE a.customer_id = ?2 AND a.kind IN ('booking', 'order') AND a.stamp_date = g.stamp_date))) AS stamps,
         (SELECT COUNT(*) FROM loyalty_vouchers WHERE customer_id = ?1) AS vouchers`,
    )
    .bind(guest.id, account.id)
    .first<{ stamps: number; vouchers: number }>();
  if (!movable || (!movable.stamps && !movable.vouchers)) return c.json({ moved: { stamps: 0, vouchers: 0 } });
  const nowIso = new Date().toISOString();
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO loyalty_cards (customer_id) VALUES (?)').bind(account.id),
    // Stempel aktif masuk ke siklus kartu akun; konflik tanggal (UNIQUE) dilewati (tetap di tamu)
    db
      .prepare(`UPDATE OR IGNORE loyalty_stamps SET customer_id = ?2, cycle = (SELECT cycle FROM loyalty_cards WHERE customer_id = ?2) WHERE customer_id = ?1 AND status = 'active'`)
      .bind(guest.id, account.id),
    db.prepare(`UPDATE OR IGNORE loyalty_stamps SET customer_id = ?2 WHERE customer_id = ?1 AND status <> 'active'`).bind(guest.id, account.id),
    db.prepare(`UPDATE loyalty_vouchers SET customer_id = ?2 WHERE customer_id = ?1`).bind(guest.id, account.id),
    auditStmt(db, auditActor(admin), 'loyalty.merge', 'customer', account.id, { guest: guest.id, stamps: movable.stamps, vouchers: movable.vouchers }),
    ...evaluateStatements(db, account.id, nowIso),
  ]);
  return c.json({ moved: movable });
});

/* ---------- Voucher di booking ---------- */

/** GET /api/admin/bookings/:id/vouchers → { enabled, redeemed, eligible } */
adminLoyaltyRoutes.get('/bookings/:id/vouchers', allowRoles('owner', 'branch_admin'), async (c) => {
  const s = await loyaltyActive(c.env);
  if (!s) return c.json({ enabled: false });
  const b = await scopedBooking(c, c.req.param('id')!);
  const redeemed = await c.env.DB.prepare('SELECT * FROM loyalty_vouchers WHERE redeemed_booking_id = ?').bind(b.id).first<VoucherRow>();
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM loyalty_vouchers WHERE customer_id = ?1 AND status = 'active' AND expires_at > ?2
       AND EXISTS (SELECT 1 FROM json_each(service_ids) WHERE value = ?3) ORDER BY expires_at`,
  )
    .bind(b.customer_id, new Date().toISOString(), b.service_id)
    .all<VoucherRow>();
  return c.json({
    enabled: true,
    redeemed: redeemed ? (await presentVouchers(c.env.DB, [redeemed]))[0] : null,
    eligible: ['pending', 'confirmed'].includes(b.status) ? await presentVouchers(c.env.DB, results) : [],
  });
});

/** POST /api/admin/bookings/:id/voucher { voucherId } → tukar voucher (harga booking jadi Rp0, tanpa stempel) */
adminLoyaltyRoutes.post('/bookings/:id/voucher', allowRoles('owner', 'branch_admin'), async (c) => {
  await requireProgram(c);
  const admin = c.get('admin')!;
  const { voucherId } = await body(c, voucherRedeemBody);
  const b = await scopedBooking(c, c.req.param('id')!);
  await redeemVoucher(c.env.DB, { voucherId, booking: b, actor: auditActor(admin) });
  return c.json({ ok: true });
});

/** DELETE /api/admin/bookings/:id/voucher → batalkan penukaran (sebelum Selesai) */
adminLoyaltyRoutes.delete('/bookings/:id/voucher', allowRoles('owner', 'branch_admin'), async (c) => {
  await requireProgram(c);
  const admin = c.get('admin')!;
  const b = await scopedBooking(c, c.req.param('id')!);
  if (!['pending', 'confirmed'].includes(b.status)) throw new ApiError(409, 'INVALID_TRANSITION', 'Penukaran hanya bisa dibatalkan sebelum booking Selesai.');
  const res = await c.env.DB.batch(unredeemStatements(c.env.DB, b.id, auditActor(admin), Date.now()));
  if (!res[2].meta.changes) throw notFound('Tidak ada voucher di booking ini.');
  return c.json({ ok: true });
});

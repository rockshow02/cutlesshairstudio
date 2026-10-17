/** Cutless Stamp untuk pelanggan: info program (publik), kartu & voucher saya, riwayat stempel. */
import { createRouter } from '../app';
import { cardView, loyaltyActive, presentVouchers, serviceNames, type VoucherRow } from '../lib/loyalty';
import { finishPage, keysetWhere, pageParams } from '../lib/pagination';
import { requireCustomer } from '../middleware/customer';

export const loyaltyRoutes = createRouter();

/** GET /api/loyalty/program → info program untuk syarat & ketentuan / halaman sukses (cache 60 detik) */
loyaltyRoutes.get('/loyalty/program', async (c) => {
  const s = await loyaltyActive(c.env);
  c.header('Cache-Control', 'public, max-age=60');
  if (!s) return c.json({ enabled: false });
  const names = await serviceNames(c.env.DB, [...s.tier1_service_ids, ...s.tier2_service_ids]);
  return c.json({
    enabled: true,
    tier1: { stamps: s.tier1_stamps, services: s.tier1_service_ids.map((i) => names[i]).filter(Boolean) },
    tier2: { stamps: s.tier2_stamps, services: s.tier2_service_ids.map((i) => names[i]).filter(Boolean) },
    stampValidMonths: s.stamp_valid_months,
    voucherValidDays: s.voucher_valid_days,
  });
});

loyaltyRoutes.use('/me/loyalty', requireCustomer);
loyaltyRoutes.use('/me/loyalty/*', requireCustomer);

/** GET /api/me/loyalty → { enabled, card, vouchers (aktif) } */
loyaltyRoutes.get('/me/loyalty', async (c) => {
  const s = await loyaltyActive(c.env);
  if (!s) return c.json({ enabled: false });
  const me = c.get('customer')!;
  const { results } = await c.env.DB.prepare(`SELECT * FROM loyalty_vouchers WHERE customer_id = ? AND status = 'active' ORDER BY expires_at`)
    .bind(me.id)
    .all<VoucherRow>();
  return c.json({ enabled: true, card: await cardView(c.env.DB, me.id, s), vouchers: await presentVouchers(c.env.DB, results) });
});

/** GET /api/me/loyalty/stamps?limit=&cursor= → riwayat stempel terbaru dulu { stamps, nextCursor } */
loyaltyRoutes.get('/me/loyalty/stamps', async (c) => {
  const s = await loyaltyActive(c.env);
  if (!s) return c.json({ stamps: [], nextCursor: null });
  const me = c.get('customer')!;
  const page = pageParams(c);
  const { results } = await c.env.DB.prepare(
    `SELECT st.id, st.stamp_date, st.status, st.kind, st.created_at, st.expires_at, br.name AS branch_name, b.service_name_snapshot AS service_name
     FROM loyalty_stamps st LEFT JOIN branches br ON br.id = st.branch_id LEFT JOIN bookings b ON b.id = st.booking_id
     WHERE st.customer_id = ?1 AND st.status <> 'removed' ${page.cursor ? `AND ${keysetWhere('st.created_at', 'st.id', 'desc', 2)}` : ''}
     ORDER BY st.created_at DESC, st.id DESC LIMIT ?4`,
  )
    .bind(me.id, page.cursor?.[0] ?? null, page.cursor?.[1] ?? null, page.limit + 1)
    .all<{ id: string; created_at: string } & Record<string, unknown>>();
  const { items, nextCursor } = finishPage(results, page.limit, (r) => [r.created_at, r.id]);
  return c.json({ stamps: items, nextCursor });
});

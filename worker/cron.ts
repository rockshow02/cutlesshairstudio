/**
 * Cron Trigger (staging: wrangler.jsonc → triggers.crons):
 *  "*\/15 * * * *" → batalkan pending kedaluwarsa, hapus sesi kedaluwarsa & catatan rate limit lama
 *                   + toko: pesanan belum dibayar kedaluwarsa, selesai otomatis setelah dikirim, tandai lewat batas ambil
 *  "0 19 * * *"   → (02.00 WIB) anonimkan pelanggan yang tidak aktif > 24 bulan
 */
import { PENDING_CUTOFF_BEFORE_START_MIN, PENDING_TTL_MIN } from '../shared/booking';
import { expireLoyalty } from './lib/loyalty';
import { runShopCron } from './lib/shop';
import type { Env } from './env';
import { getBranch } from './lib/availability';
import { transitionBooking } from './lib/bookings';
import { notifyBranch } from './lib/notify';
import { anonymizeCustomer } from './routes/me';

const MIN = 60_000;
const SYSTEM = { type: 'system' as const, id: 'cron' };

/** Pending tidak dikonfirmasi dalam 2 jam, atau jadwal tinggal < 60 menit → dibatalkan otomatis */
export async function expirePendingBookings(env: Env, now = Date.now()): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT id, branch_id FROM bookings WHERE status = 'pending' AND (created_at <= ? OR start_at <= ?) LIMIT 200`,
  )
    .bind(new Date(now - PENDING_TTL_MIN * MIN).toISOString(), new Date(now + PENDING_CUTOFF_BEFORE_START_MIN * MIN).toISOString())
    .all<{ id: string; branch_id: number }>();
  let done = 0;
  for (const b of results) {
    try {
      await transitionBooking(env.DB, {
        bookingId: b.id,
        to: 'cancelled',
        actor: 'system',
        audit: SYSTEM,
        reason: 'Dibatalkan otomatis: tidak dikonfirmasi cabang tepat waktu',
        now,
      });
      done++;
      await notifyBranch(env, await getBranch(env.DB, b.branch_id), 'auto_cancelled', b.id);
    } catch (e) {
      console.error('expire pending', b.id, e);
    }
  }
  return done;
}

export async function cleanup(env: Env, now = Date.now()): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(new Date(now).toISOString()),
    env.DB.prepare('DELETE FROM rate_limits WHERE window_start <= ?').bind(new Date(now - 86_400_000).toISOString()),
  ]);
}

/** UU PDP: pelanggan tanpa login & tanpa booking selama 24 bulan → dianonimkan (riwayat booking tetap) */
export async function anonymizeInactive(env: Env, now = Date.now()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 24);
  const iso = cutoff.toISOString();
  const { results } = await env.DB.prepare(
    `SELECT id FROM customers c WHERE c.anonymized_at IS NULL AND COALESCE(c.last_login_at, c.created_at) < ?
       AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.customer_id = c.id AND b.start_at >= ?) LIMIT 500`,
  )
    .bind(iso, iso)
    .all<{ id: string }>();
  for (const c of results) await anonymizeCustomer(env.DB, c.id, SYSTEM, 'Tidak aktif lebih dari 24 bulan');
  return results.length;
}

export async function runScheduled(env: Env, cron: string, now = Date.now()): Promise<void> {
  if (cron === '0 19 * * *') {
    const n = await anonymizeInactive(env, now);
    console.log(`cron: ${n} akun tidak aktif dianonimkan`);
    const expired = await expireLoyalty(env, now);
    if (expired.stamps || expired.vouchers) console.log(`cron: ${expired.stamps} stempel & ${expired.vouchers} voucher hangus`);
    return;
  }
  const n = await expirePendingBookings(env, now);
  await cleanup(env, now);
  if (n) console.log(`cron: ${n} booking pending dibatalkan otomatis`);
  try {
    const shop = await runShopCron(env, now);
    if (shop.expired || shop.completed || shop.overdue) console.log(`cron toko: ${shop.expired} kedaluwarsa, ${shop.completed} selesai otomatis, ${shop.overdue} lewat batas ambil`);
  } catch (e) {
    console.error('cron toko', e);
  }
}

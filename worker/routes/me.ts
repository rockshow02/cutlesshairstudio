/** Akun pelanggan: profil, riwayat booking, hapus akun (anonimisasi). */
import { completeProfileBody, updateProfileBody } from '../../shared/schemas';
import { createRouter } from '../app';
import { ApiError } from '../lib/errors';
import { assertSameOrigin } from '../lib/guard';
import { body } from '../lib/http';
import { destroySession } from '../lib/session';
import { auditStmt } from '../lib/bookings';
import { requireCustomer } from '../middleware/customer';

export const meRoutes = createRouter();
meRoutes.use('/me', requireCustomer);
meRoutes.use('/me/*', requireCustomer);

meRoutes.get('/me', (c) => {
  const { id: _id, ...me } = c.get('customer')!;
  return c.json({ customer: me });
});

/** Lengkapi profil (login pertama): nama, nomor WA (62xxx), persetujuan kebijakan privasi */
meRoutes.post('/me/profile', async (c) => {
  assertSameOrigin(c);
  const input = await body(c, completeProfileBody);
  const me = c.get('customer')!;
  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE customers SET name = ?, phone = ?, privacy_consent_at = COALESCE(privacy_consent_at, ?) WHERE id = ?').bind(
      input.name,
      input.phone,
      now,
      me.id,
    ),
    auditStmt(c.env.DB, { type: 'customer', id: me.id }, 'customer.profile_complete', 'customer', me.id),
  ]);
  return c.json({ ok: true });
});

/** Ubah nama / nomor */
meRoutes.patch('/me/profile', async (c) => {
  assertSameOrigin(c);
  const input = await body(c, updateProfileBody);
  const me = c.get('customer')!;
  if (!me.privacy_consent_at) throw new ApiError(403, 'PROFILE_INCOMPLETE', 'Lengkapi profil terlebih dahulu.');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE customers SET name = ?, phone = ? WHERE id = ?').bind(input.name, input.phone, me.id),
    auditStmt(c.env.DB, { type: 'customer', id: me.id }, 'customer.profile_update', 'customer', me.id),
  ]);
  return c.json({ ok: true });
});

/**
 * Hapus akun (UU PDP): data pribadi dianonimkan, booking historis tetap ada (untuk laporan cabang).
 * Booking aktif yang akan datang dibatalkan & slotnya dilepas.
 */
meRoutes.delete('/me', async (c) => {
  assertSameOrigin(c);
  const me = c.get('customer')!;
  await anonymizeCustomer(c.env.DB, me.id, { type: 'customer', id: me.id }, 'Akun dihapus pelanggan');
  await destroySession(c);
  return c.json({ ok: true });
});

export async function anonymizeCustomer(db: D1Database, customerId: string, actor: { type: 'customer' | 'admin' | 'system'; id: string | null }, reason: string) {
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        `DELETE FROM booking_slots WHERE booking_id IN (SELECT id FROM bookings WHERE customer_id = ? AND status IN ('pending', 'confirmed') AND start_at > ?)`,
      )
      .bind(customerId, now),
    db
      .prepare(
        `UPDATE bookings SET status = 'cancelled', cancelled_at = ?, cancelled_by = 'system', cancel_reason = ?
         WHERE customer_id = ? AND status IN ('pending', 'confirmed') AND start_at > ?`,
      )
      .bind(now, reason, customerId, now),
    db
      .prepare(
        `UPDATE customers SET name = 'Pengguna dihapus', email = NULL, phone = NULL, google_sub = NULL, password_hash = NULL,
           anonymized_at = ?, status = 'blocked' WHERE id = ?`,
      )
      .bind(now, customerId),
    db.prepare('DELETE FROM sessions WHERE customer_id = ?').bind(customerId),
    auditStmt(db, actor, 'customer.anonymize', 'customer', customerId, { reason }),
  ]);
}

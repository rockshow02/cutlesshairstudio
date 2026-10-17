import { localSql } from './db';

/**
 * Lokal saja: hapus data uji E2E sebelumnya dari D1 lokal (email berawalan e2e-, repro-, dbg-, atau nama berisi "E2E"),
 * agar jadwal tidak penuh oleh sisa run sebelumnya. Tidak pernah dijalankan ke staging/produksi.
 */
export default function globalSetup() {
  if (process.env.E2E_BASE_URL) return;
  const who = `(SELECT id FROM customers WHERE email LIKE 'e2e-%' OR email LIKE 'repro-%' OR email LIKE 'dbg-%' OR name LIKE '%E2E%')`;
  localSql([
    // Cutless Stamp dulu (foreign key ke booking & pelanggan)
    `DELETE FROM loyalty_stamps WHERE customer_id IN ${who} OR booking_id IN (SELECT id FROM bookings WHERE customer_id IN ${who})`,
    `DELETE FROM loyalty_vouchers WHERE customer_id IN ${who} OR redeemed_booking_id IN (SELECT id FROM bookings WHERE customer_id IN ${who})`,
    `DELETE FROM loyalty_cards WHERE customer_id IN ${who}`,
    `DELETE FROM booking_slots WHERE booking_id IN (SELECT id FROM bookings WHERE customer_id IN ${who})`,
    `DELETE FROM bookings WHERE customer_id IN ${who}`,
    `DELETE FROM sessions WHERE customer_id IN ${who}`,
    `DELETE FROM customers WHERE id IN ${who}`,
    `DELETE FROM rate_limits`,
  ]);
}

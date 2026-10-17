/**
 * Pernyataan stok Cutless Shop yang dipicu transisi pesanan. Setiap transisi menulis orders.transition_id = token
 * (UUID baru); pernyataan di bawah hanya menyentuh pesanan dengan token itu, jadi aman bila dua permintaan
 * bersamaan mengubah pesanan yang sama (yang kalah tidak menulis token → stok tidak tersentuh dua kali).
 * Tanpa impor dari bookings.ts (dipakai transitionBooking).
 */

/** Item pesanan bertoken, dijumlahkan per varian */
const qtyFor = `(SELECT COALESCE(SUM(oi.qty), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                 WHERE o.transition_id = ?1 AND oi.variant_id = variant_stock.variant_id AND o.branch_id = variant_stock.branch_id)`;
const touched = `EXISTS (SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
                 WHERE o.transition_id = ?1 AND oi.variant_id = variant_stock.variant_id AND o.branch_id = variant_stock.branch_id)`;

/** Lepas reservasi (batal / kedaluwarsa / refund sebelum barang keluar) */
export const releaseByToken = (db: D1Database, token: string, nowIso: string) =>
  db.prepare(`UPDATE variant_stock SET reserved = reserved - ${qtyFor}, updated_at = ?2 WHERE ${touched}`).bind(token, nowIso);

/** Barang keluar (diambil / dikirim / dibayar & diambil di kasir): stok fisik & reservasi sama-sama berkurang */
export const deductByToken = (db: D1Database, token: string, nowIso: string) =>
  db.prepare(`UPDATE variant_stock SET on_hand = on_hand - ${qtyFor}, reserved = reserved - ${qtyFor}, updated_at = ?2 WHERE ${touched}`).bind(token, nowIso);

/**
 * Booking batal / tidak datang (dalam batch transitionBooking): pesanan "ambil saat booking" yang menunggu ikut batal
 * dan reservasinya dilepas. Bersyarat status booking memang sudah berubah.
 */
export function cancelBookingOrdersStatements(db: D1Database, bookingId: string, actor: { type: string; id: string | null }, now: number): D1PreparedStatement[] {
  const token = crypto.randomUUID();
  const nowIso = new Date(now).toISOString();
  return [
    db
      .prepare(
        `UPDATE orders SET status = 'cancelled', cancelled_at = ?3, cancelled_by = 'system', cancel_reason = 'Booking dibatalkan / tidak datang',
           transition_id = ?2, updated_at = ?3
         WHERE booking_id = ?1 AND status = 'reserved_booking'
           AND EXISTS (SELECT 1 FROM bookings WHERE id = ?1 AND status IN ('cancelled', 'no_show'))`,
      )
      .bind(bookingId, token, nowIso),
    releaseByToken(db, token, nowIso),
    db
      .prepare(
        `INSERT INTO audit_log (actor_type, actor_id, action, entity, entity_id, payload)
         SELECT ?2, ?3, 'order.cancelled', 'order', id, json_object('reason', 'booking', 'booking', ?4) FROM orders WHERE transition_id = ?1`,
      )
      .bind(token, actor.type === 'barber' ? 'admin' : actor.type, actor.id, bookingId),
  ];
}

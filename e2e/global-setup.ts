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
    // Cutless Shop: pesanan pelanggan uji, lalu produk uji (slug berawalan e2e-)
    `DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE customer_id IN ${who})`,
    `DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE customer_id IN ${who})`,
    `DELETE FROM orders WHERE customer_id IN ${who}`,
    // Reservasi stok mengikuti pesanan yang masih terbuka (pesanan uji dihapus langsung, bukan dibatalkan)
    `UPDATE variant_stock SET reserved = (SELECT COALESCE(SUM(oi.qty), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE oi.variant_id = variant_stock.variant_id AND o.branch_id = variant_stock.branch_id
         AND o.status IN ('awaiting_quote', 'awaiting_payment', 'reserved_booking', 'paid', 'ready'))`,
    `DELETE FROM variant_stock WHERE variant_id IN (SELECT v.id FROM product_variants v JOIN products p ON p.id = v.product_id WHERE p.slug LIKE 'e2e-%')`,
    `DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE slug LIKE 'e2e-%')`,
    `DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE slug LIKE 'e2e-%') AND id NOT IN (SELECT variant_id FROM order_items)`,
    `DELETE FROM products WHERE slug LIKE 'e2e-%' AND id NOT IN (SELECT product_id FROM order_items)`,
    `DELETE FROM booking_slots WHERE booking_id IN (SELECT id FROM bookings WHERE customer_id IN ${who})`,
    `DELETE FROM bookings WHERE customer_id IN ${who}`,
    `DELETE FROM sessions WHERE customer_id IN ${who}`,
    `DELETE FROM customers WHERE id IN ${who}`,
    `DELETE FROM rate_limits`,
  ]);
}

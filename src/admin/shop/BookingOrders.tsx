/** Detail booking (admin): produk yang diambil saat booking ini, diproses lunas di kasir dari sini. */
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/app/api';
import { rupiah } from '@/app/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ORDER_TONE, type Order } from '@/shop/types';
import { OrderSheet } from './ShopOrders';
import styles from '../admin.module.css';

export function BookingOrders({ bookingId }: { bookingId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const load = useCallback(() => {
    api<{ enabled: boolean; orders: Order[] }>(`/admin/bookings/${bookingId}/orders`)
      .then((r) => setOrders(r.orders))
      .catch(() => setOrders([]));
  }, [bookingId]);
  useEffect(load, [load]);
  if (!orders.length) return null;
  return (
    <div className={styles.subPanel} aria-label="Produk saat booking">
      <h3 className={styles.sectionLabel}>Produk diambil saat booking</h3>
      {orders.map((o) => (
        <div key={o.id} className={styles.row}>
          <span>
            {o.items.map((i) => `${i.qty}× ${i.product_name}`).join(', ')} · <strong>{rupiah(o.total)}</strong>{' '}
            <Badge tone={ORDER_TONE[o.status]} dot>
              {o.statusLabel}
            </Badge>
          </span>
          <Button variant="outline-dark" casing="normal" size="sm" onClick={() => setOpenId(o.id)}>
            {o.status === 'reserved_booking' ? 'Proses di kasir' : 'Detail'}
          </Button>
        </div>
      ))}
      {openId && <OrderSheet id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

/** Tambah produk ke booking (diambil & dibayar di kasir saat datang). Dipakai di Booking saya & halaman sukses booking. */
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/app/api';
import { rupiah } from '@/app/format';
import { Button } from '@/components/ui/Button';
import { Alert, SkeletonList } from '@/components/ui/Feedback';
import { Sheet } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/toastContext';
import type { CustomerBooking } from '@/booking/types';
import { notReleased, useShopConfig } from './cart';
import { Stepper, Thumb } from './parts';
import type { OrderListItem, ShopProduct } from './types';
import styles from './shop.module.css';

export function BookingProducts({ booking }: { booking: Pick<CustomerBooking, 'id' | 'status' | 'startAt' | 'branch'> }) {
  const { config } = useShopConfig();
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);
  const branch = config?.enabled ? config.branches.find((b) => b.slug === booking.branch.slug) : undefined;
  const enabled = Boolean(branch?.fulfillment.includes('with_booking'));
  const upcoming = ['pending', 'confirmed'].includes(booking.status) && Date.parse(booking.startAt) > Date.now();

  const loadOrders = () =>
    api<{ orders: OrderListItem[] }>('/me/orders?limit=50')
      .then((r) => setOrders(r.orders.filter((o) => o.booking_id === booking.id && o.status === 'reserved_booking')))
      .catch(() => setOrders([]));
  useEffect(() => {
    if (enabled) loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, booking.id]);

  if (!enabled || !branch) return null;
  const items = (orders ?? []).flatMap((o) => o.items);
  return (
    <div className={styles.bookingProducts}>
      {items.length > 0 && (
        <p>
          <strong>Produk diambil saat datang:</strong> {items.map((i) => `${i.qty}× ${i.product_name}`).join(', ')} ·{' '}
          {rupiah((orders ?? []).reduce((n, o) => n + o.total, 0))} <a href="/pesanan">(bayar di kasir)</a>
        </p>
      )}
      {upcoming && (
        <Button variant="outline-dark" size="sm" icon="plus" onClick={() => setOpen(true)} aria-haspopup="dialog">
          Tambah produk
        </Button>
      )}
      {open && <PickSheet bookingId={booking.id} branchId={branch.id} branchName={branch.name} onClose={() => setOpen(false)} onDone={loadOrders} />}
    </div>
  );
}

function PickSheet({ bookingId, branchId, branchName, onClose, onDone }: { bookingId: string; branchId: number; branchName: string; onClose: () => void; onDone: () => void }) {
  const [products, setProducts] = useState<ShopProduct[] | null>(null);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api<{ products: ShopProduct[] }>('/shop/products?limit=50')
      .then((r) => setProducts(r.products))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const variants = (products ?? []).flatMap((p) =>
    notReleased(p) ? [] : p.variants.filter((v) => v.isActive && (v.stock[String(branchId)] ?? 0) > 0).map((v) => ({ product: p, variant: v, stock: v.stock[String(branchId)] ?? 0 })),
  );
  const chosen = Object.entries(qty).filter(([, n]) => n > 0).map(([variantId, n]) => ({ variantId: Number(variantId), qty: n }));
  const total = chosen.reduce((s, c) => s + (variants.find((v) => v.variant.id === c.variantId)?.variant.price ?? 0) * c.qty, 0);

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api(`/bookings/${bookingId}/products`, { method: 'POST', json: { items: chosen } });
      toast('Produk ditambahkan. Bayar di kasir saat datang.');
      onDone();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Tambah produk"
      meta={`Diambil & dibayar di kasir ${branchName}`}
      footer={
        <Button variant="dark" block size="lg" icon="check" disabled={busy || chosen.length === 0} onClick={save}>
          {chosen.length ? `Simpan · ${rupiah(total)}` : 'Pilih produk'}
        </Button>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}
      {!products ? (
        <SkeletonList count={3} label="Memuat produk…" height={56} />
      ) : variants.length === 0 ? (
        <p className={styles.lineMeta}>Belum ada produk tersedia di cabang ini.</p>
      ) : (
        <ul className={styles.pickList}>
          {variants.map(({ product, variant, stock }) => {
            const n = qty[variant.id] ?? 0;
            return (
              <li key={variant.id} className={styles.pick}>
                <Thumb className={styles.lineImg} path={product.images[0]?.path} size={48} />
                <div className={styles.lineMain}>
                  <span className={styles.lineName}>{product.name}</span>
                  <span className={styles.lineMeta}>
                    {variant.name} · {rupiah(variant.price)} · stok {stock}
                  </span>
                </div>
                {n > 0 ? (
                  <Stepper small min={0} value={n} max={stock} label={product.name} onChange={(v) => setQty({ ...qty, [variant.id]: Math.max(0, v) })} />
                ) : (
                  <Button variant="outline-dark" size="sm" onClick={() => setQty({ ...qty, [variant.id]: 1 })}>
                    Pilih<span className="visually-hidden"> {product.name}</span>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}

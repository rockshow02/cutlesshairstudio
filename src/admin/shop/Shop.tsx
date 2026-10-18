/** Admin → Toko: Pesanan · Produk & stok · Ringkasan · Pengaturan */
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/app/api';
import { rupiah } from '@/app/format';
import { Alert, EmptyState, SkeletonList } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ShopOrders } from './ShopOrders';
import { ShopProducts } from './ShopProducts';
import { ShopSettings, type ShopAdminState } from './ShopSettings';
import styles from '../admin.module.css';

type View = 'pesanan' | 'produk' | 'ringkasan' | 'pengaturan';

export function Shop() {
  const [state, setState] = useState<ShopAdminState | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('pesanan');
  const load = useCallback(() => {
    api<ShopAdminState>('/admin/shop/settings')
      .then(setState)
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  const active = Boolean(state?.available && state.settings?.enabled);
  const shown: View = active ? view : 'pengaturan';
  return (
    <section aria-labelledby="toko-title">
      <PageHeader titleId="toko-title" title="Toko" description="Pesanan produk, stok per cabang, dan pengaturan Cutless Shop." />
      {error && <Alert tone="danger">{error}</Alert>}
      {!state ? (
        !error && <SkeletonList label="Memuat toko…" count={2} height={96} />
      ) : (
        <div className={styles.stack}>
          {active ? (
            <SegmentedControl<View>
              label="Bagian toko"
              value={view}
              onChange={setView}
              wrap
              options={[
                { value: 'pesanan', label: 'Pesanan' },
                { value: 'produk', label: 'Produk & stok' },
                { value: 'ringkasan', label: 'Ringkasan' },
                { value: 'pengaturan', label: 'Pengaturan' },
              ]}
            />
          ) : (
            <Alert tone="info" role="none">
              Toko masih mati. Isi pengaturan cabang, seed produk & stok, lalu centang “Toko aktif”.
            </Alert>
          )}
          {shown === 'pesanan' && <ShopOrders />}
          {shown === 'produk' && <ShopProducts lowStock={state.settings?.low_stock_threshold ?? 3} />}
          {shown === 'ringkasan' && <ShopSummary />}
          {shown === 'pengaturan' && state.settings && <ShopSettings state={state} onSaved={load} />}
        </div>
      )}
    </section>
  );
}

interface SummaryData {
  days: number;
  revenue: { orders: number; subtotal: number; total: number };
  topProducts: { product_id: number; product_name: string; qty: number; revenue: number }[];
  lowStock: { branch_name: string; product_name: string; variant_name: string; available: number }[];
  lowStockThreshold: number;
  todo: Record<string, number>;
  pickupOverdue: number;
}

function ShopSummary() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<SummaryData>('/admin/shop/summary?days=30')
      .then(setData)
      .catch((e) => setError(errorMessage(e)));
  }, []);
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <SkeletonList label="Memuat ringkasan…" count={2} height={96} />;
  const todo = (k: string) => data.todo[k] ?? 0;
  return (
    <div className={styles.stack}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{rupiah(data.revenue.subtotal)}</span>
          <span className={styles.statLabel}>omzet produk 30 hari ({data.revenue.orders} pesanan lunas)</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{todo('paid') + todo('awaiting_quote')}</span>
          <span className={styles.statLabel}>perlu tindakan (disiapkan / isi ongkir)</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{todo('awaiting_payment')}</span>
          <span className={styles.statLabel}>menunggu pembayaran</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{data.pickupOverdue}</span>
          <span className={styles.statLabel}>belum diambil (lewat batas)</span>
        </div>
      </div>
      <h2 className={styles.h2}>Produk terlaris (30 hari)</h2>
      {data.topProducts.length === 0 ? (
        <EmptyState icon="tag" title="Belum ada penjualan" compact />
      ) : (
        <ol className={styles.rank}>
          {data.topProducts.map((p) => (
            <li key={p.product_id}>
              <span>{p.product_name}</span>
              <strong>
                {p.qty} terjual · {rupiah(p.revenue)}
              </strong>
            </li>
          ))}
        </ol>
      )}
      <h2 className={styles.h2}>Stok menipis (≤ {data.lowStockThreshold})</h2>
      {data.lowStock.length === 0 ? (
        <EmptyState icon="check" title="Stok aman" compact />
      ) : (
        <ol className={styles.rank}>
          {data.lowStock.map((s, i) => (
            <li key={i}>
              <span>
                {s.product_name} · {s.variant_name} · {s.branch_name}
              </span>
              <strong>{s.available} tersedia</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

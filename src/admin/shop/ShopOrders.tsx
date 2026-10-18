/** Admin → Toko → Pesanan: filter status/cabang, detail, aksi (ongkir, Lunas, siap, kirim, selesai, batal, refund). */
import { useEffect, useState } from 'react';
import { api, ApiClientError, errorMessage } from '@/app/api';
import { clock, rupiah, shortDate, tzLabel, waLink } from '@/app/format';
import { usePaged } from '@/app/usePaged';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert, EmptyState, SkeletonList } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Field';
import { LoadMore } from '@/components/ui/LoadMore';
import { Sheet } from '@/components/ui/Overlay';
import { useConfirm } from '@/components/ui/useConfirm';
import { useToast } from '@/components/ui/toastContext';
import { ORDER_TONE, type Order, type OrderAction, type OrderListItem, type OrderStatus } from '@/shop/types';
import { useAdmin } from '../context';
import styles from '../admin.module.css';
import local from './shopAdmin.module.css';

type AdminOrder = Order & { customer_name: string; customer_phone: string | null; customer_email: string | null; admin_note: string | null; completed_by: string | null };
type Row = OrderListItem & { customer_name: string; branch_name: string; pickupOverdue: boolean };

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Semua status' },
  { value: 'awaiting_quote', label: 'Menunggu ongkir' },
  { value: 'awaiting_payment', label: 'Menunggu pembayaran' },
  { value: 'paid', label: 'Dibayar (perlu disiapkan)' },
  { value: 'ready', label: 'Siap diambil' },
  { value: 'overdue', label: 'Belum diambil' },
  { value: 'reserved_booking', label: 'Diambil saat booking' },
  { value: 'shipped', label: 'Dikirim' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
  { value: 'expired', label: 'Kedaluwarsa' },
  { value: 'refunded', label: 'Dikembalikan' },
];

const TZ = 'Asia/Jakarta';
const when = (iso: string) => `${shortDate(iso, TZ)} ${clock(iso, TZ)} ${tzLabel(TZ)}`;

export function ShopOrders() {
  const me = useAdmin();
  const [status, setStatus] = useState('');
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const list = usePaged<Row>(async (cursor) => {
    const p = new URLSearchParams({ limit: '20', status, branch, q: query });
    if (cursor) p.set('cursor', cursor);
    const r = await api<{ orders: Row[]; nextCursor: string | null }>(`/admin/shop/orders?${p}`);
    return { items: r.orders, nextCursor: r.nextCursor };
  }, [status, branch, query]);

  return (
    <div className={styles.stack}>
      <form
        className={local.filters}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
      >
        <Field label="Status" flush>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
        {me.admin.role === 'owner' && (
          <Field label="Cabang" flush>
            <Select value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Semua</option>
              {me.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Kode / nama" flush>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SH-…" />
        </Field>
        <Button type="submit" variant="dark" casing="normal" icon="search">
          Cari
        </Button>
      </form>
      {list.error && <Alert tone="danger">{list.error}</Alert>}
      <div id="daftar-pesanan-admin" aria-busy={!list.items || list.loadingMore}>
        {!list.items ? (
          <SkeletonList label="Memuat pesanan…" count={3} height={64} />
        ) : list.items.length === 0 ? (
          <EmptyState icon="tag" title="Tidak ada pesanan" compact />
        ) : (
          <>
            <ul className={local.orders}>
              {list.items.map((o) => (
                <li key={o.id}>
                  <button type="button" className={local.order} data-overdue={o.pickupOverdue} onClick={() => setOpenId(o.id)}>
                    <span className={local.code}>{o.code}</span>
                    <span className={local.total}>{rupiah(o.total)}</span>
                    <span className={local.meta}>
                      {o.customer_name} · {when(o.created_at)} · {o.branch_name} · {o.fulfillmentLabel}
                    </span>
                    <span className={local.meta}>{o.items.map((i) => `${i.qty}× ${i.product_name}`).join(', ')}</span>
                    <span className={local.badges}>
                      <Badge tone={ORDER_TONE[o.status]} dot>
                        {o.statusLabel}
                      </Badge>
                      {o.pickupOverdue && (
                        <Badge tone="danger" solid>
                          Belum diambil
                        </Badge>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <LoadMore shown={list.items.length} hasMore={list.hasMore} loading={list.loadingMore} onLoad={list.loadMore} noun="pesanan" />
          </>
        )}
      </div>
      {openId && <OrderSheet id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />}
    </div>
  );
}

/** Detail pesanan + aksi; juga dipakai di detail booking (produk saat booking) */
export function OrderSheet({ id, onClose, onChanged, initial }: { id: string; onClose: () => void; onChanged: () => void; initial?: AdminOrder }) {
  const [order, setOrder] = useState<AdminOrder | null>(initial ?? null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ shippingFee: '', courier: '', service: '', trackingNo: '', amount: '' });
  const [dialog, confirm] = useConfirm();
  const toast = useToast();
  useEffect(() => {
    if (initial) return;
    api<{ order: AdminOrder }>(`/admin/shop/orders/${id}`)
      .then((r) => setOrder(r.order))
      .catch((e) => setError(errorMessage(e)));
  }, [id, initial]);

  const run = async (action: OrderAction, data: Record<string, unknown> = {}, done = 'Pesanan diperbarui.') => {
    if (!order) return;
    setBusy(true);
    setError('');
    try {
      const r = await api<{ order: AdminOrder }>(`/admin/shop/orders/${order.id}/${action}`, { method: 'POST', json: data });
      setOrder(r.order);
      toast(done);
      onChanged();
    } catch (e) {
      // Nominal berbeda dari total → peringatan + konfirmasi, lalu kirim ulang
      if (e instanceof ApiClientError && e.code === 'AMOUNT_MISMATCH') {
        const d = e.details as { total: number; amount: number };
        const ok = await confirm({
          title: 'Nominal tidak sama dengan total',
          message: `Diterima ${rupiah(d.amount)}, total pesanan ${rupiah(d.total)} (${d.amount < d.total ? 'kurang' : 'lebih'} ${rupiah(Math.abs(d.amount - d.total))}). Tetap tandai Lunas? Nominal yang diterima tercatat di pembayaran.`,
          confirmLabel: 'Tetap tandai Lunas',
          cancelLabel: 'Periksa lagi',
          casing: 'normal',
        });
        setBusy(false);
        if (ok !== null) await run(action, { ...data, confirmMismatch: true }, done);
        return;
      }
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const withReason = async (action: 'cancel' | 'refund') => {
    const reason = await confirm({
      title: action === 'cancel' ? 'Batalkan pesanan?' : 'Refund pesanan?',
      message: action === 'cancel' ? 'Reservasi stok dilepas.' : 'Pembayaran ditandai dikembalikan. Stok kembali bila barang belum dikirim.',
      input: { label: 'Alasan', required: true, maxLength: 300, singleLine: true },
      confirmLabel: action === 'cancel' ? 'Batalkan pesanan' : 'Refund',
      cancelLabel: 'Kembali',
      tone: 'danger',
      casing: 'normal',
    });
    if (reason) await run(action, { reason }, action === 'cancel' ? 'Pesanan dibatalkan.' : 'Pesanan direfund.');
  };

  const o = order;
  const can = (a: OrderAction) => Boolean(o?.actions.includes(a));
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(/\D/g, '')));

  return (
    <Sheet
      open
      onClose={onClose}
      title={o ? o.code : 'Pesanan'}
      meta={
        o && (
          <>
            <Badge tone={ORDER_TONE[o.status as OrderStatus]} dot>
              {o.statusLabel}
            </Badge>{' '}
            {o.pickupOverdue && (
              <Badge tone="danger" solid>
                Belum diambil
              </Badge>
            )}
          </>
        )
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}
      {!o ? (
        !error && <SkeletonList count={2} label="Memuat pesanan…" />
      ) : (
        <div className={styles.stack}>
          <dl className={styles.dl}>
            <div>
              <dt>Pelanggan</dt>
              <dd>
                {o.customer_name}
                {o.customer_phone && (
                  <>
                    {' · '}
                    <a className={styles.link} href={waLink(o.customer_phone, `Halo ${o.customer_name}, pesanan ${o.code} di Cutless Hair Studio:`)} target="_blank" rel="noopener noreferrer">
                      {o.customer_phone}
                    </a>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>Cabang · cara terima</dt>
              <dd>
                {o.branch.name} · {o.fulfillmentLabel}
              </dd>
            </div>
            <div>
              <dt>Produk</dt>
              <dd>
                {o.items.map((i) => (
                  <span key={i.id} className={styles.cellSub}>
                    {i.qty}× {i.product_name} ({i.variant_name}) · {rupiah(i.line_total)}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>
                {rupiah(o.total)}{' '}
                <small>
                  (subtotal {rupiah(o.subtotal)}
                  {o.shipping_fee !== null && o.fulfillment.startsWith('ship') && ` + ongkir ${rupiah(o.shipping_fee)}`}
                  {o.unique_code > 0 && ` + kode unik ${o.unique_code}`})
                </small>
              </dd>
            </div>
            <div>
              <dt>Pembayaran</dt>
              <dd>
                {o.payment_method === 'cashier' ? 'Kasir (saat booking)' : o.payment_method === 'qris' ? 'QRIS' : 'Transfer'}
                {o.paid_at && ` · lunas ${when(o.paid_at)}`}
                {o.payment_due_at && o.status === 'awaiting_payment' && ` · batas ${when(o.payment_due_at)}`}
              </dd>
            </div>
            {o.address && (
              <div>
                <dt>Kirim ke</dt>
                <dd>
                  {o.recipient_name} · {o.recipient_phone}
                  <span className={styles.cellSub}>
                    {o.address}
                    {o.region_label && ` · ${o.region_label}`}
                  </span>
                  {o.tracking_no && <span className={styles.cellSub}>Resi: {o.tracking_no}</span>}
                </dd>
              </div>
            )}
            {o.pickup_due_at && o.status === 'ready' && (
              <div>
                <dt>Batas ambil</dt>
                <dd>{when(o.pickup_due_at)}</dd>
              </div>
            )}
            {o.customer_note && (
              <div>
                <dt>Catatan pelanggan</dt>
                <dd>{o.customer_note}</dd>
              </div>
            )}
            {o.cancel_reason && (
              <div>
                <dt>Alasan batal</dt>
                <dd>{o.cancel_reason}</dd>
              </div>
            )}
          </dl>

          {can('quote') && (
            <div className={styles.subPanel}>
              <h3 className={styles.sectionLabel}>Isi ongkir</h3>
              <div className={styles.inlineFields}>
                <Field label="Ongkir (Rp)" flush>
                  <Input inputMode="numeric" value={form.shippingFee} onChange={(e) => setForm({ ...form, shippingFee: e.target.value })} />
                </Field>
                <Field label="Kurir" flush>
                  <Input value={form.courier} onChange={(e) => setForm({ ...form, courier: e.target.value })} placeholder="JNE" />
                </Field>
                <Field label="Layanan" flush>
                  <Input value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} placeholder="REG" />
                </Field>
              </div>
              <Button variant="dark" casing="normal" disabled={busy || num(form.shippingFee) === undefined} onClick={() => run('quote', { shippingFee: num(form.shippingFee), courier: form.courier || null, service: form.service || null }, 'Ongkir tersimpan. Pelanggan bisa membayar.')}>
                Simpan ongkir
              </Button>
            </div>
          )}

          {can('paid') && (
            <div className={styles.subPanel}>
              <h3 className={styles.sectionLabel}>Tandai Lunas</h3>
              <Field label="Nominal diterima (Rp)" hint={`Total: ${rupiah(o.total)}. Kosongkan bila sama persis.`}>
                <Input inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={String(o.total)} />
              </Field>
              <Button variant="dark" casing="normal" icon="check" disabled={busy} onClick={() => run('paid', { amount: num(form.amount) ?? o.total }, 'Pesanan ditandai Lunas.')}>
                Tandai Lunas
              </Button>
            </div>
          )}

          {can('ship') && (
            <div className={styles.subPanel}>
              <h3 className={styles.sectionLabel}>Kirim</h3>
              <div className={styles.inlineFields}>
                <Field label="Nomor resi" flush>
                  <Input value={form.trackingNo} onChange={(e) => setForm({ ...form, trackingNo: e.target.value })} />
                </Field>
                <Field label="Kurir" flush>
                  <Input value={form.courier} onChange={(e) => setForm({ ...form, courier: e.target.value })} placeholder={o.courier ?? 'JNE'} />
                </Field>
              </div>
              <Button variant="dark" casing="normal" disabled={busy || !form.trackingNo.trim()} onClick={() => run('ship', { trackingNo: form.trackingNo.trim(), courier: form.courier || null }, 'Pesanan dikirim. Stok berkurang.')}>
                Tandai dikirim
              </Button>
            </div>
          )}

          <div className={styles.formActions}>
            {can('ready') && (
              <Button variant="dark" casing="normal" disabled={busy} onClick={() => run('ready', {}, 'Pesanan siap diambil.')}>
                Siap diambil
              </Button>
            )}
            {can('complete') && (
              <Button variant="dark" casing="normal" icon="check" disabled={busy} onClick={() => run('complete', {}, 'Pesanan selesai.')}>
                {o.status === 'reserved_booking' ? 'Diambil & dibayar di kasir' : o.status === 'ready' ? 'Sudah diambil' : 'Tandai selesai'}
              </Button>
            )}
            {can('cancel') && (
              <Button variant="outline-danger" casing="normal" disabled={busy} onClick={() => withReason('cancel')}>
                Batalkan
              </Button>
            )}
            {can('refund') && (
              <Button variant="outline-danger" casing="normal" disabled={busy} onClick={() => withReason('refund')}>
                Refund
              </Button>
            )}
          </div>
        </div>
      )}
      {dialog}
    </Sheet>
  );
}

import { useEffect, useState } from 'react';
import { api, ApiClientError, errorMessage } from '@/app/api';
import { clock, longDate, rupiah, shortDate, tzLabel, waLink } from '@/app/format';
import { usePaged } from '@/app/usePaged';
import { asset } from '@/lib/asset';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { LoadMore } from '@/components/ui/LoadMore';
import { useConfirm } from '@/components/ui/useConfirm';
import { useToast } from '@/components/ui/toastContext';
import { Page, Loading } from '@/booking/Page';
import { loginUrl } from '@/booking/hooks';
import { Thumb } from '../parts';
import { ORDER_TONE, type Order, type OrderListItem } from '../types';
import bookingStyles from '@/booking/booking.module.css';
import styles from '../shop.module.css';

const TZ = 'Asia/Jakarta';
const when = (iso: string, tz = TZ) => `${shortDate(iso, tz)} · ${clock(iso, tz)} ${tzLabel(tz)}`;

/** /pesanan: daftar pesanan toko pelanggan (terbaru dulu) */
export function MyOrders() {
  const page = usePaged<OrderListItem>(async (cursor) => {
    try {
      const r = await api<{ orders: OrderListItem[]; nextCursor: string | null }>(`/me/orders${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
      return { items: r.orders, nextCursor: r.nextCursor };
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) window.location.replace(loginUrl());
      throw e;
    }
  }, []);
  return (
    <Page
      id="pesanan"
      kicker="Akun"
      title="Pesanan saya"
      actions={
        <>
          <Button href="/shop/" variant="dark" icon="tag" size="sm">
            Belanja
          </Button>
          <Button href="/booking/saya" variant="outline-dark" icon="calendar" size="sm">
            Booking saya
          </Button>
        </>
      }
    >
      {page.error && <Alert tone="danger">{page.error}</Alert>}
      <div id="daftar-pesanan" aria-busy={!page.items || page.loadingMore}>
        {!page.items ? (
          <Loading count={2} label="Memuat pesanan…" />
        ) : page.items.length === 0 ? (
          <EmptyState icon="tag" title="Belum ada pesanan" action={<Button href="/shop/" variant="dark" size="sm" icon="tag">Ke toko</Button>}>
            Pomade, clay, sampai hair tonic pilihan hairstylist kami.
          </EmptyState>
        ) : (
          <>
            <ul className={bookingStyles.list}>
              {page.items.map((o) => (
                <li key={o.id}>
                  <Card tone="light" padding="md">
                    <div className={styles.orderHead}>
                      <a href={`/pesanan/${o.id}`} className={styles.orderCode}>
                        {o.code}
                      </a>
                      <Badge tone={ORDER_TONE[o.status]} dot>
                        {o.statusLabel}
                      </Badge>
                    </div>
                    <p className={styles.orderMeta}>
                      {when(o.created_at)} · {o.fulfillmentLabel} · <strong>{rupiah(o.total)}</strong>
                    </p>
                    <p className={styles.orderItems}>{o.items.map((i) => `${i.qty}× ${i.product_name}`).join(', ')}</p>
                    <div className={bookingStyles.cardLink}>
                      <Button href={`/pesanan/${o.id}`} variant="outline-dark" size="sm" iconEnd="arrow">
                        {o.status === 'awaiting_payment' ? 'Lihat cara bayar' : 'Detail'}
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
            <LoadMore shown={page.items.length} hasMore={page.hasMore} loading={page.loadingMore} onLoad={page.loadMore} noun="pesanan" casing="upper" />
          </>
        )}
      </div>
    </Page>
  );
}

/** /pesanan/:id */
export function OrderDetail({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmNode, confirm] = useConfirm();
  const toast = useToast();
  const params = new URLSearchParams(window.location.search);

  const load = () =>
    api<{ order: Order }>(`/me/orders/${encodeURIComponent(id)}`)
      .then((r) => setOrder(r.order))
      .catch((e) => {
        if (e instanceof ApiClientError && e.status === 401) window.location.replace(loginUrl());
        else setError(errorMessage(e));
      });
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function act(action: 'cancel' | 'received') {
    if (!order) return;
    const ok = await confirm(
      action === 'cancel'
        ? { title: 'Batalkan pesanan?', message: 'Stok yang kamu pesan akan dilepas untuk pembeli lain.', confirmLabel: 'Batalkan pesanan', cancelLabel: 'Kembali', tone: 'danger', casing: 'upper' }
        : { title: 'Pesanan sudah diterima?', message: 'Pastikan paket sudah sampai dan isinya sesuai.', confirmLabel: 'Ya, sudah diterima', cancelLabel: 'Belum', casing: 'upper' },
    );
    if (ok === null) return;
    setBusy(true);
    try {
      const r = await api<{ order: Order }>(`/me/orders/${order.id}/${action}`, { method: 'POST' });
      setOrder(r.order);
      toast(action === 'cancel' ? 'Pesanan dibatalkan.' : 'Terima kasih! Pesanan selesai.');
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      id="detail-pesanan"
      kicker="Pesanan"
      title={order ? order.code : 'Pesanan'}
      actions={
        <Button href="/pesanan" variant="outline-dark" size="sm">
          Semua pesanan
        </Button>
      }
    >
      {error ? (
        <Alert tone="danger">{error}</Alert>
      ) : !order ? (
        <Loading count={2} />
      ) : (
        <div className={bookingStyles.stack} id="pesanan-detail" data-status={order.status}>
          {params.get('baru') && <Alert tone="success" title="Pesanan dibuat">Kode pesananmu {order.code}. Simpan halaman ini untuk cek status.</Alert>}
          {params.get('manual') && <Alert tone="info">Ongkir otomatis sedang tidak tersedia, jadi ongkir akan dikonfirmasi admin.</Alert>}
          <div className={styles.orderHead}>
            <Badge tone={ORDER_TONE[order.status]} dot>
              {order.statusLabel}
            </Badge>
            <span className={styles.orderMeta}>
              {order.branch.name} · {order.fulfillmentLabel}
            </span>
          </div>
          <StatusNote order={order} />
          {order.payment && <PaymentBox order={order} />}

          <Card tone="light" padding="md">
            <ul className={styles.lines}>
              {order.items.map((l) => (
                <li key={l.id} className={styles.line}>
                  <Thumb className={styles.lineImg} path={l.image} />
                  <div className={styles.lineMain}>
                    <span className={styles.lineName}>
                      {l.qty}× {l.product_name}
                    </span>
                    <span className={styles.lineMeta}>
                      {l.variant_name} · {rupiah(l.line_total)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <dl className={styles.totals}>
              <div>
                <dt>Subtotal</dt>
                <dd>{rupiah(order.subtotal)}</dd>
              </div>
              {order.fulfillment.startsWith('ship') && (
                <div>
                  <dt>Ongkir{order.courier ? ` (${order.courier}${order.courier_service ? ` ${order.courier_service}` : ''})` : ''}</dt>
                  <dd>{order.shipping_fee === null ? 'Menunggu admin' : rupiah(order.shipping_fee)}</dd>
                </div>
              )}
              {order.unique_code > 0 && (
                <div>
                  <dt>Kode unik</dt>
                  <dd>{rupiah(order.unique_code)}</dd>
                </div>
              )}
              <div className={styles.grand}>
                <dt>Total</dt>
                <dd>{rupiah(order.total)}</dd>
              </div>
            </dl>
          </Card>

          {order.address && (
            <Card tone="light" padding="md">
              <dl className={bookingStyles.dl}>
                <div>
                  <dt>Penerima</dt>
                  <dd>
                    {order.recipient_name} · {order.recipient_phone}
                  </dd>
                </div>
                <div>
                  <dt>Alamat</dt>
                  <dd>
                    {order.address}
                    {order.region_label && <small> · {order.region_label}</small>}
                  </dd>
                </div>
                {order.tracking_no && (
                  <div>
                    <dt>Nomor resi</dt>
                    <dd>{order.tracking_no}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}

          <Timeline order={order} />

          <div className={bookingStyles.actionsGrid}>
            {order.actions.includes('complete') && (
              <Button variant="dark" icon="check" block disabled={busy} onClick={() => act('received')}>
                Pesanan diterima
              </Button>
            )}
            <Button href={waLink(order.branch.whatsapp, `Halo Cutless Hair Studio cabang ${order.branch.name}, saya mau tanya pesanan ${order.code}.`)} external variant="whatsapp" icon="whatsapp" block>
              Tanya cabang
            </Button>
            {order.actions.includes('cancel') && (
              <Button variant="outline-dark" block disabled={busy} onClick={() => act('cancel')}>
                Batalkan pesanan
              </Button>
            )}
          </div>
        </div>
      )}
      {confirmNode}
    </Page>
  );
}

function StatusNote({ order: o }: { order: Order }) {
  const tz = o.branch.timezone;
  switch (o.status) {
    case 'awaiting_quote':
      return <Alert tone="info">Admin cabang sedang menghitung ongkir. Instruksi bayar muncul di halaman ini setelah ongkir diisi.</Alert>;
    case 'reserved_booking':
      return <Alert tone="info">Produk disiapkan untuk booking-mu dan dibayar di kasir saat datang. Booking batal → pesanan ikut batal.</Alert>;
    case 'paid':
      return <Alert tone="success">Pembayaran diterima. {o.fulfillment === 'pickup' ? 'Kami kabari saat pesanan siap diambil.' : 'Pesanan segera dikirim.'}</Alert>;
    case 'ready':
      return (
        <Alert tone={o.pickupOverdue ? 'warning' : 'success'} title="Siap diambil">
          Ambil di {o.branch.name}
          {o.pickup_due_at && ` sebelum ${longDate(o.pickup_due_at, tz)}`}. Tunjukkan kode {o.code} ke kasir.
        </Alert>
      );
    case 'shipped':
      return <Alert tone="info">Pesanan dikirim{o.tracking_no ? ` dengan resi ${o.tracking_no}` : ''}. Tekan "Pesanan diterima" setelah paket sampai (otomatis selesai 7 hari setelah dikirim).</Alert>;
    case 'cancelled':
    case 'expired':
    case 'refunded':
      return <Alert tone="neutral">{o.cancel_reason ?? o.statusLabel}</Alert>;
    default:
      return null;
  }
}

/** Instruksi bayar: nominal PERSIS (termasuk kode unik), rekening / QRIS, batas waktu, kirim bukti via WhatsApp */
function PaymentBox({ order: o }: { order: Order }) {
  const p = o.payment!;
  const toast = useToast();
  const tz = o.branch.timezone;
  const copy = (text: string, label: string) =>
    navigator.clipboard?.writeText(text).then(
      () => toast(`${label} disalin.`),
      () => undefined,
    );
  const proof = waLink(p.whatsapp, `Halo Cutless Hair Studio cabang ${o.branch.name}, saya sudah membayar pesanan ${o.code} sebesar ${rupiah(p.amount)}. Berikut bukti transfernya.`);
  return (
    <section className={styles.payBox} aria-labelledby="bayar-title" id="instruksi-bayar">
      <h2 id="bayar-title" className={bookingStyles.h2}>
        {p.method === 'qris' ? 'Bayar dengan QRIS' : 'Transfer bank'}
      </h2>
      <div>
        <p className={bookingStyles.hint}>Nominal (harus persis)</p>
        <p className={styles.amount} data-testid="nominal-bayar">
          {rupiah(p.amount)}{' '}
          <Button variant="outline-dark" size="sm" onClick={() => copy(String(p.amount), 'Nominal')}>
            Salin
          </Button>
        </p>
        {p.uniqueCode > 0 && <p className={bookingStyles.hint}>Termasuk kode unik {rupiah(p.uniqueCode)} agar pembayaranmu cepat dicocokkan. Mohon jangan dibulatkan.</p>}
      </div>
      {p.method === 'qris' && p.qrisImage ? (
        <div>
          <img className={styles.qris} src={asset(p.qrisImage)} alt={`QRIS ${o.branch.name}`} width={256} height={256} />
          <p className={bookingStyles.hint}>Scan, lalu ketik nominal persis {rupiah(p.amount)} di aplikasi pembayaranmu.</p>
        </div>
      ) : p.bank ? (
        <dl className={bookingStyles.dl}>
          <div>
            <dt>Bank</dt>
            <dd>{p.bank.name}</dd>
          </div>
          <div>
            <dt>Nomor rekening</dt>
            <dd>
              {p.bank.accountNo}{' '}
              <button type="button" className={bookingStyles.inlineBtn} onClick={() => copy(p.bank!.accountNo, 'Nomor rekening')}>
                Salin
              </button>
            </dd>
          </div>
          {p.bank.accountName && (
            <div>
              <dt>Atas nama</dt>
              <dd>{p.bank.accountName}</dd>
            </div>
          )}
        </dl>
      ) : (
        <Alert tone="info">Rekening cabang belum diisi. Tanyakan lewat WhatsApp cabang.</Alert>
      )}
      {p.note && <p className={bookingStyles.hint}>{p.note}</p>}
      {p.dueAt && (
        <p className={bookingStyles.hint}>
          Bayar sebelum <strong>{when(p.dueAt, tz)}</strong>. Lewat dari itu pesanan batal otomatis.
        </p>
      )}
      <Button href={proof} external variant="whatsapp" icon="whatsapp" block>
        Kirim bukti bayar
      </Button>
    </section>
  );
}

function Timeline({ order: o }: { order: Order }) {
  const tz = o.branch.timezone;
  const steps: { label: string; at: string | null }[] = [
    { label: 'Pesanan dibuat', at: o.created_at },
    ...(o.fulfillment === 'with_booking' ? [] : [{ label: 'Dibayar', at: o.paid_at }]),
    ...(o.fulfillment === 'pickup' ? [{ label: 'Siap diambil', at: o.ready_at }] : []),
    ...(o.fulfillment.startsWith('ship') ? [{ label: 'Dikirim', at: o.shipped_at }] : []),
    { label: 'Selesai', at: o.completed_at },
  ];
  return (
    <ol className={styles.timeline} aria-label="Riwayat status">
      {steps.map((s) => (
        <li key={s.label} data-done={Boolean(s.at)}>
          <span>
            {s.label}
            {s.at && ` · ${when(s.at, tz)}`}
          </span>
        </li>
      ))}
    </ol>
  );
}

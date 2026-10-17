import { useState } from 'react';
import { api, errorMessage } from '@/app/api';
import { usePaged } from '@/app/usePaged';
import { clock, formatPhone, longDate, waLink } from '@/app/format';
import { MAX_NO_SHOW } from '@shared/booking';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert, EmptyState, SkeletonList } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Field';
import { LoadMore } from '@/components/ui/LoadMore';
import { Sheet } from '@/components/ui/Overlay';
import { PageHeader } from '@/components/ui/PageHeader';
import { useConfirm } from '@/components/ui/useConfirm';
import { useToast } from '@/components/ui/toastContext';
import { useAdmin, type AdminBooking } from './context';
import styles from './admin.module.css';

interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: 'active' | 'blocked';
  no_show_count: number;
  is_guest: number;
  created_at: string;
  last_login_at: string | null;
  bookings?: number;
  has_password?: number;
}

interface CustomerDetail {
  customer: CustomerRow;
  bookings: AdminBooking[];
  bookingsNextCursor?: string | null;
  bookingsTotal?: number;
}

/** Pelanggan: cari, riwayat & jumlah no-show, blokir/buka blokir, reset password (bila fitur aktif) */
export function Customers() {
  const me = useAdmin();
  const toast = useToast();
  const [q, setQ] = useState('');
  // Kata kunci yang sudah dicari (null = belum mencari)
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [sheetMsg, setSheetMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [dialog, confirm] = useConfirm();

  const list = usePaged<CustomerRow>(
    async (cursor) => {
      const params = new URLSearchParams({ q: submitted ?? '' });
      if (cursor) params.set('cursor', cursor);
      const r = await api<{ customers: CustomerRow[]; nextCursor: string | null; total?: number }>(`/admin/customers?${params}`);
      return { items: r.customers, nextCursor: r.nextCursor, total: r.total };
    },
    [submitted],
    submitted !== null,
  );
  const search = () => (submitted === q.trim() ? list.reload() : setSubmitted(q.trim()));

  const open = async (id: string) => {
    try {
      setDetail(await api(`/admin/customers/${id}`));
      setSheetMsg(null);
    } catch (e) {
      toast(errorMessage(e), 'danger');
    }
  };
  const moreBookings = async () => {
    if (!detail?.bookingsNextCursor) return;
    setMoreBusy(true);
    try {
      const r = await api<{ bookings: AdminBooking[]; nextCursor: string | null }>(
        `/admin/customers/${detail.customer.id}/bookings?cursor=${encodeURIComponent(detail.bookingsNextCursor)}`,
      );
      setDetail((d) => d && { ...d, bookings: [...d.bookings, ...r.bookings], bookingsNextCursor: r.nextCursor });
    } catch (e) {
      setSheetMsg({ tone: 'danger', text: errorMessage(e) });
    } finally {
      setMoreBusy(false);
    }
  };
  const act = async (action: 'block' | 'unblock') => {
    if (!detail) return;
    if (action === 'block') {
      const ok = await confirm({
        title: `Blokir ${detail.customer.name || 'pelanggan ini'}?`,
        message: 'Pelanggan tidak bisa booking online sampai blokir dibuka. Booking yang sudah ada tidak dibatalkan otomatis.',
        confirmLabel: 'Ya, blokir',
        cancelLabel: 'Kembali',
      });
      if (ok === null) return;
    }
    try {
      await api(`/admin/customers/${detail.customer.id}/${action}`, { method: 'POST' });
      setSheetMsg({ tone: 'success', text: action === 'block' ? 'Akun diblokir.' : 'Blokir dibuka & hitungan tidak datang direset.' });
      void open(detail.customer.id);
      if (list.items) list.reload();
    } catch (e) {
      setSheetMsg({ tone: 'danger', text: errorMessage(e) });
    }
  };
  const resetPassword = async () => {
    if (!detail) return;
    const password = await confirm({
      title: 'Reset password pelanggan',
      message: 'Semua sesi login pelanggan akan dikeluarkan. Sampaikan password baru lewat WhatsApp.',
      input: { label: 'Password baru', required: true, minLength: 8, maxLength: 100, singleLine: true, hint: 'Minimal 8 karakter.' },
      confirmLabel: 'Reset password',
      cancelLabel: 'Batal',
      tone: 'default',
    });
    if (!password) return;
    try {
      await api(`/admin/customers/${detail.customer.id}/password`, { method: 'POST', json: { password } });
      setSheetMsg({ tone: 'success', text: 'Password direset. Semua sesi login pelanggan dikeluarkan.' });
    } catch (e) {
      setSheetMsg({ tone: 'danger', text: errorMessage(e) });
    }
  };

  const c = detail?.customer;
  const blocked = c ? c.status === 'blocked' || c.no_show_count >= MAX_NO_SHOW : false;

  return (
    <section aria-labelledby="cust-title">
      <PageHeader titleId="cust-title" title="Pelanggan" description="Cari pelanggan untuk melihat riwayat booking, jumlah tidak datang, dan status akun." />
      <form
        className={styles.searchRow}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <Field label="Nama / nomor WhatsApp / email" flush>
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="mis. Budi atau 0812…" />
        </Field>
        <Button type="submit" variant="dark" casing="normal" icon="search" disabled={submitted !== null && !list.items}>
          Cari
        </Button>
      </form>
      {list.error && <Alert tone="danger">{list.error}</Alert>}

      {submitted === null ? (
        <EmptyState icon="search" title="Cari pelanggan" action={<Button variant="outline-dark" casing="normal" size="sm" onClick={() => setSubmitted('')}>Tampilkan pelanggan terbaru</Button>}>
          Ketik nama atau nomor lalu tekan Cari. Kosongkan untuk melihat pelanggan terbaru.
        </EmptyState>
      ) : !list.items ? (
        <SkeletonList label="Mencari pelanggan…" count={3} height={56} />
      ) : list.items.length === 0 ? (
        <EmptyState icon="user" title="Tidak ada pelanggan yang cocok">
          Coba nama lain atau sebagian nomor WhatsApp.
        </EmptyState>
      ) : (
        <div className={styles.tableWrap} data-stack>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nama</th>
                <th>WhatsApp</th>
                <th className={styles.num}>Booking</th>
                <th className={styles.num}>Tidak datang</th>
                <th>Status</th>
                <th>
                  <span className="visually-hidden">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((r) => (
                <tr key={r.id}>
                  <td data-label="Nama">
                    <span className={styles.cellMain}>{r.name || '(tanpa nama)'}</span>
                    {r.is_guest ? <span className={styles.cellSub}>Tamu</span> : null}
                  </td>
                  <td data-label="WhatsApp">{r.phone ? formatPhone(r.phone) : '-'}</td>
                  <td data-label="Booking" className={styles.num}>
                    {r.bookings}
                  </td>
                  <td data-label="Tidak datang" className={styles.num}>
                    {r.no_show_count}
                  </td>
                  <td data-label="Status">{r.status === 'blocked' ? <Badge tone="danger">Diblokir</Badge> : <Badge tone="success">Aktif</Badge>}</td>
                  <td data-label="">
                    <Button variant="outline-dark" casing="normal" size="sm" onClick={() => open(r.id)}>
                      Detail
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.items && list.items.length > 0 && (
        <LoadMore shown={list.items.length} total={list.total} hasMore={list.hasMore} loading={list.loadingMore} onLoad={list.loadMore} noun="pelanggan" />
      )}

      {detail && c && (
        <Sheet
          open
          onClose={() => setDetail(null)}
          title={`${c.name || '(tanpa nama)'}${c.is_guest ? ' (tamu)' : ''}`}
          meta={blocked ? <Badge tone="danger">Diblokir</Badge> : <Badge tone="success">Aktif</Badge>}
        >
          <dl className={styles.dl}>
            <div>
              <dt>WhatsApp</dt>
              <dd>
                {c.phone ? (
                  <a className={styles.link} href={waLink(c.phone, `Halo ${c.name}, kami dari Cutless Hair Studio.`)} target="_blank" rel="noopener noreferrer">
                    {formatPhone(c.phone)}
                  </a>
                ) : (
                  '-'
                )}
              </dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{c.email ?? '-'}</dd>
            </div>
            <div>
              <dt>Tidak datang</dt>
              <dd>
                {c.no_show_count}× {c.no_show_count >= MAX_NO_SHOW ? '(otomatis tidak bisa booking online)' : ''}
              </dd>
            </div>
            <div>
              <dt>Terdaftar</dt>
              <dd>{longDate(c.created_at, 'Asia/Jakarta')}</dd>
            </div>
          </dl>
          {sheetMsg && (
            <Alert tone={sheetMsg.tone} role={sheetMsg.tone === 'success' ? 'status' : 'alert'}>
              {sheetMsg.text}
            </Alert>
          )}
          <div className={styles.actionBar}>
            {blocked ? (
              <Button variant="dark" casing="normal" onClick={() => act('unblock')}>
                Buka blokir
              </Button>
            ) : (
              <Button variant="outline-danger" casing="normal" onClick={() => act('block')}>
                Blokir
              </Button>
            )}
            {me.features.phonePassword && !c.is_guest && (
              <Button variant="outline-dark" casing="normal" onClick={resetPassword}>
                Reset password
              </Button>
            )}
          </div>
          <h3 className={styles.h2}>Riwayat booking ({detail.bookingsTotal ?? detail.bookings.length})</h3>
          {detail.bookings.length === 0 ? (
            <EmptyState icon="calendar" title="Belum ada booking" compact />
          ) : (
            <ul className={styles.hits}>
              {detail.bookings.map((b) => (
                <li key={b.id} className={styles.historyItem}>
                  <span className={styles.cardTop}>
                    <span className={styles.cardTime}>
                      {longDate(b.start_at, b.timezone)} · {clock(b.start_at, b.timezone)}
                    </span>
                    <StatusBadge status={b.status} />
                  </span>
                  <span className={styles.hitMeta}>
                    {b.service_name_snapshot} · {b.barber_name} · {b.branch_name}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <LoadMore
            shown={detail.bookings.length}
            total={detail.bookingsTotal}
            hasMore={Boolean(detail.bookingsNextCursor)}
            loading={moreBusy}
            onLoad={moreBookings}
            noun="booking"
          />
          {dialog}
        </Sheet>
      )}
    </section>
  );
}

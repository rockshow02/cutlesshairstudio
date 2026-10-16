import { useState } from 'react';
import { api, errorMessage } from '@/app/api';
import { clock, formatPhone, longDate, waLink } from '@/app/format';
import { STATUS_LABEL } from '@shared/booking';
import { MAX_NO_SHOW } from '@shared/booking';
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

/** Pelanggan: cari, riwayat & jumlah no-show, blokir/buka blokir, reset password (bila fitur aktif) */
export function Customers() {
  const me = useAdmin();
  const [q, setQ] = useState('');
  const [list, setList] = useState<CustomerRow[] | null>(null);
  const [detail, setDetail] = useState<{ customer: CustomerRow; bookings: AdminBooking[] } | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const search = async () => {
    setMsg(null);
    try {
      const r = await api<{ customers: CustomerRow[] }>(`/admin/customers?q=${encodeURIComponent(q.trim())}`);
      setList(r.customers);
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  };
  const open = async (id: string) => {
    try {
      setDetail(await api(`/admin/customers/${id}`));
      setMsg(null);
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  };
  const act = async (action: 'block' | 'unblock') => {
    if (!detail) return;
    if (action === 'block' && !window.confirm(`Blokir ${detail.customer.name}? Pelanggan tidak bisa booking online sampai dibuka.`)) return;
    try {
      await api(`/admin/customers/${detail.customer.id}/${action}`, { method: 'POST' });
      setMsg({ tone: 'ok', text: action === 'block' ? 'Akun diblokir.' : 'Blokir dibuka & hitungan tidak datang direset.' });
      void open(detail.customer.id);
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  };
  const resetPassword = async () => {
    if (!detail) return;
    const password = window.prompt('Password baru untuk pelanggan (min. 8 karakter). Sampaikan lewat WhatsApp:');
    if (!password) return;
    try {
      await api(`/admin/customers/${detail.customer.id}/password`, { method: 'POST', json: { password } });
      setMsg({ tone: 'ok', text: 'Password direset. Semua sesi login pelanggan dikeluarkan.' });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  };

  return (
    <section aria-labelledby="cust-title">
      <h1 id="cust-title" className={styles.h1}>
        Pelanggan
      </h1>
      <form className={styles.toolbar} onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <label className={styles.control}>
          Nama / nomor WhatsApp / email
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="mis. Budi atau 0812…" />
        </label>
        <button type="submit" className={styles.btn}>Cari</button>
      </form>
      {msg && (
        <p className={styles.alert} data-tone={msg.tone} role={msg.tone === 'error' ? 'alert' : 'status'}>
          {msg.text}
        </p>
      )}
      {detail ? (
        <div className={styles.panel}>
          <div className={styles.row} style={{ justifyContent: 'space-between' }}>
            <h2 className={styles.h2} style={{ margin: 0 }}>
              {detail.customer.name || '(tanpa nama)'} {detail.customer.is_guest ? '(tamu)' : ''}
            </h2>
            <button type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} onClick={() => setDetail(null)}>Kembali</button>
          </div>
          <dl className={styles.dl}>
            <div><dt>WhatsApp</dt><dd>{detail.customer.phone ? <a className={styles.link} href={waLink(detail.customer.phone, `Halo ${detail.customer.name}, kami dari Cutless Hair Studio.`)} target="_blank" rel="noopener noreferrer">{formatPhone(detail.customer.phone)}</a> : '-'}</dd></div>
            <div><dt>Email</dt><dd>{detail.customer.email ?? '-'}</dd></div>
            <div><dt>Status</dt><dd>{detail.customer.status === 'blocked' ? 'Diblokir' : 'Aktif'}</dd></div>
            <div><dt>Tidak datang</dt><dd>{detail.customer.no_show_count}× {detail.customer.no_show_count >= MAX_NO_SHOW ? '(otomatis tidak bisa booking online)' : ''}</dd></div>
            <div><dt>Terdaftar</dt><dd>{longDate(detail.customer.created_at, 'Asia/Jakarta')}</dd></div>
          </dl>
          <div className={styles.row}>
            {detail.customer.status === 'blocked' || detail.customer.no_show_count >= MAX_NO_SHOW ? (
              <button type="button" className={styles.btn} onClick={() => act('unblock')}>Buka blokir</button>
            ) : (
              <button type="button" className={styles.btnDanger} onClick={() => act('block')}>Blokir</button>
            )}
            {me.features.phonePassword && !detail.customer.is_guest && (
              <button type="button" className={styles.btnGhost} onClick={resetPassword}>Reset password</button>
            )}
          </div>
          <h3 className={styles.h2}>Riwayat booking ({detail.bookings.length})</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Jadwal</th><th>Cabang</th><th>Layanan</th><th>Hairstylist</th><th>Status</th></tr></thead>
              <tbody>
                {detail.bookings.map((b) => (
                  <tr key={b.id}>
                    <td>{longDate(b.start_at, b.timezone)} {clock(b.start_at, b.timezone)}</td>
                    <td>{b.branch_name}</td>
                    <td>{b.service_name_snapshot}</td>
                    <td>{b.barber_name}</td>
                    <td><span className={styles.status} data-status={b.status}>{STATUS_LABEL[b.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : list === null ? (
        <p className={styles.muted}>Ketik nama atau nomor lalu tekan Cari (kosongkan untuk pelanggan terbaru).</p>
      ) : list.length === 0 ? (
        <p className={styles.muted}>Tidak ada pelanggan yang cocok.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Nama</th><th>WhatsApp</th><th>Booking</th><th>Tidak datang</th><th>Status</th><th /></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>{c.name || '(tanpa nama)'} {c.is_guest ? '· tamu' : ''}</td>
                  <td>{c.phone ? formatPhone(c.phone) : '-'}</td>
                  <td>{c.bookings}</td>
                  <td>{c.no_show_count}</td>
                  <td>{c.status === 'blocked' ? 'Diblokir' : 'Aktif'}</td>
                  <td><button type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} onClick={() => open(c.id)}>Detail</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

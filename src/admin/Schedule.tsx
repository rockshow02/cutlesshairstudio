import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, errorMessage } from '@/app/api';
import { clock, formatPhone, rupiah, shortDate } from '@/app/format';
import { STATUS_LABEL, type BookingStatus } from '@shared/booking';
import { addDays, localDate } from '@shared/time';
import { BookingDetail } from './BookingDetail';
import { useAdmin, type AdminBooking } from './context';
import styles from './admin.module.css';

const REFRESH_MS = 30_000;
const todayWib = () => localDate(Date.now(), 'Asia/Jakarta');

/** Jadwal: harian (kolom per hairstylist) & mingguan; auto-refresh 30 detik + badge booking baru */
export function Schedule() {
  const me = useAdmin();
  const [branchId, setBranchId] = useState<number | undefined>(me.admin.branch_id ?? me.branches[0]?.id);
  const [date, setDate] = useState(todayWib);
  const [view, setView] = useState<'day' | 'week'>('day');
  const [barber, setBarber] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [bookings, setBookings] = useState<AdminBooking[] | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<string[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const branch = me.branches.find((b) => b.id === branchId);
  const tz = branch?.timezone ?? 'Asia/Jakarta';
  const to = view === 'day' ? date : addDays(date, 6);

  const load = useCallback(async () => {
    const q = new URLSearchParams({ from: date, to });
    if (branchId) q.set('branch', String(branchId));
    if (barber) q.set('barber', barber);
    if (status) q.set('status', status);
    try {
      const r = await api<{ bookings: AdminBooking[] }>(`/admin/bookings?${q}`);
      setBookings(r.bookings);
      setError('');
      // Booking baru sejak halaman dibuka (badge + judul tab)
      if (seen.current) {
        const fresh = r.bookings.filter((b) => !seen.current!.has(b.id) && (b.status === 'pending' || b.status === 'confirmed'));
        if (fresh.length) setNewIds((ids) => [...new Set([...ids, ...fresh.map((b) => b.id)])]);
      } else seen.current = new Set();
      r.bookings.forEach((b) => seen.current!.add(b.id));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [date, to, branchId, barber, status]);

  useEffect(() => {
    seen.current = null;
    setBookings(null);
    void load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    document.title = newIds.length ? `(${newIds.length}) Booking baru · Admin Cutless` : 'Dashboard Admin · Cutless';
  }, [newIds]);

  const visible = useMemo(
    () => (bookings ?? []).filter((b) => (view === 'day' ? localDate(Date.parse(b.start_at), b.timezone) === date : true)),
    [bookings, view, date],
  );
  const barbers = me.barbers.filter((b) => (!branchId || b.branch_id === branchId) && b.is_active);
  const open = bookings?.find((b) => b.id === openId) ?? null;

  return (
    <section aria-labelledby="jadwal-title">
      <h1 id="jadwal-title" className={styles.h1}>
        Jadwal {branch ? `· ${branch.name}` : ''}
      </h1>
      <div className={styles.toolbar}>
        {me.admin.role === 'owner' && (
          <label className={styles.control}>
            Cabang
            <select value={branchId ?? ''} onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : undefined)}>
              {me.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className={styles.control}>
          <label htmlFor="jadwal-tanggal">Tanggal</label>
          <span style={{ display: 'flex', gap: 4 }}>
            <button type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} aria-label={view === 'day' ? 'Hari sebelumnya' : 'Minggu sebelumnya'} onClick={() => setDate(addDays(date, view === 'day' ? -1 : -7))}>
              ◀
            </button>
            <input id="jadwal-tanggal" className={styles.input} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <button type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} aria-label={view === 'day' ? 'Hari berikutnya' : 'Minggu berikutnya'} onClick={() => setDate(addDays(date, view === 'day' ? 1 : 7))}>
              ▶
            </button>
          </span>
        </div>
        <div className={styles.seg} role="group" aria-label="Tampilan">
          <button type="button" aria-pressed={view === 'day'} onClick={() => setView('day')}>
            Harian
          </button>
          <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>
            Mingguan
          </button>
        </div>
        {me.admin.role !== 'barber' && (
          <label className={styles.control}>
            Hairstylist
            <select value={barber} onChange={(e) => setBarber(e.target.value)}>
              <option value="">Semua</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={styles.control}>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua</option>
            {(Object.keys(STATUS_LABEL) as BookingStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} onClick={() => setDate(todayWib())}>
          Hari ini
        </button>
        {newIds.length > 0 && (
          <button type="button" className={styles.newBadge} onClick={() => setNewIds([])} aria-live="polite">
            {newIds.length} booking baru · tandai sudah dilihat
          </button>
        )}
      </div>
      {error && (
        <p className={styles.alert} data-tone="error" role="alert">
          {error}
        </p>
      )}
      {!bookings ? (
        <p className={styles.muted}>Memuat jadwal…</p>
      ) : view === 'day' ? (
        <DayView bookings={visible} barbers={me.admin.role === 'barber' ? me.barbers : barbers.filter((b) => !barber || String(b.id) === barber)} newIds={newIds} onOpen={setOpenId} />
      ) : (
        <WeekView bookings={visible} from={date} tz={tz} newIds={newIds} onOpen={setOpenId} />
      )}
      <p className={styles.muted}>Diperbarui otomatis setiap 30 detik.</p>
      {open && (
        <BookingDetail
          booking={open}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            void load();
          }}
        />
      )}
    </section>
  );
}

function Card({ b, isNew, onOpen }: { b: AdminBooking; isNew: boolean; onOpen: (id: string) => void }) {
  return (
    <button type="button" className={styles.card} data-status={b.status} onClick={() => onOpen(b.id)}>
      <span className={styles.cardLine}>
        <span className={styles.cardTime}>
          {clock(b.start_at, b.timezone)}–{clock(b.end_at, b.timezone)}
        </span>{' '}
        <span className={styles.status} data-status={b.status}>
          {STATUS_LABEL[b.status]}
        </span>{' '}
        {isNew && <span className={styles.status} style={{ background: '#b3261e' }}>Baru</span>}
      </span>
      <span className={styles.cardLine}>
        <strong>{b.service_name_snapshot}</strong> · {rupiah(b.price_snapshot)}
      </span>
      <span className={styles.cardLine}>
        {b.customer_name}
        {b.customer_phone ? ` · ${formatPhone(b.customer_phone)}` : ''}
      </span>
      {(b.customer_note || b.admin_note) && <span className={`${styles.cardLine} ${styles.muted}`}>📝 {b.customer_note ?? b.admin_note}</span>}
    </button>
  );
}

function DayView({ bookings, barbers, newIds, onOpen }: { bookings: AdminBooking[]; barbers: { id: number; name: string }[]; newIds: string[]; onOpen: (id: string) => void }) {
  if (barbers.length === 0) return <p className={styles.muted}>Belum ada hairstylist aktif di cabang ini.</p>;
  return (
    <div className={styles.columns}>
      {barbers.map((barber) => {
        const list = bookings.filter((b) => b.barber_id === barber.id);
        return (
          <div key={barber.id} className={styles.column}>
            <div className={styles.columnHead}>
              {barber.name} · {list.filter((b) => b.status === 'pending' || b.status === 'confirmed').length} booking
            </div>
            {list.length === 0 ? (
              <p className={styles.muted} style={{ padding: 8 }}>
                Kosong
              </p>
            ) : (
              <ul className={styles.cards}>
                {list.map((b) => (
                  <li key={b.id}>
                    <Card b={b} isNew={newIds.includes(b.id)} onOpen={onOpen} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WeekView({ bookings, from, tz, newIds, onOpen }: { bookings: AdminBooking[]; from: string; tz: string; newIds: string[]; onOpen: (id: string) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return (
    <div>
      {days.map((d) => {
        const list = bookings.filter((b) => localDate(Date.parse(b.start_at), b.timezone) === d);
        return (
          <div key={d} className={styles.dayGroup}>
            <h2 className={styles.h2}>
              {shortDate(`${d}T05:00:00Z`, tz)} · {list.filter((b) => b.status === 'pending' || b.status === 'confirmed').length} booking aktif
            </h2>
            {list.length === 0 ? (
              <p className={styles.muted}>Tidak ada booking.</p>
            ) : (
              <ul className={styles.cards}>
                {list.map((b) => (
                  <li key={b.id}>
                    <Card b={{ ...b, service_name_snapshot: `${b.service_name_snapshot} · ${b.barber_name}` }} isNew={newIds.includes(b.id)} onOpen={onOpen} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

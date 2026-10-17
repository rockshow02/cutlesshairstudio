import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, errorMessage } from '@/app/api';
import { clock, formatPhone, rupiah, shortDate } from '@/app/format';
import { STATUS_LABEL, type BookingStatus } from '@shared/booking';
import { addDays, localDate } from '@shared/time';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert, EmptyState, Skeleton } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { STATUS_TONE } from '@/components/ui/status';
import { Toolbar } from '@/components/ui/Toolbar';
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
  const isToday = date === todayWib();

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
  const activeFilters = [barber, status].filter(Boolean).length + (me.admin.role === 'owner' && branchId !== (me.admin.branch_id ?? me.branches[0]?.id) ? 1 : 0);
  const step = view === 'day' ? 1 : 7;

  return (
    <section aria-labelledby="jadwal-title">
      <PageHeader
        titleId="jadwal-title"
        title="Jadwal"
        description={`${branch?.name ?? 'Semua cabang'} · ${view === 'day' ? shortDate(`${date}T05:00:00Z`, tz) : `${shortDate(`${date}T05:00:00Z`, tz)} – ${shortDate(`${to}T05:00:00Z`, tz)}`}`}
        actions={
          me.admin.role !== 'barber' && (
            <Button href="#baru" variant="dark" casing="normal" icon="plus" size="sm">
              Booking baru
            </Button>
          )
        }
      />

      <Toolbar
        label="Filter jadwal"
        activeCount={activeFilters}
        primary={
          <>
            <div className={styles.dateNav}>
              <button type="button" className={styles.iconBtn} aria-label={view === 'day' ? 'Hari sebelumnya' : 'Minggu sebelumnya'} onClick={() => setDate(addDays(date, -step))}>
                <Icon name="chevron-left" size={18} />
              </button>
              <Field label="Tanggal" flush>
                <Input id="jadwal-tanggal" className={styles.dateInput} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
              </Field>
              <button type="button" className={styles.iconBtn} aria-label={view === 'day' ? 'Hari berikutnya' : 'Minggu berikutnya'} onClick={() => setDate(addDays(date, step))}>
                <Icon name="chevron-right" size={18} />
              </button>
            </div>
            <SegmentedControl
              label="Tampilan"
              value={view}
              onChange={setView}
              options={[
                { value: 'day', label: 'Harian' },
                { value: 'week', label: 'Mingguan' },
              ]}
            />
          </>
        }
        filters={
          <>
            {me.admin.role === 'owner' && (
              <Field label="Cabang" flush>
                <Select className={styles.selectSm} value={branchId ?? ''} onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : undefined)}>
                  {me.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {me.admin.role !== 'barber' && (
              <Field label="Hairstylist" flush>
                <Select className={styles.selectSm} value={barber} onChange={(e) => setBarber(e.target.value)}>
                  <option value="">Semua</option>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Status" flush>
              <Select className={styles.selectSm} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Semua</option>
                {(Object.keys(STATUS_LABEL) as BookingStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        }
        actions={
          <>
            {!isToday && (
              <Button variant="outline-dark" casing="normal" onClick={() => setDate(todayWib())}>
                Hari ini
              </Button>
            )}
            {newIds.length > 0 && (
              <button type="button" className={styles.newButton} onClick={() => setNewIds([])} aria-live="polite">
                <Badge tone="danger" solid>
                  {newIds.length} baru
                </Badge>
                Tandai sudah dilihat
              </button>
            )}
          </>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}
      {!bookings ? (
        <div className={styles.skeletonColumns} role="status">
          <span className="visually-hidden">Memuat jadwal…</span>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} height={280} radius="var(--radius-lg)" />
          ))}
        </div>
      ) : visible.length === 0 && !error ? (
        <EmptyState
          icon="calendar"
          title={isToday && view === 'day' ? 'Belum ada booking hari ini' : view === 'day' ? 'Tidak ada booking di tanggal ini' : 'Tidak ada booking minggu ini'}
          action={
            me.admin.role !== 'barber' && (
              <Button href="#baru" variant="dark" casing="normal" size="sm" icon="plus">
                Buat booking walk-in
              </Button>
            )
          }
        >
          {status || barber ? 'Coba hapus filter hairstylist/status.' : 'Booking online & walk-in akan muncul di sini.'}
        </EmptyState>
      ) : view === 'day' ? (
        <DayView bookings={visible} barbers={me.admin.role === 'barber' ? me.barbers : barbers.filter((b) => !barber || String(b.id) === barber)} newIds={newIds} onOpen={setOpenId} />
      ) : (
        <WeekView bookings={visible} from={date} tz={tz} newIds={newIds} onOpen={setOpenId} />
      )}
      <p className={styles.refreshNote}>Diperbarui otomatis setiap 30 detik.</p>
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

function Card({ b, isNew, showBarber, onOpen }: { b: AdminBooking; isNew: boolean; showBarber?: boolean; onOpen: (id: string) => void }) {
  return (
    <button type="button" className={styles.card} data-status={b.status} data-tone={STATUS_TONE[b.status]} onClick={() => onOpen(b.id)}>
      <span className={styles.cardTop}>
        <span className={styles.cardTime}>
          {clock(b.start_at, b.timezone)}–{clock(b.end_at, b.timezone)}
        </span>
        <span className={styles.badges}>
          {isNew && (
            <Badge tone="danger" solid>
              Baru
            </Badge>
          )}
          <StatusBadge status={b.status} />
        </span>
      </span>
      <span className={styles.cardService}>
        {b.service_name_snapshot}
        {showBarber ? ` · ${b.barber_name}` : ''} · {rupiah(b.price_snapshot)}
      </span>
      <span className={styles.cardCustomer}>
        {b.customer_name}
        {b.customer_phone ? ` · ${formatPhone(b.customer_phone)}` : ''}
      </span>
      {(b.customer_note || b.admin_note) && (
        <span className={styles.cardNote}>
          <Icon name="info" size={14} />
          {b.customer_note ?? b.admin_note}
        </span>
      )}
    </button>
  );
}

const activeCount = (list: AdminBooking[]) => list.filter((b) => b.status === 'pending' || b.status === 'confirmed').length;

function DayView({ bookings, barbers, newIds, onOpen }: { bookings: AdminBooking[]; barbers: { id: number; name: string }[]; newIds: string[]; onOpen: (id: string) => void }) {
  if (barbers.length === 0) return <EmptyState icon="user" title="Belum ada hairstylist aktif di cabang ini" />;
  return (
    <div className={styles.columns}>
      {barbers.map((barber) => {
        const list = bookings.filter((b) => b.barber_id === barber.id);
        return (
          <div key={barber.id} className={styles.column}>
            <div className={styles.columnHead}>
              <span>{barber.name}</span>
              <Badge tone={activeCount(list) ? 'info' : 'neutral'}>{activeCount(list)} booking</Badge>
            </div>
            {list.length === 0 ? (
              <p className={styles.columnEmpty}>Kosong</p>
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
            <div className={styles.dayHead}>
              <h2>{shortDate(`${d}T05:00:00Z`, tz)}</h2>
              <span className={styles.muted}>{activeCount(list)} booking aktif</span>
            </div>
            {list.length === 0 ? (
              <p className={styles.muted}>Tidak ada booking.</p>
            ) : (
              <ul className={styles.weekCards}>
                {list.map((b) => (
                  <li key={b.id}>
                    <Card b={b} isNew={newIds.includes(b.id)} showBarber onOpen={onOpen} />
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

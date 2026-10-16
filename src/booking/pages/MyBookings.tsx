import { useCallback, useEffect, useState } from 'react';
import { api, ApiClientError, errorMessage } from '@/app/api';
import { clock, longDate, rupiah, tzLabel, waLink } from '@/app/format';
import { localDate } from '@shared/time';
import type { Slot } from '@shared/slots';
import { Button } from '@/components/ui/Button';
import { Page, Loading } from '../Page';
import { SlotPicker } from '../SlotPicker';
import { loginUrl } from '../hooks';
import { whatsappDetail } from './Success';
import type { BookingBranch, CustomerBooking } from '../types';
import styles from '../booking.module.css';

const STATUS_TONE: Record<string, string> = { confirmed: 'ok', pending: 'warn', cancelled: 'muted', no_show: 'muted', completed: '' };

/** /booking/saya: booking aktif (batal / jadwal ulang sampai batas waktu) & riwayat */
export function MyBookings() {
  const [data, setData] = useState<{ active: CustomerBooking[]; history: CustomerBooking[] } | null>(null);
  const [branches, setBranches] = useState<BookingBranch[]>([]);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const load = useCallback(() => {
    api<{ active: CustomerBooking[]; history: CustomerBooking[] }>('/me/bookings')
      .then(setData)
      .catch((e) => {
        if (e instanceof ApiClientError && e.status === 401) window.location.replace(loginUrl());
        else setError(errorMessage(e));
      });
  }, []);

  useEffect(() => {
    load();
    api<{ branches: BookingBranch[] }>('/booking/branches').then((r) => setBranches(r.branches)).catch(() => undefined);
  }, [load]);

  return (
    <Page id="booking-saya" kicker="Akun" title="Booking saya">
      <div className={styles.actions}>
        <Button href="/booking/" variant="dark" icon="scissors">
          Booking baru
        </Button>
        <Button href="/profil" variant="outline-dark">
          Profil
        </Button>
      </div>
      {flash && (
        <p className={styles.alert} data-tone="ok" role="status">
          {flash}
        </p>
      )}
      {error && (
        <p className={styles.alert} data-tone="error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <Loading />
      ) : (
        <>
          <h2 className={styles.h2}>Aktif</h2>
          {data.active.length === 0 ? (
            <p className={styles.empty}>Belum ada booking aktif.</p>
          ) : (
            <ul className={styles.list}>
              {data.active.map((b) => (
                <li key={b.id}>
                  <ActiveCard
                    booking={b}
                    branch={branches.find((x) => x.slug === b.branch.slug)}
                    onChanged={(msg) => {
                      setFlash(msg);
                      load();
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
          <h2 className={styles.h2}>Riwayat</h2>
          {data.history.length === 0 ? (
            <p className={styles.empty}>Belum ada riwayat.</p>
          ) : (
            <ul className={styles.list}>
              {data.history.map((b) => (
                <li key={b.id}>
                  <article className={styles.bookingCard}>
                    <Head booking={b} />
                    <p className={styles.bookingInfo}>
                      {b.service.name} · {b.barber.name} · {b.branch.name}
                      {b.cancelReason ? ` · ${b.cancelReason}` : ''}
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Page>
  );
}

function Head({ booking: b }: { booking: CustomerBooking }) {
  return (
    <div className={styles.bookingHead}>
      <span className={styles.bookingWhen}>
        {longDate(b.startAt, b.timezone)} · {clock(b.startAt, b.timezone)} {tzLabel(b.timezone)}
      </span>
      <span className={styles.badge} data-tone={STATUS_TONE[b.status]}>
        {b.statusLabel}
      </span>
    </div>
  );
}

function ActiveCard({ booking: b, branch, onChanged }: { booking: CustomerBooking; branch?: BookingBranch; onChanged: (msg: string) => void }) {
  const [mode, setMode] = useState<'idle' | 'cancel' | 'reschedule'>('idle');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(() => localDate(Date.parse(b.startAt), b.timezone));
  const [slot, setSlot] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dates = branch?.dates ?? [];

  const cancel = async () => {
    setBusy(true);
    setError('');
    try {
      await api(`/bookings/${b.id}/cancel`, { method: 'POST', json: { reason: reason || null } });
      onChanged(`Booking ${b.code} dibatalkan.`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reschedule = async () => {
    if (!slot) return;
    setBusy(true);
    setError('');
    try {
      await api(`/bookings/${b.id}/reschedule`, { method: 'POST', json: { startAt: slot.startAt, barber: b.barber.id } });
      onChanged(`Booking ${b.code} dipindah ke ${longDate(slot.startAt, b.timezone)} ${clock(slot.startAt, b.timezone)}.`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={styles.bookingCard}>
      <Head booking={b} />
      <p className={styles.bookingInfo}>
        Kode <strong>{b.code}</strong> · {b.service.name} · {b.barber.name} · {b.branch.name} · {rupiah(b.service.price)}
      </p>
      {error && (
        <p className={styles.alert} data-tone="error" role="alert">
          {error}
        </p>
      )}
      {b.canManage ? (
        mode === 'idle' && (
          <div className={styles.actions}>
            <Button variant="outline-dark" size="sm" onClick={() => setMode('reschedule')}>
              Jadwal ulang
            </Button>
            <Button variant="outline-dark" size="sm" onClick={() => setMode('cancel')}>
              Batalkan
            </Button>
            <Button href={`/api/bookings/${b.id}/ics`} variant="outline-dark" size="sm" icon="clock">
              Kalender
            </Button>
          </div>
        )
      ) : (
        <>
          <p className={styles.hint}>
            Batas ubah/batal online ({Math.round(b.cancelDeadlineMin / 60)} jam sebelum jadwal) sudah lewat. Hubungi cabang bila ada perubahan.
          </p>
          <div className={styles.actions}>
            <Button href={whatsappDetail(b, 'saya ingin mengubah booking saya')} external variant="whatsapp" icon="whatsapp" size="sm">
              Hubungi cabang via WhatsApp
            </Button>
          </div>
        </>
      )}

      {mode === 'cancel' && (
        <div className={styles.inlinePanel}>
          <div className={styles.field}>
            <label htmlFor={`reason-${b.id}`}>Alasan (opsional)</label>
            <input id={`reason-${b.id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </div>
          <div className={styles.actions}>
            <Button variant="dark" size="sm" onClick={cancel} disabled={busy}>
              {busy ? 'Membatalkan…' : 'Ya, batalkan booking'}
            </Button>
            <Button variant="outline-dark" size="sm" onClick={() => setMode('idle')}>
              Kembali
            </Button>
          </div>
        </div>
      )}

      {mode === 'reschedule' && (
        <div className={styles.inlinePanel}>
          <p className={styles.hint}>
            Pilih jadwal baru dengan {b.barber.name}. Jadwal lama tetap aman sampai jadwal baru dikonfirmasi.
          </p>
          {dates.length > 0 ? (
            <SlotPicker
              branch={b.branch.slug}
              service={b.service.id}
              barber={b.barber.id}
              dates={dates}
              date={dates.includes(date) ? date : dates[0]}
              onDate={(d) => {
                setDate(d);
                setSlot(null);
              }}
              selected={slot?.startAt}
              onSelect={setSlot}
            />
          ) : (
            <Loading />
          )}
          <div className={styles.actions}>
            <Button variant="dark" size="sm" onClick={reschedule} disabled={!slot || busy}>
              {busy ? 'Menyimpan…' : slot ? `Pindah ke ${clock(slot.startAt, b.timezone)}` : 'Pilih jam baru'}
            </Button>
            <Button
              variant="outline-dark"
              size="sm"
              onClick={() => {
                setMode('idle');
                setSlot(null);
              }}
            >
              Kembali
            </Button>
          </div>
          <p className={styles.hint}>
            Butuh hairstylist lain? <a className={styles.link} href={waLink(b.branch.whatsapp, `Halo Cutless ${b.branch.name}, saya ingin pindah hairstylist untuk booking ${b.code}.`)}>Hubungi cabang</a>.
          </p>
        </div>
      )}
    </article>
  );
}

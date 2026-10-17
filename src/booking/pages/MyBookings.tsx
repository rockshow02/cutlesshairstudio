import { useEffect, useState } from 'react';
import { api, ApiClientError, errorMessage } from '@/app/api';
import { usePaged } from '@/app/usePaged';
import { clock, longDate, rupiah, tzLabel, waLink } from '@/app/format';
import { localDate } from '@shared/time';
import type { Slot } from '@shared/slots';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { LoadMore } from '@/components/ui/LoadMore';
import { useConfirm } from '@/components/ui/useConfirm';
import { useToast } from '@/components/ui/toastContext';
import { Page, Loading } from '../Page';
import { SlotPicker } from '../SlotPicker';
import { LoyaltySection } from '../loyalty/LoyaltySection';
import { loginUrl } from '../hooks';
import { whatsappDetail } from './Success';
import type { BookingBranch, CustomerBooking } from '../types';
import styles from '../booking.module.css';

/** /booking/saya: booking aktif (batal / jadwal ulang sampai batas waktu) & riwayat */
type MyBookingsPage = { active: CustomerBooking[]; history: CustomerBooking[]; nextCursor: string | null; historyTotal?: number };

export function MyBookings() {
  const [active, setActive] = useState<CustomerBooking[] | null>(null);
  const [branches, setBranches] = useState<BookingBranch[]>([]);
  const [error, setError] = useState('');
  const toast = useToast();

  // Halaman pertama: booking aktif (lengkap) + 20 riwayat terbaru; berikutnya hanya riwayat
  const history = usePaged<CustomerBooking>(async (cursor) => {
    try {
      const r = await api<MyBookingsPage>(`/me/bookings${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
      if (!cursor) setActive(r.active);
      return { items: r.history, nextCursor: r.nextCursor, total: r.historyTotal };
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) window.location.replace(loginUrl());
      else if (!cursor) {
        // Halaman pertama gagal: tampilkan pesan di atas, daftar kosong (tidak tertahan di skeleton)
        setError(errorMessage(e));
        setActive([]);
      }
      throw e;
    }
  }, []);
  const load = history.reload;

  useEffect(() => {
    api<{ branches: BookingBranch[] }>('/booking/branches').then((r) => setBranches(r.branches)).catch(() => undefined);
  }, []);

  return (
    <Page
      id="booking-saya"
      kicker="Akun"
      title="Booking saya"
      actions={
        <>
          <Button href="/booking/" variant="dark" icon="scissors" size="sm">
            Booking baru
          </Button>
          <Button href="/profil" variant="outline-dark" icon="user" size="sm">
            Profil
          </Button>
        </>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <LoyaltySection reloadKey={0} />
      {/* aria-busy: true selama daftar dimuat (ulang), mis. setelah batal/jadwal ulang */}
      <div id="daftar-booking" aria-busy={!active || !history.items || history.loadingMore}>
      {!active || !history.items ? (
        <Loading count={2} label="Memuat booking…" />
      ) : (
        <>
          <section className={styles.section} aria-labelledby="aktif-title">
            <h2 id="aktif-title" className={styles.h2}>
              Aktif
            </h2>
            {active.length === 0 ? (
              <EmptyState
                icon="calendar"
                title="Belum ada booking aktif"
                action={
                  <Button href="/booking/" variant="dark" icon="scissors" size="sm">
                    Booking sekarang
                  </Button>
                }
              >
                Pilih cabang, layanan, dan jam yang pas. Kurang dari satu menit.
              </EmptyState>
            ) : (
              <ul className={styles.list}>
                {active.map((b) => (
                  <li key={b.id}>
                    <ActiveCard
                      booking={b}
                      branch={branches.find((x) => x.slug === b.branch.slug)}
                      onChanged={(msg) => {
                        toast(msg);
                        load();
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={styles.section} aria-labelledby="riwayat-title">
            <h2 id="riwayat-title" className={styles.h2}>
              Riwayat
            </h2>
            {history.items.length === 0 ? (
              <EmptyState icon="clock" title="Belum ada riwayat" compact />
            ) : (
              <>
              <ul className={styles.list}>
                {history.items.map((b) => (
                  <li key={b.id}>
                    <Card tone="outline" padding="sm" className={styles.historyCard}>
                      <Head booking={b} />
                      <p className={styles.bookingInfo}>
                        {b.service.name} · {b.barber.name} · {b.branch.name}
                        {b.cancelReason ? ` · ${b.cancelReason}` : ''}
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
              <LoadMore
                shown={history.items.length}
                total={history.total}
                hasMore={history.hasMore}
                loading={history.loadingMore}
                onLoad={history.loadMore}
                noun="riwayat"
                casing="upper"
                skeletonHeight={72}
              />
              </>
            )}
            {history.error && !error && <Alert tone="danger">{history.error}</Alert>}
          </section>
        </>
      )}
      </div>
    </Page>
  );
}

/** Baris atas kartu. Span pertama = waktu booking (dipakai tes E2E). */
function Head({ booking: b }: { booking: CustomerBooking }) {
  return (
    <div className={styles.bookingHead}>
      <span className={styles.bookingWhen}>
        {longDate(b.startAt, b.timezone)} ·{' '}
        <span className={styles.nowrap}>
          {clock(b.startAt, b.timezone)} {tzLabel(b.timezone)}
        </span>
      </span>
      <StatusBadge status={b.status} label={b.statusLabel} />
    </div>
  );
}

function ActiveCard({ booking: b, branch, onChanged }: { booking: CustomerBooking; branch?: BookingBranch; onChanged: (msg: string) => void }) {
  const [mode, setMode] = useState<'idle' | 'reschedule'>('idle');
  const [date, setDate] = useState(() => localDate(Date.parse(b.startAt), b.timezone));
  const [slot, setSlot] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dialog, confirm] = useConfirm();
  const dates = branch?.dates ?? [];

  const cancel = async () => {
    const reason = await confirm({
      title: `Batalkan booking ${b.code}?`,
      message: `${longDate(b.startAt, b.timezone)}, ${clock(b.startAt, b.timezone)} ${tzLabel(b.timezone)} · ${b.service.name} dengan ${b.barber.name}. Jam ini akan dilepas untuk pelanggan lain.`,
      input: { label: 'Alasan (opsional)', maxLength: 300 },
      confirmLabel: 'Ya, batalkan booking',
      cancelLabel: 'Kembali',
      casing: 'upper',
    });
    if (reason === null) return;
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
    <Card tone="outline">
      <Head booking={b} />
      <p className={styles.bookingInfo}>
        <span className={styles.bookingCode}>{b.code}</span> · <strong>{b.service.name}</strong> · {b.barber.name} · {b.branch.name} · {rupiah(b.service.price)}
      </p>
      {error && (
        <>
          <div className={styles.gap} />
          <Alert tone="danger">{error}</Alert>
        </>
      )}
      {b.canManage ? (
        mode === 'idle' && (
          <>
            <div className={styles.cardActionsPair}>
              <Button variant="outline-dark" size="sm" onClick={() => setMode('reschedule')} disabled={busy} block>
                Jadwal ulang
              </Button>
              <Button variant="outline-danger" size="sm" onClick={cancel} disabled={busy} block>
                {busy ? 'Membatalkan…' : 'Batalkan'}
              </Button>
            </div>
            <div className={styles.cardLink}>
              <Button href={`/api/bookings/${b.id}/ics`} variant="text" size="sm" icon="calendar">
                Kalender
              </Button>
            </div>
          </>
        )
      ) : (
        <div className={styles.inlinePanel}>
          <p className={styles.hint}>
            Batas ubah/batal online ({Math.round(b.cancelDeadlineMin / 60)} jam sebelum jadwal) sudah lewat. Hubungi cabang bila ada perubahan.
          </p>
          <div className={styles.cardActions}>
            <Button href={whatsappDetail(b, 'saya ingin mengubah booking saya')} external variant="whatsapp" icon="whatsapp" size="sm">
              Hubungi cabang via WhatsApp
            </Button>
          </div>
        </div>
      )}

      {mode === 'reschedule' && (
        <div className={styles.inlinePanel}>
          <p className={`${styles.hint} ${styles.panelLead}`}>
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
            <Loading count={1} />
          )}
          <div className={styles.cardActions}>
            <Button variant="dark" size="sm" onClick={reschedule} disabled={!slot || busy}>
              {busy ? 'Menyimpan…' : slot ? `Pindah ke ${clock(slot.startAt, b.timezone)}` : 'Pilih jam baru'}
            </Button>
            <Button
              variant="text"
              size="sm"
              onClick={() => {
                setMode('idle');
                setSlot(null);
              }}
            >
              Kembali
            </Button>
          </div>
          <p className={`${styles.hint} ${styles.panelFoot}`}>
            Butuh hairstylist lain?{' '}
            <a className={styles.link} href={waLink(b.branch.whatsapp, `Halo Cutless ${b.branch.name}, saya ingin pindah hairstylist untuk booking ${b.code}.`)}>
              Hubungi cabang
            </a>
            .
          </p>
        </div>
      )}
      {dialog}
    </Card>
  );
}

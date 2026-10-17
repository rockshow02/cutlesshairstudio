import { useEffect, useState } from 'react';
import { useFabZone } from '@/lib/fabZones';
import { api, errorMessage } from '@/app/api';
import { clock, longDate, rupiah, tzLabel, waLink } from '@/app/format';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Feedback';
import { Page, Loading } from '../Page';
import { loginUrl } from '../hooks';
import type { CustomerBooking } from '../types';
import styles from '../booking.module.css';

/** Pesan WhatsApp ke cabang berisi kode & detail booking */
export function whatsappDetail(b: CustomerBooking, intro = 'saya sudah booking online') {
  const when = `${longDate(b.startAt, b.timezone)}, ${clock(b.startAt, b.timezone)} ${tzLabel(b.timezone)}`;
  return waLink(
    b.branch.whatsapp,
    `Halo Cutless Hair Studio cabang ${b.branch.name}, ${intro}.\n\nKode: ${b.code}\nLayanan: ${b.service.name}\nHairstylist: ${b.barber.name}\nJadwal: ${when}`,
  );
}

/** /booking/sukses?id=… */
export function Success() {
  const id = new URLSearchParams(window.location.search).get('id') ?? '';
  const [booking, setBooking] = useState<CustomerBooking | null>(null);
  const [error, setError] = useState('');
  // Halaman ini sudah punya tombol WhatsApp utama → tombol WhatsApp melayang disembunyikan
  const fabZone = useFabZone<HTMLDivElement>(0);

  useEffect(() => {
    api<{ booking: CustomerBooking }>(`/bookings/${encodeURIComponent(id)}`)
      .then((r) => setBooking(r.booking))
      .catch((e) => {
        if (e.status === 401) window.location.replace(loginUrl());
        else setError(errorMessage(e));
      });
  }, [id]);

  if (error) {
    return (
      <Page id="sukses" title="Booking tidak ditemukan">
        <Alert tone="danger">{error}</Alert>
        <Button href="/booking/saya" variant="dark">
          Lihat booking saya
        </Button>
      </Page>
    );
  }
  if (!booking) {
    return (
      <Page id="sukses" title="Booking berhasil">
        <Loading count={2} />
      </Page>
    );
  }

  const pending = booking.status === 'pending';
  return (
    <Page id="sukses" kicker={pending ? 'Menunggu konfirmasi' : 'Booking terkonfirmasi'} title={pending ? 'Booking diterima' : 'Booking berhasil!'}>
      <div ref={fabZone}>
      <Card tone="outline" as="div" padding="lg">
        <div className={styles.codeCard}>
          <span className={styles.codeLabel}>Kode booking</span>
          <p className={styles.code} aria-label={`Kode booking ${booking.code.split('').join(' ')}`}>
            {booking.code}
          </p>
          <StatusBadge status={booking.status} label={booking.statusLabel} />
        </div>
        <p className={styles.muted}>
          {pending
            ? 'Cabang akan mengonfirmasi booking Anda. Pantau statusnya di halaman Booking saya.'
            : 'Sampai jumpa di studio! Datang 5 menit lebih awal ya.'}
        </p>
      </Card>
      <div className={styles.gap} />

      <Card tone="outline" as="div">
        <dl className={styles.dl}>
          <div>
            <dt>Jadwal</dt>
            <dd>
              {longDate(booking.startAt, booking.timezone)}, {clock(booking.startAt, booking.timezone)} {tzLabel(booking.timezone)}
            </dd>
          </div>
          <div>
            <dt>Cabang</dt>
            <dd>
              {booking.branch.name}
              {booking.branch.address && <span className={styles.address}>{booking.branch.address}</span>}
            </dd>
          </div>
          <div>
            <dt>Layanan</dt>
            <dd>
              {booking.service.name} <small>(±{booking.service.durationMin} menit)</small>
            </dd>
          </div>
          <div>
            <dt>Hairstylist</dt>
            <dd>{booking.barber.name}</dd>
          </div>
          <div>
            <dt>Harga</dt>
            <dd>
              {rupiah(booking.service.price)} <small>(bayar di cabang)</small>
            </dd>
          </div>
        </dl>
      </Card>

      <div className={styles.actions}>
        <Button href={whatsappDetail(booking)} external variant="whatsapp" icon="whatsapp" block>
          Kirim ke WhatsApp
        </Button>
      </div>
      <div className={styles.actionsGrid}>
        <Button href={`/api/bookings/${booking.id}/ics`} variant="outline-dark" icon="calendar" size="sm" block>
          Tambah ke kalender
        </Button>
        {booking.branch.mapsUrl && (
          <Button href={booking.branch.mapsUrl} external variant="outline-dark" icon="navigate" size="sm" block>
            Petunjuk arah
          </Button>
        )}
      </div>
      <div className={styles.textAction}>
        <Button href="/booking/saya" variant="text" iconEnd="arrow" size="sm">
          Booking saya
        </Button>
      </div>
      </div>
    </Page>
  );
}

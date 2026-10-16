import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/app/api';
import { clock, longDate, rupiah, tzLabel, waLink } from '@/app/format';
import { Button } from '@/components/ui/Button';
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
        <p className={styles.alert} data-tone="error">{error}</p>
        <Button href="/booking/saya" variant="dark">Lihat booking saya</Button>
      </Page>
    );
  }
  if (!booking) return <Page id="sukses" title="Booking berhasil"><Loading /></Page>;

  const pending = booking.status === 'pending';
  return (
    <Page id="sukses" kicker={pending ? 'Menunggu konfirmasi' : 'Booking terkonfirmasi'} title={pending ? 'Booking diterima' : 'Booking berhasil!'}>
      <p className={styles.muted}>Kode booking</p>
      <p className={styles.code} aria-label={`Kode booking ${booking.code.split('').join(' ')}`}>
        {booking.code}
      </p>
      <p className={styles.alert} data-tone={pending ? 'warn' : 'ok'} role="status">
        <strong>Status: {booking.statusLabel}.</strong>{' '}
        {pending
          ? 'Cabang akan mengonfirmasi booking Anda. Pantau statusnya di halaman Booking saya.'
          : 'Sampai jumpa di studio! Datang 5 menit lebih awal ya.'}
      </p>
      <div className={styles.summary}>
        <dl>
          <div><dt>Cabang</dt><dd>{booking.branch.name}{booking.branch.address ? ` · ${booking.branch.address}` : ''}</dd></div>
          <div><dt>Jadwal</dt><dd>{longDate(booking.startAt, booking.timezone)}, {clock(booking.startAt, booking.timezone)} {tzLabel(booking.timezone)}</dd></div>
          <div><dt>Layanan</dt><dd>{booking.service.name} (±{booking.service.durationMin} menit)</dd></div>
          <div><dt>Hairstylist</dt><dd>{booking.barber.name}</dd></div>
          <div><dt>Harga</dt><dd>{rupiah(booking.service.price)} <span className={styles.muted}>(bayar di cabang)</span></dd></div>
        </dl>
      </div>
      <div className={styles.actions}>
        <Button href={whatsappDetail(booking)} external variant="whatsapp" icon="whatsapp">
          Kirim detail ke WhatsApp cabang
        </Button>
        <Button href={`/api/bookings/${booking.id}/ics`} variant="outline-dark" icon="clock">
          Tambah ke kalender (.ics)
        </Button>
      </div>
      <div className={styles.actions}>
        <Button href="/booking/saya" variant="dark" iconEnd="arrow">
          Booking saya
        </Button>
        {booking.branch.mapsUrl && (
          <Button href={booking.branch.mapsUrl} external variant="outline-dark" icon="navigate">
            Petunjuk arah
          </Button>
        )}
      </div>
    </Page>
  );
}

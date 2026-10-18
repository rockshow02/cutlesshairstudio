import { useState } from 'react';
import { api, errorMessage } from '@/app/api';
import { clock, formatPhone, longDate, rupiah, tzLabel, waLink } from '@/app/format';
import { NO_SHOW_AFTER_MIN, STATUS_LABEL } from '@shared/booking';
import { addDays, localDate } from '@shared/time';
import type { Slot } from '@shared/slots';
import { SlotPicker } from '@/booking/SlotPicker';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Overlay';
import { useConfirm } from '@/components/ui/useConfirm';
import { SOURCE_LABEL, useAdmin, type AdminBooking } from './context';
import { BookingVoucherPanel } from './Loyalty';
import { useLoyaltyActive } from './loyaltyStatus';
import { BookingOrders } from './shop/BookingOrders';
import styles from './admin.module.css';

/** Detail booking + aksi sesuai peran & status (panel kanan di desktop, panel bawah di HP) */
export function BookingDetail({ booking: b, onClose, onChanged }: { booking: AdminBooking; onClose: () => void; onChanged: () => void }) {
  const me = useAdmin();
  const [open, setOpen] = useState(true);
  const [note, setNote] = useState(b.admin_note ?? '');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState(() => localDate(Date.parse(b.start_at), b.timezone));
  const [barberId, setBarberId] = useState<number>(b.barber_id);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [dialog, confirm] = useConfirm();
  const loyaltyActive = useLoyaltyActive();
  const isBarber = me.admin.role === 'barber';
  const now = Date.now();
  const started = now >= Date.parse(b.start_at);
  const noShowReady = now >= Date.parse(b.start_at) + NO_SHOW_AFTER_MIN * 60_000;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: 'ok', text: label });
      onChanged();
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: 'confirmed' | 'completed' | 'no_show' | 'cancelled') => {
    let reason: string | null = null;
    if (status === 'cancelled') {
      reason = await confirm({
        title: `Batalkan booking ${b.code}?`,
        message: `${b.customer_name} · ${longDate(b.start_at, b.timezone)}, ${clock(b.start_at, b.timezone)}. Jam ini akan dilepas.`,
        input: { label: 'Alasan pembatalan', required: true, maxLength: 300, hint: 'Wajib diisi. Tersimpan di riwayat booking.' },
        confirmLabel: 'Ya, batalkan',
        cancelLabel: 'Kembali',
      });
      if (!reason) return;
    }
    if (status === 'no_show') {
      const ok = await confirm({
        title: 'Tandai tidak datang?',
        message: `${b.customer_name} akan tercatat tidak datang. Pelanggan yang sering tidak datang otomatis tidak bisa booking online.`,
        confirmLabel: 'Ya, tidak datang',
        cancelLabel: 'Kembali',
      });
      if (ok === null) return;
    }
    void run(`Status diubah menjadi ${STATUS_LABEL[status]}.`, () => api(`/admin/bookings/${b.id}/status`, { method: 'POST', json: { status, reason } }));
  };

  const active = b.status === 'pending' || b.status === 'confirmed';
  const dates = Array.from({ length: 15 }, (_, i) => addDays(localDate(now, b.timezone), i));
  const branchBarbers = me.barbers.filter((x) => x.branch_id === b.branch_id && x.is_active);

  return (
    <Sheet
      open={open}
      onClose={() => {
        setOpen(false);
        onClose();
      }}
      title={b.code}
      meta={
        <>
          <StatusBadge status={b.status} />
          <Badge>{SOURCE_LABEL[b.source]}</Badge>
        </>
      }
    >
      <dl className={styles.dl}>
        <div>
          <dt>Jadwal</dt>
          <dd>
            {longDate(b.start_at, b.timezone)}, {clock(b.start_at, b.timezone)}–{clock(b.end_at, b.timezone)} {tzLabel(b.timezone)}
          </dd>
        </div>
        <div>
          <dt>Layanan</dt>
          <dd>
            {b.service_name_snapshot} · {b.duration_snapshot} mnt · {rupiah(b.price_snapshot)}
          </dd>
        </div>
        <div>
          <dt>Hairstylist</dt>
          <dd>{b.barber_name}</dd>
        </div>
        <div>
          <dt>Cabang</dt>
          <dd>{b.branch_name}</dd>
        </div>
        <div>
          <dt>Pelanggan</dt>
          <dd>
            {b.customer_name}
            {b.customer_is_guest ? ' (tamu)' : ''}
            {b.customer_no_show > 0 ? ` · ${b.customer_no_show}× tidak datang` : ''}
          </dd>
        </div>
        {b.customer_phone && (
          <div>
            <dt>WhatsApp</dt>
            <dd>
              <a className={styles.link} href={waLink(b.customer_phone, `Halo ${b.customer_name}, kami dari Cutless ${b.branch_name} terkait booking ${b.code}.`)} target="_blank" rel="noopener noreferrer">
                {formatPhone(b.customer_phone)}
              </a>
            </dd>
          </div>
        )}
        <div>
          <dt>Dibuat</dt>
          <dd>
            {longDate(b.created_at, b.timezone)} {clock(b.created_at, b.timezone)}
          </dd>
        </div>
        {b.customer_note && (
          <div>
            <dt>Catatan pelanggan</dt>
            <dd>{b.customer_note}</dd>
          </div>
        )}
        {b.cancel_reason && (
          <div>
            <dt>Alasan batal</dt>
            <dd>{b.cancel_reason}</dd>
          </div>
        )}
      </dl>

      {!isBarber && me.features.shop && <BookingOrders bookingId={b.id} />}

      {msg && (
        <Alert tone={msg.tone === 'ok' ? 'success' : 'danger'} role={msg.tone === 'ok' ? 'status' : 'alert'}>
          {msg.text}
        </Alert>
      )}

      {active && (
        <div className={styles.actionBar}>
          {b.status === 'pending' && !isBarber && (
            <Button variant="dark" casing="normal" disabled={busy} onClick={() => setStatus('confirmed')}>
              Konfirmasi
            </Button>
          )}
          {b.status === 'confirmed' && (
            <Button variant="dark" casing="normal" disabled={busy || !started} title={started ? '' : 'Bisa ditandai setelah jam mulai'} onClick={() => setStatus('completed')}>
              Selesai
            </Button>
          )}
          {b.status === 'confirmed' && (
            <Button
              variant="outline-dark"
              casing="normal"
              disabled={busy || !noShowReady}
              title={noShowReady ? '' : `Bisa ditandai ${NO_SHOW_AFTER_MIN} menit setelah jam mulai`}
              onClick={() => setStatus('no_show')}
            >
              Tidak datang
            </Button>
          )}
          {!isBarber && (
            <>
              <Button variant="outline-dark" casing="normal" disabled={busy} aria-expanded={moving} onClick={() => setMoving((v) => !v)}>
                Pindah jadwal
              </Button>
              <Button variant="outline-danger" casing="normal" disabled={busy} onClick={() => setStatus('cancelled')}>
                Batalkan
              </Button>
            </>
          )}
        </div>
      )}

      {loyaltyActive && !isBarber && <BookingVoucherPanel bookingId={b.id} onChanged={onChanged} />}

      {moving && (
        <div className={styles.subPanel}>
          <Field label="Hairstylist">
            <Select
              value={barberId}
              onChange={(e) => {
                setBarberId(Number(e.target.value));
                setSlot(null);
              }}
            >
              {branchBarbers.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>
          <SlotPicker
            branch={b.branch_id}
            service={b.service_id}
            barber={barberId}
            dates={dates}
            date={dates.includes(date) ? date : dates[0]}
            onDate={(d) => {
              setDate(d);
              setSlot(null);
            }}
            selected={slot?.startAt}
            onSelect={setSlot}
            endpoint="/admin/availability"
            extra={{ exclude: b.id }}
          />
          <Button
            variant="dark"
            casing="normal"
            block
            disabled={!slot || busy}
            onClick={() =>
              slot &&
              void run('Jadwal dipindah.', () => api(`/admin/bookings/${b.id}/reschedule`, { method: 'POST', json: { startAt: slot.startAt, barber: barberId } })).then(() => setMoving(false))
            }
          >
            {slot ? `Pindah ke ${clock(slot.startAt, b.timezone)}` : 'Pilih jam'}
          </Button>
        </div>
      )}

      <div className={styles.noteBlock}>
        <Field label="Catatan admin (tidak terlihat pelanggan)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} />
        </Field>
        <Button variant="outline-dark" casing="normal" size="sm" disabled={busy} onClick={() => void run('Catatan disimpan.', () => api(`/admin/bookings/${b.id}/note`, { method: 'POST', json: { note } }))}>
          Simpan catatan
        </Button>
      </div>
      {dialog}
    </Sheet>
  );
}

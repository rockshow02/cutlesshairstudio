import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/app/api';
import { clock, formatPhone, longDate, rupiah, tzLabel, waLink } from '@/app/format';
import { NO_SHOW_AFTER_MIN, STATUS_LABEL } from '@shared/booking';
import { addDays, localDate } from '@shared/time';
import type { Slot } from '@shared/slots';
import { SlotPicker } from '@/booking/SlotPicker';
import { SOURCE_LABEL, useAdmin, type AdminBooking } from './context';
import styles from './admin.module.css';

/** Detail booking + aksi sesuai peran & status (dialog) */
export function BookingDetail({ booking: b, onClose, onChanged }: { booking: AdminBooking; onClose: () => void; onChanged: () => void }) {
  const me = useAdmin();
  const ref = useRef<HTMLDialogElement>(null);
  const [note, setNote] = useState(b.admin_note ?? '');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState(() => localDate(Date.parse(b.start_at), b.timezone));
  const [barberId, setBarberId] = useState<number>(b.barber_id);
  const [slot, setSlot] = useState<Slot | null>(null);
  const isBarber = me.admin.role === 'barber';
  const now = Date.now();
  const started = now >= Date.parse(b.start_at);
  const noShowReady = now >= Date.parse(b.start_at) + NO_SHOW_AFTER_MIN * 60_000;

  useEffect(() => {
    ref.current?.showModal();
  }, []);

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

  const setStatus = (status: 'confirmed' | 'completed' | 'no_show' | 'cancelled') => {
    let reason: string | null = null;
    if (status === 'cancelled') {
      reason = window.prompt('Alasan pembatalan (wajib):') ?? '';
      if (!reason.trim()) return;
    }
    void run(`Status diubah menjadi ${STATUS_LABEL[status]}.`, () => api(`/admin/bookings/${b.id}/status`, { method: 'POST', json: { status, reason } }));
  };

  const active = b.status === 'pending' || b.status === 'confirmed';
  const dates = Array.from({ length: 15 }, (_, i) => addDays(localDate(now, b.timezone), i));
  const branchBarbers = me.barbers.filter((x) => x.branch_id === b.branch_id && x.is_active);

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-labelledby="detail-title" data-lenis-prevent>
      <div className={styles.dialogBody}>
        <div className={styles.row} style={{ justifyContent: 'space-between' }}>
          <h2 id="detail-title" className={styles.h1} style={{ margin: 0 }}>
            {b.code}
          </h2>
          <button type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} onClick={() => ref.current?.close()}>
            Tutup
          </button>
        </div>
        <span className={styles.status} data-status={b.status}>
          {STATUS_LABEL[b.status]}
        </span>
        <dl className={styles.dl} style={{ marginTop: 12 }}>
          <div><dt>Jadwal</dt><dd>{longDate(b.start_at, b.timezone)}, {clock(b.start_at, b.timezone)}–{clock(b.end_at, b.timezone)} {tzLabel(b.timezone)}</dd></div>
          <div><dt>Layanan</dt><dd>{b.service_name_snapshot} · {b.duration_snapshot} mnt · {rupiah(b.price_snapshot)}</dd></div>
          <div><dt>Hairstylist</dt><dd>{b.barber_name}</dd></div>
          <div><dt>Cabang</dt><dd>{b.branch_name}</dd></div>
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
          <div><dt>Sumber</dt><dd>{SOURCE_LABEL[b.source]} · dibuat {longDate(b.created_at, b.timezone)} {clock(b.created_at, b.timezone)}</dd></div>
          {b.customer_note && <div><dt>Catatan pelanggan</dt><dd>{b.customer_note}</dd></div>}
          {b.cancel_reason && <div><dt>Alasan batal</dt><dd>{b.cancel_reason}</dd></div>}
        </dl>

        {msg && (
          <p className={styles.alert} data-tone={msg.tone} role={msg.tone === 'error' ? 'alert' : 'status'}>
            {msg.text}
          </p>
        )}

        {active && (
          <div className={styles.row}>
            {b.status === 'pending' && !isBarber && (
              <button type="button" className={styles.btn} disabled={busy} onClick={() => setStatus('confirmed')}>
                Konfirmasi
              </button>
            )}
            {b.status === 'confirmed' && (
              <button type="button" className={styles.btn} disabled={busy || !started} title={started ? '' : 'Bisa ditandai setelah jam mulai'} onClick={() => setStatus('completed')}>
                Selesai
              </button>
            )}
            {b.status === 'confirmed' && (
              <button
                type="button"
                className={styles.btnGhost}
                disabled={busy || !noShowReady}
                title={noShowReady ? '' : `Bisa ditandai ${NO_SHOW_AFTER_MIN} menit setelah jam mulai`}
                onClick={() => setStatus('no_show')}
              >
                Tidak datang
              </button>
            )}
            {!isBarber && (
              <>
                <button type="button" className={styles.btnGhost} disabled={busy} onClick={() => setMoving((v) => !v)}>
                  Pindah jadwal
                </button>
                <button type="button" className={styles.btnDanger} disabled={busy} onClick={() => setStatus('cancelled')}>
                  Batalkan
                </button>
              </>
            )}
          </div>
        )}

        {moving && (
          <div className={styles.panel}>
            <label className={styles.control}>
              Hairstylist
              <select value={barberId} onChange={(e) => { setBarberId(Number(e.target.value)); setSlot(null); }}>
                {branchBarbers.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <SlotPicker
              branch={b.branch_id}
              service={b.service_id}
              barber={barberId}
              dates={dates}
              date={dates.includes(date) ? date : dates[0]}
              onDate={(d) => { setDate(d); setSlot(null); }}
              selected={slot?.startAt}
              onSelect={setSlot}
              endpoint="/admin/availability"
              extra={{ exclude: b.id }}
            />
            <button
              type="button"
              className={styles.btn}
              disabled={!slot || busy}
              onClick={() =>
                slot &&
                void run('Jadwal dipindah.', () => api(`/admin/bookings/${b.id}/reschedule`, { method: 'POST', json: { startAt: slot.startAt, barber: barberId } })).then(() => setMoving(false))
              }
            >
              {slot ? `Pindah ke ${clock(slot.startAt, b.timezone)}` : 'Pilih jam'}
            </button>
          </div>
        )}

        <label className={styles.control} style={{ marginTop: 12 }}>
          Catatan admin (tidak terlihat pelanggan)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </label>
        <div className={styles.row} style={{ marginTop: 8 }}>
          <button type="button" className={styles.btnGhost} disabled={busy} onClick={() => void run('Catatan disimpan.', () => api(`/admin/bookings/${b.id}/note`, { method: 'POST', json: { note } }))}>
            Simpan catatan
          </button>
        </div>
      </div>
    </dialog>
  );
}

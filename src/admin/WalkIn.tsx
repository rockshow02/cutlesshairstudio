import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/app/api';
import { clock, formatPhone, rupiah } from '@/app/format';
import { addDays, localDate } from '@shared/time';
import type { Slot } from '@shared/slots';
import { SlotPicker } from '@/booking/SlotPicker';
import { useAdmin } from './context';
import styles from './admin.module.css';

interface ServiceRow {
  id: number;
  name: string;
  category: string;
  duration_min: number;
  base_price: number;
  is_bookable: number;
  is_active: number;
  branches: { branch_id: number; price: number | null; is_active: number }[];
}
interface CustomerHit { id: string; name: string; phone: string | null; email: string | null; is_guest: number }

/** Booking walk-in / telepon: pelanggan terdaftar atau tamu (nama + nomor, tidak membuat akun login) */
export function WalkIn() {
  const me = useAdmin();
  const [branchId, setBranchId] = useState<number>(me.admin.branch_id ?? me.branches[0]?.id);
  const branch = me.branches.find((b) => b.id === branchId)!;
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [serviceId, setServiceId] = useState<number | ''>('');
  const [barber, setBarber] = useState<string>('any');
  const today = localDate(Date.now(), branch?.timezone ?? 'Asia/Jakarta');
  const dates = Array.from({ length: 15 }, (_, i) => addDays(today, i));
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [mode, setMode] = useState<'guest' | 'registered'>('guest');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [customer, setCustomer] = useState<CustomerHit | null>(null);
  const [source, setSource] = useState<'walk_in' | 'admin'>('walk_in');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api<{ services: ServiceRow[] }>('/admin/services').then((r) => setServices(r.services)).catch((e) => setMsg({ tone: 'error', text: errorMessage(e) }));
  }, []);

  const available = services.filter((s) => s.is_active && s.is_bookable && s.branches.some((b) => b.branch_id === branchId && b.is_active));
  const service = available.find((s) => s.id === serviceId);
  const price = service ? service.branches.find((b) => b.branch_id === branchId)?.price ?? service.base_price : 0;

  const search = async () => {
    if (query.trim().length < 2) return;
    const r = await api<{ customers: CustomerHit[] }>(`/admin/customers?q=${encodeURIComponent(query)}`).catch(() => ({ customers: [] }));
    setHits(r.customers);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!service || !slot) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ booking: { code: string } }>('/admin/bookings', {
        method: 'POST',
        json: {
          branch: branchId,
          service: service.id,
          barber,
          startAt: slot.startAt,
          source,
          note: note || null,
          ...(mode === 'registered' && customer ? { customerId: customer.id } : { guestName, guestPhone }),
        },
      });
      setMsg({ tone: 'ok', text: `Booking ${r.booking.code} dibuat untuk ${clock(slot.startAt, branch.timezone)}.` });
      setSlot(null);
      setGuestName('');
      setGuestPhone('');
      setCustomer(null);
      setNote('');
      setReload((n) => n + 1);
    } catch (err) {
      setMsg({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const barbers = me.barbers.filter((b) => b.branch_id === branchId && b.is_active);

  return (
    <form onSubmit={submit} aria-labelledby="walkin-title">
      <h1 id="walkin-title" className={styles.h1}>
        Booking baru (walk-in / telepon)
      </h1>
      {msg && (
        <p className={styles.alert} data-tone={msg.tone} role={msg.tone === 'error' ? 'alert' : 'status'}>
          {msg.text}
        </p>
      )}
      <div className={styles.panel}>
        <div className={styles.grid2}>
          {me.admin.role === 'owner' && (
            <label className={styles.control}>
              Cabang
              <select value={branchId} onChange={(e) => { setBranchId(Number(e.target.value)); setSlot(null); }}>
                {me.branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className={styles.control}>
            Layanan
            <select value={serviceId} onChange={(e) => { setServiceId(e.target.value ? Number(e.target.value) : ''); setSlot(null); }} required>
              <option value="">Pilih layanan</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.duration_min} mnt
                </option>
              ))}
            </select>
          </label>
          <label className={styles.control}>
            Hairstylist
            <select value={barber} onChange={(e) => { setBarber(e.target.value); setSlot(null); }}>
              <option value="any">Siapa saja (paling sedikit booking)</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
          <label className={styles.control}>
            Sumber
            <select value={source} onChange={(e) => setSource(e.target.value as 'walk_in' | 'admin')}>
              <option value="walk_in">Walk-in (datang langsung)</option>
              <option value="admin">Telepon / WhatsApp</option>
            </select>
          </label>
        </div>
        {service && <p className={styles.muted}>Harga di cabang ini: {rupiah(price)}</p>}
      </div>

      {service && (
        <div className={styles.panel}>
          <SlotPicker
            branch={branchId}
            service={service.id}
            barber={barber === 'any' ? undefined : barber}
            dates={dates}
            date={date}
            onDate={(d) => { setDate(d); setSlot(null); }}
            selected={slot?.startAt}
            onSelect={setSlot}
            endpoint="/admin/availability"
            reloadKey={reload}
          />
        </div>
      )}

      <div className={styles.panel}>
        <div className={styles.seg} role="group" aria-label="Jenis pelanggan" style={{ marginBottom: 12 }}>
          <button type="button" aria-pressed={mode === 'guest'} onClick={() => setMode('guest')}>Tamu (tanpa akun)</button>
          <button type="button" aria-pressed={mode === 'registered'} onClick={() => setMode('registered')}>Pelanggan terdaftar</button>
        </div>
        {mode === 'guest' ? (
          <div className={styles.grid2}>
            <label className={styles.control}>
              Nama tamu
              <input value={guestName} onChange={(e) => setGuestName(e.target.value)} required minLength={2} />
            </label>
            <label className={styles.control}>
              Nomor WhatsApp
              <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} inputMode="tel" required placeholder="0812…" />
            </label>
          </div>
        ) : (
          <>
            <div className={styles.toolbar}>
              <label className={styles.control}>
                Cari nama / nomor / email
                <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void search())} />
              </label>
              <button type="button" className={styles.btnGhost} onClick={search}>Cari</button>
            </div>
            {customer ? (
              <p className={styles.alert}>
                Dipilih: <strong>{customer.name}</strong> {customer.phone ? `· ${formatPhone(customer.phone)}` : ''}{' '}
                <button type="button" className={styles.link} style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={() => setCustomer(null)}>ganti</button>
              </p>
            ) : (
              <ul className={styles.cards}>
                {hits.map((h) => (
                  <li key={h.id}>
                    <button type="button" className={styles.card} onClick={() => setCustomer(h)}>
                      <strong>{h.name || '(tanpa nama)'}</strong> {h.phone ? `· ${formatPhone(h.phone)}` : ''} {h.email ? `· ${h.email}` : ''} {h.is_guest ? '· tamu' : ''}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <label className={styles.control} style={{ marginTop: 12 }}>
          Catatan admin
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </label>
      </div>

      <button type="submit" className={styles.btn} disabled={busy || !service || !slot || (mode === 'registered' && !customer)}>
        {busy ? 'Menyimpan…' : slot ? `Buat booking ${clock(slot.startAt, branch.timezone)}` : 'Pilih jam dulu'}
      </button>
    </form>
  );
}

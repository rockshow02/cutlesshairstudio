import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/app/api';
import { clock, formatPhone, rupiah } from '@/app/format';
import { addDays, localDate } from '@shared/time';
import type { Slot } from '@shared/slots';
import { SlotPicker } from '@/booking/SlotPicker';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { Field, FieldGrid, Input, Select, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/toastContext';
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
  const toast = useToast();
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
  const [hits, setHits] = useState<CustomerHit[] | null>(null);
  const [moreHits, setMoreHits] = useState(false);
  const [customer, setCustomer] = useState<CustomerHit | null>(null);
  const [source, setSource] = useState<'walk_in' | 'admin'>('walk_in');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api<{ services: ServiceRow[] }>('/admin/services').then((r) => setServices(r.services)).catch((e) => setError(errorMessage(e)));
  }, []);

  const available = services.filter((s) => s.is_active && s.is_bookable && s.branches.some((b) => b.branch_id === branchId && b.is_active));
  const service = available.find((s) => s.id === serviceId);
  const price = service ? service.branches.find((b) => b.branch_id === branchId)?.price ?? service.base_price : 0;

  const search = async () => {
    if (query.trim().length < 2) return;
    const r = await api<{ customers: CustomerHit[]; nextCursor?: string | null }>(`/admin/customers?q=${encodeURIComponent(query)}`).catch(() => ({ customers: [], nextCursor: null }));
    setHits(r.customers);
    setMoreHits(Boolean(r.nextCursor));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!service || !slot) return;
    setBusy(true);
    setError('');
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
      toast(`Booking ${r.booking.code} dibuat untuk ${clock(slot.startAt, branch.timezone)}.`);
      setSlot(null);
      setGuestName('');
      setGuestPhone('');
      setCustomer(null);
      setNote('');
      setReload((n) => n + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const barbers = me.barbers.filter((b) => b.branch_id === branchId && b.is_active);

  return (
    <form onSubmit={submit} aria-labelledby="walkin-title" className={styles.stack}>
      <PageHeader titleId="walkin-title" title="Booking baru" description="Untuk pelanggan walk-in atau yang booking lewat telepon/WhatsApp. Tamu tidak dibuatkan akun login." />
      {error && <Alert tone="danger">{error}</Alert>}

      <Card tone="outline" as="section">
        <h2 className={styles.panelTitle}>
          1. Layanan & hairstylist
        </h2>
        <FieldGrid>
          {me.admin.role === 'owner' && (
            <Field label="Cabang">
              <Select
                value={branchId}
                onChange={(e) => {
                  setBranchId(Number(e.target.value));
                  setSlot(null);
                }}
              >
                {me.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Layanan" hint={service ? `Harga di cabang ini: ${rupiah(price)}` : undefined}>
            <Select
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value ? Number(e.target.value) : '');
                setSlot(null);
              }}
              required
            >
              <option value="">Pilih layanan</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.duration_min} mnt
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Hairstylist">
            <Select
              value={barber}
              onChange={(e) => {
                setBarber(e.target.value);
                setSlot(null);
              }}
            >
              <option value="any">Siapa saja (paling sedikit booking)</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sumber">
            <Select value={source} onChange={(e) => setSource(e.target.value as 'walk_in' | 'admin')}>
              <option value="walk_in">Walk-in (datang langsung)</option>
              <option value="admin">Telepon / WhatsApp</option>
            </Select>
          </Field>
        </FieldGrid>
      </Card>

      <Card tone="outline" as="section">
        <h2 className={styles.panelTitle}>
          2. Waktu
        </h2>
        {service ? (
          <SlotPicker
            branch={branchId}
            service={service.id}
            barber={barber === 'any' ? undefined : barber}
            dates={dates}
            date={date}
            onDate={(d) => {
              setDate(d);
              setSlot(null);
            }}
            selected={slot?.startAt}
            onSelect={setSlot}
            endpoint="/admin/availability"
            reloadKey={reload}
          />
        ) : (
          <EmptyState icon="clock" title="Pilih layanan dulu" compact>
            Jam yang tersedia muncul setelah layanan dipilih.
          </EmptyState>
        )}
      </Card>

      <Card tone="outline" as="section">
        <h2 className={styles.panelTitle}>
          3. Pelanggan
        </h2>
        <div className={styles.segRow}>
          <SegmentedControl
            label="Jenis pelanggan"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'guest', label: 'Tamu (tanpa akun)' },
              { value: 'registered', label: 'Pelanggan terdaftar' },
            ]}
          />
        </div>
        {mode === 'guest' ? (
          <FieldGrid>
            <Field label="Nama tamu">
              <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} required minLength={2} />
            </Field>
            <Field label="Nomor WhatsApp">
              <Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} inputMode="tel" required placeholder="0812…" />
            </Field>
          </FieldGrid>
        ) : customer ? (
          <div className={`${styles.subPanel} ${styles.picked}`}>
            <span>
              <strong>{customer.name || '(tanpa nama)'}</strong>
              {customer.phone ? ` · ${formatPhone(customer.phone)}` : ''}
            </span>
            <Button variant="text" casing="normal" size="sm" onClick={() => setCustomer(null)}>
              Ganti
            </Button>
          </div>
        ) : (
          <>
            <div className={styles.searchRow}>
              <Field label="Cari nama / nomor / email" flush>
                <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void search())} />
              </Field>
              <Button variant="outline-dark" casing="normal" icon="search" onClick={search}>
                Cari
              </Button>
            </div>
            {hits &&
              (hits.length === 0 ? (
                <p className={styles.muted}>Tidak ada pelanggan yang cocok.</p>
              ) : (
                <ul className={styles.hits}>
                  {hits.map((h) => (
                    <li key={h.id}>
                      <button type="button" className={styles.hit} onClick={() => setCustomer(h)}>
                        <strong>{h.name || '(tanpa nama)'}</strong>
                        <span className={styles.hitMeta}>{[h.phone && formatPhone(h.phone), h.email, h.is_guest ? 'tamu' : null].filter(Boolean).join(' · ')}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
            {moreHits && <p className={styles.muted}>Menampilkan 20 hasil teratas. Ketik nama atau nomor lebih lengkap untuk mempersempit.</p>}
          </>
        )}
        <Field label="Catatan admin">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} />
        </Field>
      </Card>

      <div className={styles.submitRow}>
        <Button type="submit" variant="dark" casing="normal" size="lg" disabled={busy || !service || !slot || (mode === 'registered' && !customer)}>
          {busy ? 'Menyimpan…' : slot ? `Buat booking ${clock(slot.startAt, branch.timezone)}` : 'Pilih jam dulu'}
        </Button>
      </div>
    </form>
  );
}

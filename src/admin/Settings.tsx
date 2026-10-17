import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/app/api';
import { formatPhone, rupiah } from '@/app/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert, EmptyState, SkeletonList } from '@/components/ui/Feedback';
import { Checkbox, Field, FieldGrid, Input, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useConfirm } from '@/components/ui/useConfirm';
import { useToast } from '@/components/ui/toastContext';
import { DAYS, ROLE_LABEL, useAdmin } from './context';
import styles from './admin.module.css';

type Msg = { tone: 'ok' | 'error'; text: string } | null;
type Sub = 'cabang' | 'hairstylist' | 'layanan' | 'admin';

/** "10:00-13:00, 14:00-21:00" ⇄ [{start,end}] */
const rangesToText = (r: { start: string; end: string }[]) => r.map((x) => `${x.start}-${x.end}`).join(', ');
function textToRanges(text: string): { start: string; end: string }[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.replace(/\./g, ':').match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/);
      if (!m) throw new Error(`Format jam "${s}" tidak dikenali. Contoh: 10:00-13:00, 14:00-21:00`);
      const pad = (t: string) => t.padStart(5, '0');
      return { start: pad(m[1]), end: pad(m[2]) };
    });
}

export function Settings() {
  const me = useAdmin();
  const subs: { id: Sub; label: string }[] = [
    { id: 'cabang', label: 'Cabang' },
    { id: 'hairstylist', label: 'Hairstylist & jam kerja' },
    { id: 'layanan', label: 'Layanan & harga' },
    ...(me.admin.role === 'owner' ? [{ id: 'admin' as Sub, label: 'Akun admin' }] : []),
  ];
  const [sub, setSub] = useState<Sub>('cabang');
  return (
    <section aria-labelledby="set-title">
      <PageHeader titleId="set-title" title="Pengaturan" description="Cabang, jam kerja hairstylist, harga layanan, dan akun admin." />
      <div className={styles.segRow}>
        <SegmentedControl label="Bagian pengaturan" value={sub} onChange={setSub} options={subs.map((s) => ({ value: s.id, label: s.label }))} wrap />
      </div>
      {sub === 'cabang' && <Branches />}
      {sub === 'hairstylist' && <Barbers />}
      {sub === 'layanan' && <Services />}
      {sub === 'admin' && <AdminUsers />}
    </section>
  );
}

/** Pesan gagal tetap di halaman; pesan sukses lewat toast */
function Note({ msg }: { msg: Msg }) {
  return msg ? (
    <Alert tone={msg.tone === 'error' ? 'danger' : 'success'} role={msg.tone === 'error' ? 'alert' : 'status'}>
      {msg.text}
    </Alert>
  ) : null;
}

/** Callback simpan: sukses → toast, gagal → Alert */
function useSaved(setMsg: (m: Msg) => void, reload?: () => void) {
  const toast = useToast();
  return {
    onSaved: (t: string) => {
      setMsg(null);
      toast(t);
      reload?.();
    },
    onError: (t: string) => setMsg({ tone: 'error', text: t }),
  };
}

/* ---------- Cabang ---------- */

interface BranchRow {
  id: number;
  slug: string;
  name: string;
  city: string;
  province: string;
  address: string | null;
  maps_url: string | null;
  lat: number | null;
  lng: number | null;
  whatsapp: string;
  timezone: string;
  status: 'active' | 'coming_soon' | 'closed';
  photo: string | null;
  sort_order: number;
  booking_lead_min: number;
  booking_max_days: number;
  cancel_deadline_min: number;
  require_manual_confirmation: number;
  telegram_chat_id: string | null;
  hours: { weekday: number; open_time: string; close_time: string }[];
}

function Branches() {
  const me = useAdmin();
  const [rows, setRows] = useState<BranchRow[] | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const load = useCallback(() => {
    api<{ branches: BranchRow[] }>('/admin/branches').then((r) => setRows(r.branches)).catch((e) => setMsg({ tone: 'error', text: errorMessage(e) }));
  }, []);
  useEffect(load, [load]);
  const saved = useSaved(setMsg, load);
  if (!rows) return <SkeletonList label="Memuat cabang…" count={2} height={160} />;
  return (
    <div className={styles.stack}>
      <Note msg={msg} />
      {rows.map((b) => (
        <BranchForm key={b.id} branch={b} isOwner={me.admin.role === 'owner'} {...saved} />
      ))}
      {me.admin.role === 'owner' && <NewBranch {...saved} />}
    </div>
  );
}

function BranchForm({ branch: b, isOwner, onSaved, onError }: { branch: BranchRow; isOwner: boolean; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const [lead, setLead] = useState(b.booking_lead_min);
  const [maxDays, setMaxDays] = useState(b.booking_max_days);
  const [cancelH, setCancelH] = useState(b.cancel_deadline_min / 60);
  const [manual, setManual] = useState(Boolean(b.require_manual_confirmation));
  const [telegram, setTelegram] = useState(b.telegram_chat_id ?? '');
  const [hours, setHours] = useState<string[]>(() => DAYS.map((_, d) => {
    const h = b.hours.find((x) => x.weekday === d);
    return h ? `${h.open_time}-${h.close_time}` : '';
  }));
  const [info, setInfo] = useState({ name: b.name, city: b.city, province: b.province, address: b.address ?? '', maps_url: b.maps_url ?? '', whatsapp: formatPhone(b.whatsapp), status: b.status, timezone: b.timezone, photo: b.photo ?? '', sort_order: b.sort_order });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const parsed = hours.flatMap((t, weekday) => {
        const r = textToRanges(t);
        if (r.length > 1) throw new Error(`${DAYS[weekday]}: jam buka cabang hanya satu rentang (istirahat diatur di jam kerja hairstylist).`);
        return r.map((x) => ({ weekday, open: x.start, close: x.end }));
      });
      await api(`/admin/branches/${b.id}/settings`, {
        method: 'PUT',
        json: { booking_lead_min: lead, booking_max_days: maxDays, cancel_deadline_min: Math.round(cancelH * 60), require_manual_confirmation: manual, telegram_chat_id: telegram || null, hours: parsed },
      });
      if (isOwner) await api(`/admin/branches/${b.id}`, { method: 'PUT', json: { ...info, slug: b.slug, lat: b.lat, lng: b.lng } });
      onSaved(`Pengaturan ${b.name} tersimpan.`);
    } catch (err) {
      onError(errorMessage(err));
    }
  };

  return (
    <Card tone="outline" as="form" onSubmit={save}>
      <div className={styles.cardHead}>
        <h2 className={styles.panelTitle}>{b.name}</h2>
        <Badge tone={b.status === 'active' ? 'success' : b.status === 'coming_soon' ? 'warning' : 'neutral'}>
          {b.status === 'active' ? 'Aktif' : b.status === 'coming_soon' ? 'Segera dibuka' : 'Tutup sementara'}
        </Badge>
      </div>
      <h3 className={styles.sectionLabel}>Aturan booking</h3>
      <FieldGrid>
        <Field label="Booking paling cepat" hint="Menit dari sekarang">
          <Input type="number" min={0} value={lead} onChange={(e) => setLead(Number(e.target.value))} />
        </Field>
        <Field label="Booking paling jauh" hint="Hari ke depan (maks. 90)">
          <Input type="number" min={1} max={90} value={maxDays} onChange={(e) => setMaxDays(Number(e.target.value))} />
        </Field>
        <Field label="Batas batal/ubah online" hint="Jam sebelum jadwal">
          <Input type="number" min={0} step={0.5} value={cancelH} onChange={(e) => setCancelH(Number(e.target.value))} />
        </Field>
        <Field label="ID grup Telegram (opsional)">
          <Input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="-1001234567890" />
        </Field>
      </FieldGrid>
      <Checkbox checked={manual} onChange={(e) => setManual(e.target.checked)} className={styles.checkRow}>
        Konfirmasi manual (booking online berstatus "Menunggu konfirmasi")
      </Checkbox>
      <h3 className={styles.sectionLabel}>Jam buka per hari (kosong = tutup), contoh 10:00-21:00</h3>
      <div className={styles.hours}>
        {DAYS.map((d, i) => (
          <Field key={d} label={d}>
            <Input value={hours[i]} onChange={(e) => setHours((h) => h.map((x, j) => (j === i ? e.target.value : x)))} placeholder="tutup" />
          </Field>
        ))}
      </div>
      {isOwner && (
        <>
          <h3 className={styles.sectionLabel}>Data cabang (owner)</h3>
          <FieldGrid>
            <Field label="Nama"><Input value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} /></Field>
            <Field label="Kota"><Input value={info.city} onChange={(e) => setInfo({ ...info, city: e.target.value })} /></Field>
            <Field label="Provinsi"><Input value={info.province} onChange={(e) => setInfo({ ...info, province: e.target.value })} /></Field>
            <Field label="WhatsApp cabang"><Input value={info.whatsapp} onChange={(e) => setInfo({ ...info, whatsapp: e.target.value })} /></Field>
            <Field label="Alamat"><Input value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} /></Field>
            <Field label="Link Google Maps"><Input value={info.maps_url} onChange={(e) => setInfo({ ...info, maps_url: e.target.value })} /></Field>
            <Field label="Status">
              <Select value={info.status} onChange={(e) => setInfo({ ...info, status: e.target.value as BranchRow['status'] })}>
                <option value="active">Aktif</option><option value="coming_soon">Segera dibuka</option><option value="closed">Tutup sementara</option>
              </Select>
            </Field>
            <Field label="Zona waktu">
              <Select value={info.timezone} onChange={(e) => setInfo({ ...info, timezone: e.target.value })}>
                <option value="Asia/Jakarta">WIB</option><option value="Asia/Makassar">WITA</option><option value="Asia/Jayapura">WIT</option>
              </Select>
            </Field>
          </FieldGrid>
        </>
      )}
      <div className={styles.formActions}>
        <Button type="submit" variant="dark" casing="normal">Simpan {b.name}</Button>
      </div>
    </Card>
  );
}

function NewBranch({ onSaved, onError }: { onSaved: (t: string) => void; onError: (t: string) => void }) {
  const [f, setF] = useState({ slug: '', name: '', city: '', province: '', whatsapp: '', timezone: 'Asia/Jakarta', status: 'coming_soon' });
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/admin/branches', { method: 'POST', json: { ...f, sort_order: 100 } });
      onSaved(`Cabang ${f.name} ditambahkan. Atur jam buka, hairstylist, dan harga sebelum mengubah status ke Aktif.`);
    } catch (err) {
      onError(errorMessage(err));
    }
  };
  return (
    <Card tone="outline" as="form" onSubmit={save}>
      <h2 className={styles.panelTitle}>Tambah cabang</h2>
      <FieldGrid>
        <Field label="Kode URL (slug)"><Input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder="depok-margonda" required /></Field>
        <Field label="Nama"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <Field label="Kota"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} required /></Field>
        <Field label="Provinsi"><Input value={f.province} onChange={(e) => setF({ ...f, province: e.target.value })} /></Field>
        <Field label="WhatsApp cabang"><Input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} required /></Field>
      </FieldGrid>
      <div className={styles.formActions}>
        <Button type="submit" variant="outline-dark" casing="normal" icon="plus">Tambah cabang</Button>
      </div>
    </Card>
  );
}

/* ---------- Hairstylist ---------- */

interface BarberRow {
  id: number;
  branch_id: number;
  name: string;
  role: string | null;
  photo: string | null;
  specialty: string | null;
  instagram: string | null;
  is_active: number;
  sort_order: number;
  services: number[];
  working: { weekday: number; start: string; end: string }[];
}
interface ServiceRow {
  id: number;
  name: string;
  category: string;
  description: string | null;
  duration_min: number;
  buffer_min: number;
  base_price: number;
  price_from: number;
  badge: string | null;
  is_bookable: number;
  is_active: number;
  sort_order: number;
  branches: { branch_id: number; price: number | null; is_active: number }[];
}

function Barbers() {
  const me = useAdmin();
  const [rows, setRows] = useState<BarberRow[] | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [msg, setMsg] = useState<Msg>(null);
  const [editing, setEditing] = useState<BarberRow | 'new' | null>(null);
  const load = useCallback(() => {
    api<{ barbers: BarberRow[] }>('/admin/barbers').then((r) => setRows(r.barbers)).catch((e) => setMsg({ tone: 'error', text: errorMessage(e) }));
    api<{ services: ServiceRow[] }>('/admin/services').then((r) => setServices(r.services.filter((s) => s.is_bookable))).catch(() => undefined);
  }, []);
  useEffect(load, [load]);
  const toast = useToast();
  if (!rows) return <SkeletonList label="Memuat hairstylist…" count={3} height={56} />;
  if (editing) {
    return (
      <BarberForm
        barber={editing === 'new' ? undefined : editing}
        defaultBranch={me.admin.branch_id ?? me.branches[0].id}
        services={services}
        onDone={(t) => { setEditing(null); setMsg(null); if (t) toast(t); load(); }}
      />
    );
  }
  return (
    <>
      <Note msg={msg} />
      <div className={styles.listHead}>
        <p className={styles.muted}>{rows.length} hairstylist</p>
        <Button variant="dark" casing="normal" size="sm" icon="plus" onClick={() => setEditing('new')}>Tambah hairstylist</Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="user" title="Belum ada hairstylist" />
      ) : (
      <div className={styles.tableWrap} data-stack>
        <table className={styles.table}>
          <thead><tr><th>Nama</th><th>Cabang</th><th>Status</th><th>Layanan</th><th>Jam kerja</th><th><span className="visually-hidden">Aksi</span></th></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td data-label="Nama"><span className={styles.cellMain}>{b.name}</span>{b.role ? <span className={styles.cellSub}>{b.role}</span> : null}</td>
                <td data-label="Cabang">{me.branches.find((x) => x.id === b.branch_id)?.name}</td>
                <td data-label="Status">{b.is_active ? <Badge tone="success">Aktif</Badge> : <Badge>Nonaktif</Badge>}</td>
                <td data-label="Layanan">{b.services.length} layanan</td>
                <td data-label="Jam kerja">{DAYS.map((d, i) => { const w = b.working.filter((x) => x.weekday === i); return w.length ? `${d.slice(0, 3)} ${rangesToText(w)}` : null; }).filter(Boolean).join(' · ') || 'Belum diatur'}</td>
                <td data-label=""><Button variant="outline-dark" casing="normal" size="sm" onClick={() => setEditing(b)}>Ubah</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </>
  );
}

function BarberForm({ barber, defaultBranch, services, onDone }: { barber?: BarberRow; defaultBranch: number; services: ServiceRow[]; onDone: (msg?: string) => void }) {
  const me = useAdmin();
  const [f, setF] = useState({
    branch_id: barber?.branch_id ?? defaultBranch,
    name: barber?.name ?? '',
    role: barber?.role ?? '',
    photo: barber?.photo ?? '',
    specialty: barber?.specialty ?? '',
    instagram: barber?.instagram ?? '',
    is_active: barber ? Boolean(barber.is_active) : true,
    sort_order: barber?.sort_order ?? 100,
  });
  const [svc, setSvc] = useState<number[]>(barber?.services ?? services.map((s) => s.id));
  const [work, setWork] = useState<string[]>(() => DAYS.map((_, d) => rangesToText((barber?.working ?? []).filter((w) => w.weekday === d))));
  const [error, setError] = useState('');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const working = work.flatMap((t, weekday) => textToRanges(t).map((r) => ({ weekday, ...r })));
      const body = { ...f, role: f.role || null, photo: f.photo || null, specialty: f.specialty || null, instagram: f.instagram || null, services: svc, working };
      if (barber) await api(`/admin/barbers/${barber.id}`, { method: 'PUT', json: body });
      else await api('/admin/barbers', { method: 'POST', json: body });
      onDone(`Data ${f.name} tersimpan.`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Card tone="outline" as="form" onSubmit={save}>
      <h2 className={styles.panelTitle}>{barber ? `Ubah ${barber.name}` : 'Tambah hairstylist'}</h2>
      <Note msg={error ? { tone: 'error', text: error } : null} />
      <FieldGrid>
        {me.admin.role === 'owner' && (
          <Field label="Cabang">
            <Select value={f.branch_id} onChange={(e) => setF({ ...f, branch_id: Number(e.target.value) })}>
              {me.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Nama panggilan"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <Field label="Jabatan"><Input value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder="Senior Hairstylist" /></Field>
        <Field label="Spesialisasi"><Input value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} placeholder="Skin fade, Pompadour" /></Field>
        <Field label="Foto" hint="Path, mis. /uploads/barbers/dimas.webp"><Input value={f.photo} onChange={(e) => setF({ ...f, photo: e.target.value })} /></Field>
        <Field label="Urutan tampil"><Input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} /></Field>
      </FieldGrid>
      <Checkbox checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} className={styles.checkRow}>
        Aktif (bisa dibooking & tampil di website)
      </Checkbox>
      <h3 className={styles.sectionLabel}>Layanan yang bisa dikerjakan</h3>
      <div className={styles.checkList}>
        {services.map((s) => (
          <Checkbox key={s.id} checked={svc.includes(s.id)} onChange={(e) => setSvc((v) => (e.target.checked ? [...v, s.id] : v.filter((x) => x !== s.id)))}>
            {s.name}
          </Checkbox>
        ))}
      </div>
      <h3 className={styles.sectionLabel}>Jam kerja per hari (kosong = libur). Beberapa rentang dipisah koma, mis. 10:00-13:00, 14:00-21:00</h3>
      <div className={styles.hours}>
        {DAYS.map((d, i) => (
          <Field key={d} label={d}><Input value={work[i]} onChange={(e) => setWork((w) => w.map((x, j) => (j === i ? e.target.value : x)))} placeholder="libur" /></Field>
        ))}
      </div>
      <div className={styles.formActions}>
        <Button type="submit" variant="dark" casing="normal">Simpan</Button>
        <Button variant="text" casing="normal" onClick={() => onDone()}>Batal</Button>
      </div>
    </Card>
  );
}

/* ---------- Layanan & harga ---------- */

function Services() {
  const me = useAdmin();
  const isOwner = me.admin.role === 'owner';
  const [rows, setRows] = useState<ServiceRow[] | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [branchId, setBranchId] = useState<number>(me.admin.branch_id ?? me.branches[0].id);
  const load = useCallback(() => {
    api<{ services: ServiceRow[] }>('/admin/services').then((r) => setRows(r.services)).catch((e) => setMsg({ tone: 'error', text: errorMessage(e) }));
  }, []);
  useEffect(load, [load]);

  const toast = useToast();
  const saveService = async (s: ServiceRow) => {
    try {
      await api(`/admin/services/${s.id}`, {
        method: 'PUT',
        json: { name: s.name, category: s.category, description: s.description, duration_min: s.duration_min, buffer_min: s.buffer_min, base_price: s.base_price, price_from: Boolean(s.price_from), badge: s.badge, is_bookable: Boolean(s.is_bookable), is_active: Boolean(s.is_active), sort_order: s.sort_order },
      });
      setMsg(null);
      toast(`${s.name} tersimpan.`);
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  };
  const saveBranchPrice = async (s: ServiceRow, price: string, active: boolean) => {
    try {
      await api(`/admin/services/${s.id}/branches/${branchId}`, { method: 'PUT', json: { price: price.trim() === '' ? null : Number(price), is_active: active } });
      setMsg(null);
      toast(`Harga ${s.name} di cabang tersimpan.`);
      load();
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  };
  const update = (id: number, patch: Partial<ServiceRow>) => setRows((r) => r && r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  if (!rows) return <SkeletonList label="Memuat layanan…" count={4} height={56} />;
  return (
    <>
      <Note msg={msg} />
      <div className={styles.listHead}>
        <Field label="Harga khusus untuk cabang" flush>
          <Select className={styles.selectSm} value={branchId} onChange={(e) => setBranchId(Number(e.target.value))} disabled={!isOwner}>
            {me.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
      </div>
      <div className={styles.tableWrap} data-stack>
        <table className={styles.table}>
          <thead>
            <tr><th>Layanan</th><th>Durasi (mnt)</th><th>Buffer</th><th>Harga dasar</th><th>Aktif</th><th>Harga cabang</th><th>Di cabang</th><th><span className="visually-hidden">Aksi</span></th></tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const bp = s.branches.find((x) => x.branch_id === branchId);
              return (
                <ServiceLine key={s.id} s={s} bp={bp} isOwner={isOwner} onChange={(p) => update(s.id, p)} onSave={() => saveService(s)} onSaveBranch={saveBranchPrice} />
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={`${styles.muted} ${styles.exportNote}`}>Durasi & buffer menentukan jam yang tersedia. Harga cabang kosong = memakai harga dasar. Layanan kategori Paket tampil di daftar harga saja (tidak dibooking per jam).</p>
    </>
  );
}

function ServiceLine({ s, bp, isOwner, onChange, onSave, onSaveBranch }: {
  s: ServiceRow;
  bp?: { price: number | null; is_active: number };
  isOwner: boolean;
  onChange: (p: Partial<ServiceRow>) => void;
  onSave: () => void;
  onSaveBranch: (s: ServiceRow, price: string, active: boolean) => void;
}) {
  const [price, setPrice] = useState(bp?.price != null ? String(bp.price) : '');
  const [active, setActive] = useState(bp ? Boolean(bp.is_active) : true);
  useEffect(() => {
    setPrice(bp?.price != null ? String(bp.price) : '');
    setActive(bp ? Boolean(bp.is_active) : true);
  }, [bp?.price, bp?.is_active]);
  return (
    <tr>
      <td data-label="Layanan">
        {isOwner ? <input className={styles.tableInput} aria-label={`Nama layanan ${s.name}`} value={s.name} onChange={(e) => onChange({ name: e.target.value })} /> : <span className={styles.cellMain}>{s.name}</span>}
        <span className={styles.cellSub}>{s.category}{s.is_bookable ? '' : ' · paket'}</span>
      </td>
      <td data-label="Durasi (mnt)">{isOwner ? <input className={styles.tableInput} aria-label={`Durasi ${s.name}`} type="number" value={s.duration_min} onChange={(e) => onChange({ duration_min: Number(e.target.value) })} /> : s.duration_min}</td>
      <td data-label="Buffer (mnt)">{isOwner ? <input className={styles.tableInput} aria-label={`Buffer ${s.name}`} type="number" value={s.buffer_min} onChange={(e) => onChange({ buffer_min: Number(e.target.value) })} /> : s.buffer_min}</td>
      <td data-label="Harga dasar">{isOwner ? <input className={styles.tableInput} aria-label={`Harga dasar ${s.name}`} type="number" value={s.base_price} onChange={(e) => onChange({ base_price: Number(e.target.value) })} /> : rupiah(s.base_price)}</td>
      <td data-label="Aktif">{isOwner ? <input type="checkbox" aria-label={`${s.name} aktif`} checked={Boolean(s.is_active)} onChange={(e) => onChange({ is_active: e.target.checked ? 1 : 0 })} /> : s.is_active ? 'Ya' : 'Tidak'}</td>
      <td data-label="Harga cabang"><input className={styles.tableInput} aria-label={`Harga ${s.name} di cabang`} type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={String(s.base_price)} /></td>
      <td data-label="Di cabang"><input type="checkbox" aria-label={`${s.name} tersedia di cabang`} checked={active} onChange={(e) => setActive(e.target.checked)} /></td>
      <td data-label="">
        <span className={styles.row}>
          {isOwner && <Button variant="dark" casing="normal" size="sm" onClick={onSave}>Simpan</Button>}
          <Button variant="outline-dark" casing="normal" size="sm" onClick={() => onSaveBranch(s, price, active)}>Simpan cabang</Button>
        </span>
      </td>
    </tr>
  );
}

/* ---------- Akun admin (owner) ---------- */

interface AdminUserRow { email: string; name: string | null; role: 'owner' | 'branch_admin' | 'barber'; branch_id: number | null; barber_id: number | null; is_active: number }

function AdminUsers() {
  const me = useAdmin();
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [f, setF] = useState({ email: '', name: '', role: 'branch_admin' as AdminUserRow['role'], branch_id: me.branches[0]?.id ?? 0, barber_id: 0, is_active: true });
  const load = useCallback(() => {
    api<{ users: AdminUserRow[] }>('/admin/admin-users').then((r) => setRows(r.users)).catch((e) => setMsg({ tone: 'error', text: errorMessage(e) }));
  }, []);
  useEffect(load, [load]);
  const toast = useToast();
  const [dialog, confirm] = useConfirm();
  const save = async (u: typeof f) => {
    try {
      await api('/admin/admin-users', { method: 'PUT', json: { ...u, name: u.name || null, branch_id: u.role === 'owner' ? null : u.branch_id, barber_id: u.role === 'barber' ? u.barber_id : null } });
      setMsg(null);
      toast(`Akun ${u.email} tersimpan. Tambahkan juga email ini ke kebijakan Cloudflare Access.`);
      load();
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  };
  const barbers = me.barbers.filter((b) => b.branch_id === f.branch_id);
  return (
    <>
      <Note msg={msg} />
      <Card tone="outline" as="form" onSubmit={(e) => { e.preventDefault(); void save(f); }}>
        <h2 className={styles.panelTitle}>Tambah / ubah akun admin</h2>
        <FieldGrid>
          <Field label="Email" hint="Dipakai untuk login Cloudflare Access"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
          <Field label="Nama"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Peran">
            <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as AdminUserRow['role'] })}>
              <option value="owner">Owner (semua cabang)</option><option value="branch_admin">Admin cabang</option><option value="barber">Hairstylist</option>
            </Select>
          </Field>
          {f.role !== 'owner' && (
            <Field label="Cabang">
              <Select value={f.branch_id} onChange={(e) => setF({ ...f, branch_id: Number(e.target.value) })}>
                {me.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
          )}
          {f.role === 'barber' && (
            <Field label="Hairstylist">
              <Select value={f.barber_id} onChange={(e) => setF({ ...f, barber_id: Number(e.target.value) })} required>
                <option value={0}>Pilih</option>
                {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
          )}
        </FieldGrid>
        <div className={styles.formActions}>
          <Button type="submit" variant="dark" casing="normal">Simpan akun</Button>
        </div>
      </Card>
      {!rows ? (
        <SkeletonList label="Memuat akun admin…" count={2} height={56} />
      ) : (
        <div className={`${styles.tableWrap} ${styles.spaced}`} data-stack>
          <table className={styles.table}>
            <thead><tr><th>Email</th><th>Nama</th><th>Peran</th><th>Cabang</th><th>Status</th><th><span className="visually-hidden">Aksi</span></th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.email}>
                  <td data-label="Email" className={styles.cellMain}>{u.email}</td>
                  <td data-label="Nama">{u.name}</td>
                  <td data-label="Peran">{ROLE_LABEL[u.role]}</td>
                  <td data-label="Cabang">{me.branches.find((b) => b.id === u.branch_id)?.name ?? 'Semua'}</td>
                  <td data-label="Status">{u.is_active ? <Badge tone="success">Aktif</Badge> : <Badge>Nonaktif</Badge>}</td>
                  <td data-label="">
                    {u.email !== me.admin.email && (
                      <Button
                        variant={u.is_active ? 'outline-danger' : 'outline-dark'}
                        casing="normal"
                        size="sm"
                        onClick={async () => {
                          if (u.is_active) {
                            const ok = await confirm({
                              title: `Nonaktifkan ${u.email}?`,
                              message: 'Akun ini tidak bisa membuka dashboard admin sampai diaktifkan lagi. Hapus juga dari kebijakan Cloudflare Access bila perlu.',
                              confirmLabel: 'Ya, nonaktifkan',
                              cancelLabel: 'Kembali',
                            });
                            if (ok === null) return;
                          }
                          void save({ email: u.email, name: u.name ?? '', role: u.role, branch_id: u.branch_id ?? 0, barber_id: u.barber_id ?? 0, is_active: !u.is_active });
                        }}
                      >
                        {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dialog}
    </>
  );
}

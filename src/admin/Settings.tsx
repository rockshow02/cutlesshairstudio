import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/app/api';
import { formatPhone, rupiah } from '@/app/format';
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
      <h1 id="set-title" className={styles.h1}>
        Pengaturan
      </h1>
      <div className={styles.seg} role="group" aria-label="Bagian pengaturan" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {subs.map((s) => (
          <button key={s.id} type="button" aria-pressed={sub === s.id} onClick={() => setSub(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      {sub === 'cabang' && <Branches />}
      {sub === 'hairstylist' && <Barbers />}
      {sub === 'layanan' && <Services />}
      {sub === 'admin' && <AdminUsers />}
    </section>
  );
}

function Note({ msg }: { msg: Msg }) {
  return msg ? (
    <p className={styles.alert} data-tone={msg.tone} role={msg.tone === 'error' ? 'alert' : 'status'}>
      {msg.text}
    </p>
  ) : null;
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
  if (!rows) return <p className={styles.muted}>Memuat…</p>;
  return (
    <>
      <Note msg={msg} />
      {rows.map((b) => (
        <BranchForm key={b.id} branch={b} isOwner={me.admin.role === 'owner'} onSaved={(t) => { setMsg({ tone: 'ok', text: t }); load(); }} onError={(t) => setMsg({ tone: 'error', text: t })} />
      ))}
      {me.admin.role === 'owner' && <NewBranch onSaved={(t) => { setMsg({ tone: 'ok', text: t }); load(); }} onError={(t) => setMsg({ tone: 'error', text: t })} />}
    </>
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
    <form className={styles.panel} onSubmit={save}>
      <h2 className={styles.h2} style={{ marginTop: 0 }}>{b.name}</h2>
      <div className={styles.grid2}>
        <label className={styles.control}>Booking paling cepat (menit dari sekarang)<input type="number" min={0} value={lead} onChange={(e) => setLead(Number(e.target.value))} /></label>
        <label className={styles.control}>Booking paling jauh (hari ke depan)<input type="number" min={1} max={90} value={maxDays} onChange={(e) => setMaxDays(Number(e.target.value))} /></label>
        <label className={styles.control}>Batas batal/ubah online (jam sebelum jadwal)<input type="number" min={0} step={0.5} value={cancelH} onChange={(e) => setCancelH(Number(e.target.value))} /></label>
        <label className={styles.control}>ID grup Telegram (opsional)<input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="-1001234567890" /></label>
      </div>
      <label className={styles.check} style={{ margin: '12px 0' }}>
        <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> Konfirmasi manual (booking online berstatus "Menunggu konfirmasi")
      </label>
      <p className={styles.muted}>Jam buka per hari (kosong = tutup), contoh 10:00-21:00:</p>
      <div className={styles.grid2}>
        {DAYS.map((d, i) => (
          <label key={d} className={styles.control}>
            {d}
            <input value={hours[i]} onChange={(e) => setHours((h) => h.map((x, j) => (j === i ? e.target.value : x)))} placeholder="tutup" />
          </label>
        ))}
      </div>
      {isOwner && (
        <>
          <p className={styles.muted} style={{ marginTop: 12 }}>Data cabang (owner):</p>
          <div className={styles.grid2}>
            <label className={styles.control}>Nama<input value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} /></label>
            <label className={styles.control}>Kota<input value={info.city} onChange={(e) => setInfo({ ...info, city: e.target.value })} /></label>
            <label className={styles.control}>Provinsi<input value={info.province} onChange={(e) => setInfo({ ...info, province: e.target.value })} /></label>
            <label className={styles.control}>WhatsApp cabang<input value={info.whatsapp} onChange={(e) => setInfo({ ...info, whatsapp: e.target.value })} /></label>
            <label className={styles.control}>Alamat<input value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} /></label>
            <label className={styles.control}>Link Google Maps<input value={info.maps_url} onChange={(e) => setInfo({ ...info, maps_url: e.target.value })} /></label>
            <label className={styles.control}>Status
              <select value={info.status} onChange={(e) => setInfo({ ...info, status: e.target.value as BranchRow['status'] })}>
                <option value="active">Aktif</option><option value="coming_soon">Segera dibuka</option><option value="closed">Tutup sementara</option>
              </select>
            </label>
            <label className={styles.control}>Zona waktu
              <select value={info.timezone} onChange={(e) => setInfo({ ...info, timezone: e.target.value })}>
                <option value="Asia/Jakarta">WIB</option><option value="Asia/Makassar">WITA</option><option value="Asia/Jayapura">WIT</option>
              </select>
            </label>
          </div>
        </>
      )}
      <button type="submit" className={styles.btn} style={{ marginTop: 12 }}>Simpan {b.name}</button>
    </form>
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
    <form className={styles.panel} onSubmit={save}>
      <h2 className={styles.h2} style={{ marginTop: 0 }}>Tambah cabang</h2>
      <div className={styles.grid2}>
        <label className={styles.control}>Kode URL (slug)<input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder="depok-margonda" required /></label>
        <label className={styles.control}>Nama<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
        <label className={styles.control}>Kota<input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} required /></label>
        <label className={styles.control}>Provinsi<input value={f.province} onChange={(e) => setF({ ...f, province: e.target.value })} /></label>
        <label className={styles.control}>WhatsApp cabang<input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} required /></label>
      </div>
      <button type="submit" className={styles.btnGhost} style={{ marginTop: 12 }}>Tambah cabang</button>
    </form>
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
  if (!rows) return <p className={styles.muted}>Memuat…</p>;
  if (editing) {
    return (
      <BarberForm
        barber={editing === 'new' ? undefined : editing}
        defaultBranch={me.admin.branch_id ?? me.branches[0].id}
        services={services}
        onDone={(t) => { setEditing(null); if (t) setMsg({ tone: 'ok', text: t }); load(); }}
      />
    );
  }
  return (
    <>
      <Note msg={msg} />
      <button type="button" className={styles.btn} onClick={() => setEditing('new')} style={{ marginBottom: 12 }}>Tambah hairstylist</button>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Nama</th><th>Cabang</th><th>Status</th><th>Layanan</th><th>Jam kerja</th><th /></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td>{b.name}{b.role ? ` · ${b.role}` : ''}</td>
                <td>{me.branches.find((x) => x.id === b.branch_id)?.name}</td>
                <td>{b.is_active ? 'Aktif' : 'Nonaktif'}</td>
                <td>{b.services.length} layanan</td>
                <td>{DAYS.map((d, i) => { const w = b.working.filter((x) => x.weekday === i); return w.length ? `${d.slice(0, 3)} ${rangesToText(w)}` : null; }).filter(Boolean).join(' · ') || 'Belum diatur'}</td>
                <td><button type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} onClick={() => setEditing(b)}>Ubah</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    <form className={styles.panel} onSubmit={save}>
      <h2 className={styles.h2} style={{ marginTop: 0 }}>{barber ? `Ubah ${barber.name}` : 'Tambah hairstylist'}</h2>
      <Note msg={error ? { tone: 'error', text: error } : null} />
      <div className={styles.grid2}>
        {me.admin.role === 'owner' && (
          <label className={styles.control}>Cabang
            <select value={f.branch_id} onChange={(e) => setF({ ...f, branch_id: Number(e.target.value) })}>
              {me.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        )}
        <label className={styles.control}>Nama panggilan<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
        <label className={styles.control}>Jabatan<input value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder="Senior Hairstylist" /></label>
        <label className={styles.control}>Spesialisasi<input value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} placeholder="Skin fade, Pompadour" /></label>
        <label className={styles.control}>Foto (path, mis. /uploads/barbers/dimas.webp)<input value={f.photo} onChange={(e) => setF({ ...f, photo: e.target.value })} /></label>
        <label className={styles.control}>Urutan tampil<input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} /></label>
      </div>
      <label className={styles.check} style={{ margin: '12px 0' }}>
        <input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Aktif (bisa dibooking & tampil di website)
      </label>
      <p className={styles.muted}>Layanan yang bisa dikerjakan:</p>
      <div className={styles.checkList}>
        {services.map((s) => (
          <label key={s.id} className={styles.check}>
            <input type="checkbox" checked={svc.includes(s.id)} onChange={(e) => setSvc((v) => (e.target.checked ? [...v, s.id] : v.filter((x) => x !== s.id)))} /> {s.name}
          </label>
        ))}
      </div>
      <p className={styles.muted}>Jam kerja per hari (kosong = libur). Beberapa rentang dipisah koma, mis. 10:00-13:00, 14:00-21:00</p>
      <div className={styles.grid2}>
        {DAYS.map((d, i) => (
          <label key={d} className={styles.control}>{d}<input value={work[i]} onChange={(e) => setWork((w) => w.map((x, j) => (j === i ? e.target.value : x)))} placeholder="libur" /></label>
        ))}
      </div>
      <div className={styles.row} style={{ marginTop: 12 }}>
        <button type="submit" className={styles.btn}>Simpan</button>
        <button type="button" className={styles.btnGhost} onClick={() => onDone()}>Batal</button>
      </div>
    </form>
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

  const saveService = async (s: ServiceRow) => {
    try {
      await api(`/admin/services/${s.id}`, {
        method: 'PUT',
        json: { name: s.name, category: s.category, description: s.description, duration_min: s.duration_min, buffer_min: s.buffer_min, base_price: s.base_price, price_from: Boolean(s.price_from), badge: s.badge, is_bookable: Boolean(s.is_bookable), is_active: Boolean(s.is_active), sort_order: s.sort_order },
      });
      setMsg({ tone: 'ok', text: `${s.name} tersimpan.` });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  };
  const saveBranchPrice = async (s: ServiceRow, price: string, active: boolean) => {
    try {
      await api(`/admin/services/${s.id}/branches/${branchId}`, { method: 'PUT', json: { price: price.trim() === '' ? null : Number(price), is_active: active } });
      setMsg({ tone: 'ok', text: `Harga ${s.name} di cabang tersimpan.` });
      load();
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  };
  const update = (id: number, patch: Partial<ServiceRow>) => setRows((r) => r && r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  if (!rows) return <p className={styles.muted}>Memuat…</p>;
  return (
    <>
      <Note msg={msg} />
      <div className={styles.toolbar}>
        <label className={styles.control}>Harga khusus untuk cabang
          <select value={branchId} onChange={(e) => setBranchId(Number(e.target.value))} disabled={!isOwner}>
            {me.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Layanan</th><th>Durasi (mnt)</th><th>Buffer</th><th>Harga dasar</th><th>Aktif</th><th>Harga cabang (kosong = dasar)</th><th>Tersedia di cabang</th><th /></tr>
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
      <p className={styles.muted}>Durasi & buffer menentukan jam yang tersedia. Layanan kategori Paket tampil di daftar harga saja (tidak dibooking per jam).</p>
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
      <td>{isOwner ? <input value={s.name} onChange={(e) => onChange({ name: e.target.value })} /> : s.name}<br /><small className={styles.muted}>{s.category}{s.is_bookable ? '' : ' · paket'}</small></td>
      <td>{isOwner ? <input type="number" value={s.duration_min} onChange={(e) => onChange({ duration_min: Number(e.target.value) })} /> : s.duration_min}</td>
      <td>{isOwner ? <input type="number" value={s.buffer_min} onChange={(e) => onChange({ buffer_min: Number(e.target.value) })} /> : s.buffer_min}</td>
      <td>{isOwner ? <input type="number" value={s.base_price} onChange={(e) => onChange({ base_price: Number(e.target.value) })} /> : rupiah(s.base_price)}</td>
      <td>{isOwner ? <input type="checkbox" checked={Boolean(s.is_active)} onChange={(e) => onChange({ is_active: e.target.checked ? 1 : 0 })} /> : s.is_active ? 'Ya' : 'Tidak'}</td>
      <td><input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={String(s.base_price)} /></td>
      <td><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /></td>
      <td>
        <span className={styles.row} style={{ margin: 0 }}>
          {isOwner && <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={onSave}>Simpan</button>}
          <button type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} onClick={() => onSaveBranch(s, price, active)}>Simpan cabang</button>
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
  const save = async (u: typeof f) => {
    try {
      await api('/admin/admin-users', { method: 'PUT', json: { ...u, name: u.name || null, branch_id: u.role === 'owner' ? null : u.branch_id, barber_id: u.role === 'barber' ? u.barber_id : null } });
      setMsg({ tone: 'ok', text: `Akun ${u.email} tersimpan. Tambahkan juga email ini ke kebijakan Cloudflare Access.` });
      load();
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  };
  const barbers = me.barbers.filter((b) => b.branch_id === f.branch_id);
  return (
    <>
      <Note msg={msg} />
      <form className={styles.panel} onSubmit={(e) => { e.preventDefault(); void save(f); }}>
        <h2 className={styles.h2} style={{ marginTop: 0 }}>Tambah / ubah akun admin</h2>
        <div className={styles.grid2}>
          <label className={styles.control}>Email (login Cloudflare Access)<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></label>
          <label className={styles.control}>Nama<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className={styles.control}>Peran
            <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as AdminUserRow['role'] })}>
              <option value="owner">Owner (semua cabang)</option><option value="branch_admin">Admin cabang</option><option value="barber">Hairstylist</option>
            </select>
          </label>
          {f.role !== 'owner' && (
            <label className={styles.control}>Cabang
              <select value={f.branch_id} onChange={(e) => setF({ ...f, branch_id: Number(e.target.value) })}>
                {me.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}
          {f.role === 'barber' && (
            <label className={styles.control}>Hairstylist
              <select value={f.barber_id} onChange={(e) => setF({ ...f, barber_id: Number(e.target.value) })} required>
                <option value={0}>Pilih</option>
                {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}
        </div>
        <button type="submit" className={styles.btn} style={{ marginTop: 12 }}>Simpan akun</button>
      </form>
      {rows && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Email</th><th>Nama</th><th>Peran</th><th>Cabang</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.email}>
                  <td>{u.email}</td>
                  <td>{u.name}</td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td>{me.branches.find((b) => b.id === u.branch_id)?.name ?? 'Semua'}</td>
                  <td>{u.is_active ? 'Aktif' : 'Nonaktif'}</td>
                  <td>
                    {u.email !== me.admin.email && (
                      <button type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} onClick={() => save({ email: u.email, name: u.name ?? '', role: u.role, branch_id: u.branch_id ?? 0, barber_id: u.barber_id ?? 0, is_active: !u.is_active })}>
                        {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

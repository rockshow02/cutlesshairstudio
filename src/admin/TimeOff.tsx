import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/app/api';
import { clock, longDate } from '@/app/format';
import { toMinutes, zonedToUtc } from '@shared/time';
import { useAdmin } from './context';
import styles from './admin.module.css';

interface TimeOffRow {
  id: number;
  barber_id: number | null;
  branch_id: number | null;
  barber_name: string | null;
  branch_name: string | null;
  start_at: string;
  end_at: string;
  reason: string;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requested_by: string | null;
}

const REASONS = { cuti: 'Cuti', sakit: 'Sakit', libur_cabang: 'Libur cabang', hari_raya: 'Hari raya', lainnya: 'Lainnya' } as const;
const STATUS = { pending: 'Menunggu persetujuan', approved: 'Disetujui', rejected: 'Ditolak' } as const;

/** Libur cabang & cuti hairstylist. Hairstylist mengajukan cutinya sendiri (perlu disetujui admin). */
export function TimeOff() {
  const me = useAdmin();
  const isBarber = me.admin.role === 'barber';
  const [rows, setRows] = useState<TimeOffRow[] | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [kind, setKind] = useState<'barber' | 'branch'>('barber');
  const [branchId, setBranchId] = useState<number>(me.admin.branch_id ?? me.branches[0]?.id);
  const [barberId, setBarberId] = useState<number | ''>(me.admin.barber_id ?? '');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('23:59');
  const [reason, setReason] = useState<keyof typeof REASONS>('cuti');
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    api<{ timeOff: TimeOffRow[] }>('/admin/time-off').then((r) => setRows(r.timeOff)).catch((e) => setMsg({ tone: 'error', text: errorMessage(e) }));
  }, []);
  useEffect(load, [load]);

  const tz = me.branches.find((b) => b.id === branchId)?.timezone ?? 'Asia/Jakarta';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const endMin = endTime === '23:59' ? 24 * 60 : toMinutes(endTime);
    const body = {
      ...(kind === 'branch' && !isBarber ? { branch_id: branchId } : { barber_id: isBarber ? me.admin.barber_id : barberId }),
      start_at: new Date(zonedToUtc(startDate, toMinutes(startTime), tz)).toISOString(),
      end_at: new Date(zonedToUtc(endDate || startDate, endMin, tz)).toISOString(),
      reason,
      note: note || null,
    };
    try {
      const r = await api<{ status: string }>('/admin/time-off', { method: 'POST', json: body });
      setMsg({ tone: 'ok', text: r.status === 'pending' ? 'Pengajuan cuti terkirim, menunggu persetujuan admin.' : 'Tersimpan. Jam tersebut tidak bisa dibooking.' });
      setNote('');
      load();
    } catch (err) {
      setMsg({ tone: 'error', text: errorMessage(err) });
    }
  };

  const act = async (id: number, action: 'approve' | 'reject' | 'delete') => {
    try {
      if (action === 'delete') await api(`/admin/time-off/${id}`, { method: 'DELETE' });
      else await api(`/admin/time-off/${id}/${action}`, { method: 'POST' });
      load();
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  };

  const barbers = me.barbers.filter((b) => b.branch_id === branchId && b.is_active);
  const bookedNote = 'Booking yang sudah ada di rentang ini TIDAK otomatis dibatalkan; cek tab Jadwal dan pindahkan/batalkan bila perlu.';

  return (
    <section aria-labelledby="off-title">
      <h1 id="off-title" className={styles.h1}>
        {isBarber ? 'Ajukan cuti' : 'Libur cabang & cuti hairstylist'}
      </h1>
      {msg && (
        <p className={styles.alert} data-tone={msg.tone} role={msg.tone === 'error' ? 'alert' : 'status'}>
          {msg.text}
        </p>
      )}
      <form className={styles.panel} onSubmit={submit}>
        {!isBarber && (
          <div className={styles.seg} role="group" aria-label="Jenis" style={{ marginBottom: 12 }}>
            <button type="button" aria-pressed={kind === 'barber'} onClick={() => { setKind('barber'); setReason('cuti'); }}>Cuti / sakit hairstylist</button>
            <button type="button" aria-pressed={kind === 'branch'} onClick={() => { setKind('branch'); setReason('libur_cabang'); }}>Libur cabang / hari raya</button>
          </div>
        )}
        <div className={styles.grid2}>
          {me.admin.role === 'owner' && (
            <label className={styles.control}>
              Cabang
              <select value={branchId} onChange={(e) => setBranchId(Number(e.target.value))}>
                {me.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}
          {kind === 'barber' && !isBarber && (
            <label className={styles.control}>
              Hairstylist
              <select value={barberId} onChange={(e) => setBarberId(Number(e.target.value))} required>
                <option value="">Pilih</option>
                {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}
          <label className={styles.control}>
            Alasan
            <select value={reason} onChange={(e) => setReason(e.target.value as keyof typeof REASONS)}>
              {Object.entries(REASONS)
                .filter(([k]) => (kind === 'branch' && !isBarber ? ['libur_cabang', 'hari_raya', 'lainnya'] : ['cuti', 'sakit', 'lainnya']).includes(k))
                .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className={styles.control}>
            Mulai (tanggal & jam)
            <span style={{ display: 'flex', gap: 4 }}>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </span>
          </label>
          <label className={styles.control}>
            Selesai (tanggal & jam)
            <span style={{ display: 'flex', gap: 4 }}>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="sama" />
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </span>
          </label>
          <label className={styles.control}>
            Keterangan (opsional)
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </label>
        </div>
        <p className={styles.muted}>Seharian: biarkan 00:00 – 23:59. {bookedNote}</p>
        <button type="submit" className={styles.btn}>{isBarber ? 'Ajukan' : 'Simpan'}</button>
      </form>

      <h2 className={styles.h2}>Mendatang & 30 hari terakhir</h2>
      {!rows ? (
        <p className={styles.muted}>Memuat…</p>
      ) : rows.length === 0 ? (
        <p className={styles.muted}>Belum ada.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Untuk</th><th>Mulai</th><th>Selesai</th><th>Alasan</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => {
                const rtz = me.branches.find((b) => b.name === r.branch_name)?.timezone ?? 'Asia/Jakarta';
                return (
                  <tr key={r.id}>
                    <td>{r.barber_name ?? `Cabang ${r.branch_name}`}</td>
                    <td>{longDate(r.start_at, rtz)} {clock(r.start_at, rtz)}</td>
                    <td>{longDate(r.end_at, rtz)} {clock(r.end_at, rtz)}</td>
                    <td>{REASONS[r.reason as keyof typeof REASONS] ?? r.reason}{r.note ? ` · ${r.note}` : ''}</td>
                    <td>{STATUS[r.status]}</td>
                    <td>
                      {!isBarber && (
                        <span className={styles.row} style={{ margin: 0 }}>
                          {r.status === 'pending' && (
                            <>
                              <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => act(r.id, 'approve')}>Setujui</button>
                              <button type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} onClick={() => act(r.id, 'reject')}>Tolak</button>
                            </>
                          )}
                          <button type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} onClick={() => window.confirm('Hapus data libur/cuti ini?') && act(r.id, 'delete')}>Hapus</button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

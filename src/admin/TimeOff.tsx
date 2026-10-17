import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/app/api';
import { usePaged } from '@/app/usePaged';
import { clock, longDate } from '@/app/format';
import { toMinutes, zonedToUtc } from '@shared/time';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert, EmptyState, SkeletonList } from '@/components/ui/Feedback';
import { Field, FieldGrid, Input, Select } from '@/components/ui/Field';
import { LoadMore } from '@/components/ui/LoadMore';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { Tone } from '@/components/ui/status';
import { useConfirm } from '@/components/ui/useConfirm';
import { useToast } from '@/components/ui/toastContext';
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
const STATUS: Record<TimeOffRow['status'], { label: string; tone: Tone }> = {
  pending: { label: 'Menunggu persetujuan', tone: 'warning' },
  approved: { label: 'Disetujui', tone: 'success' },
  rejected: { label: 'Ditolak', tone: 'neutral' },
};

/** Libur cabang & cuti hairstylist. Hairstylist mengajukan cutinya sendiri (perlu disetujui admin). */
export function TimeOff() {
  const me = useAdmin();
  const toast = useToast();
  const isBarber = me.admin.role === 'barber';
  const [error, setError] = useState('');
  const [kind, setKind] = useState<'barber' | 'branch'>('barber');
  const [branchId, setBranchId] = useState<number>(me.admin.branch_id ?? me.branches[0]?.id);
  const [barberId, setBarberId] = useState<number | ''>(me.admin.barber_id ?? '');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('23:59');
  const [reason, setReason] = useState<keyof typeof REASONS>('cuti');
  const [note, setNote] = useState('');
  const [dialog, confirm] = useConfirm();

  const list = usePaged<TimeOffRow>(async (cursor) => {
    const r = await api<{ timeOff: TimeOffRow[]; nextCursor: string | null; total?: number }>(`/admin/time-off${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
    return { items: r.timeOff, nextCursor: r.nextCursor, total: r.total };
  }, []);
  const load = list.reload;
  const rows = list.items;

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
    setError('');
    try {
      const r = await api<{ status: string }>('/admin/time-off', { method: 'POST', json: body });
      toast(r.status === 'pending' ? 'Pengajuan cuti terkirim, menunggu persetujuan admin.' : 'Tersimpan. Jam tersebut tidak bisa dibooking.');
      setNote('');
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const act = async (row: TimeOffRow, action: 'approve' | 'reject' | 'delete') => {
    if (action === 'delete') {
      const ok = await confirm({
        title: 'Hapus data libur/cuti ini?',
        message: `${row.barber_name ?? `Cabang ${row.branch_name}`} · ${REASONS[row.reason as keyof typeof REASONS] ?? row.reason}. Jam tersebut bisa dibooking lagi.`,
        confirmLabel: 'Ya, hapus',
        cancelLabel: 'Kembali',
      });
      if (ok === null) return;
    }
    try {
      if (action === 'delete') await api(`/admin/time-off/${row.id}`, { method: 'DELETE' });
      else await api(`/admin/time-off/${row.id}/${action}`, { method: 'POST' });
      toast(action === 'approve' ? 'Cuti disetujui.' : action === 'reject' ? 'Cuti ditolak.' : 'Data libur/cuti dihapus.');
      load();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    }
  };

  const barbers = me.barbers.filter((b) => b.branch_id === branchId && b.is_active);

  return (
    <section aria-labelledby="off-title">
      <PageHeader
        titleId="off-title"
        title={isBarber ? 'Ajukan cuti' : 'Libur & cuti'}
        description={isBarber ? 'Pengajuan perlu disetujui admin cabang.' : 'Atur libur cabang/hari raya dan cuti hairstylist. Jam yang diblokir tidak bisa dibooking.'}
      />
      {error && <Alert tone="danger">{error}</Alert>}
      <Card tone="outline" as="form" onSubmit={submit}>
        {!isBarber && (
          <div className={styles.segRow}>
            <SegmentedControl
              label="Jenis"
              value={kind}
              onChange={(k) => {
                setKind(k);
                setReason(k === 'barber' ? 'cuti' : 'libur_cabang');
              }}
              options={[
                { value: 'barber', label: 'Cuti / sakit hairstylist' },
                { value: 'branch', label: 'Libur cabang / hari raya' },
              ]}
              wrap
            />
          </div>
        )}
        <FieldGrid>
          {me.admin.role === 'owner' && (
            <Field label="Cabang">
              <Select value={branchId} onChange={(e) => setBranchId(Number(e.target.value))}>
                {me.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {kind === 'barber' && !isBarber && (
            <Field label="Hairstylist">
              <Select value={barberId} onChange={(e) => setBarberId(Number(e.target.value))} required>
                <option value="">Pilih</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Alasan">
            <Select value={reason} onChange={(e) => setReason(e.target.value as keyof typeof REASONS)}>
              {Object.entries(REASONS)
                .filter(([k]) => (kind === 'branch' && !isBarber ? ['libur_cabang', 'hari_raya', 'lainnya'] : ['cuti', 'sakit', 'lainnya']).includes(k))
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Keterangan (opsional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </Field>
          <div className={styles.inlineFields}>
            <Field label="Mulai">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </Field>
            <Field label="Jam mulai">
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
          </div>
          <div className={styles.inlineFields}>
            <Field label="Selesai" hint="Kosong = sama dengan tanggal mulai">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
            <Field label="Jam selesai">
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </Field>
          </div>
        </FieldGrid>
        <Alert tone="info" role="none">
          Seharian: biarkan 00:00 – 23:59. Booking yang sudah ada di rentang ini tidak otomatis dibatalkan; cek tab Jadwal dan pindahkan/batalkan bila perlu.
        </Alert>
        <Button type="submit" variant="dark" casing="normal">
          {isBarber ? 'Ajukan' : 'Simpan'}
        </Button>
      </Card>

      <h2 className={styles.h2}>Mendatang & 30 hari terakhir</h2>
      {list.error && <Alert tone="danger">{list.error}</Alert>}
      {!rows ? (
        <SkeletonList label="Memuat…" count={2} height={56} />
      ) : rows.length === 0 ? (
        <EmptyState icon="calendar" title="Belum ada libur atau cuti" compact />
      ) : (
        <div className={styles.tableWrap} data-stack>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Untuk</th>
                <th>Mulai</th>
                <th>Selesai</th>
                <th>Alasan</th>
                <th>Status</th>
                <th>
                  <span className="visually-hidden">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rtz = me.branches.find((b) => b.name === r.branch_name)?.timezone ?? 'Asia/Jakarta';
                return (
                  <tr key={r.id}>
                    <td data-label="Untuk" className={styles.cellMain}>
                      {r.barber_name ?? `Cabang ${r.branch_name}`}
                    </td>
                    <td data-label="Mulai">
                      {longDate(r.start_at, rtz)} {clock(r.start_at, rtz)}
                    </td>
                    <td data-label="Selesai">
                      {longDate(r.end_at, rtz)} {clock(r.end_at, rtz)}
                    </td>
                    <td data-label="Alasan">
                      {REASONS[r.reason as keyof typeof REASONS] ?? r.reason}
                      {r.note ? <span className={styles.cellSub}>{r.note}</span> : null}
                    </td>
                    <td data-label="Status">
                      <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                    </td>
                    <td data-label="">
                      {!isBarber && (
                        <span className={styles.row}>
                          {r.status === 'pending' && (
                            <>
                              <Button variant="dark" casing="normal" size="sm" onClick={() => act(r, 'approve')}>
                                Setujui
                              </Button>
                              <Button variant="outline-dark" casing="normal" size="sm" onClick={() => act(r, 'reject')}>
                                Tolak
                              </Button>
                            </>
                          )}
                          <Button variant="text" casing="normal" size="sm" className={styles.textDanger} onClick={() => act(r, 'delete')}>
                            Hapus
                          </Button>
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
      {rows && rows.length > 0 && <LoadMore shown={rows.length} total={list.total} hasMore={list.hasMore} loading={list.loadingMore} onLoad={list.loadMore} noun="libur/cuti" />}
      {dialog}
    </section>
  );
}

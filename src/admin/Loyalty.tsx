/** Admin Cutless Stamp: panel pelanggan, voucher di booking, pengaturan program, ringkasan. */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/app/api';
import { rupiah } from '@/app/format';
import { shortDay, useLoyaltyProgram, type LoyaltyCard, type LoyaltyStamp, type LoyaltyVoucher } from '@/app/loyalty';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert, EmptyState, SkeletonList } from '@/components/ui/Feedback';
import { Checkbox, Field, FieldGrid, Input } from '@/components/ui/Field';
import { LoadMore } from '@/components/ui/LoadMore';
import { useConfirm } from '@/components/ui/useConfirm';
import { useToast } from '@/components/ui/toastContext';
import { StampCard, VoucherItem } from '@/booking/loyalty/StampCard';
import { useAdmin } from './context';
import { resetLoyaltyStatus, type LoyaltySettingsData } from './loyaltyStatus';
import styles from './admin.module.css';

const STAMP_STATUS: Record<LoyaltyStamp['status'], { label: string; tone: 'success' | 'neutral' | 'info' | 'danger' }> = {
  active: { label: 'Aktif', tone: 'success' },
  used: { label: 'Ditukar hadiah', tone: 'info' },
  expired: { label: 'Hangus', tone: 'neutral' },
  removed: { label: 'Dicabut', tone: 'danger' },
};

/* ---------- Detail pelanggan ---------- */

interface CustomerLoyalty {
  enabled: boolean;
  card: LoyaltyCard;
  vouchers: LoyaltyVoucher[];
  stamps: LoyaltyStamp[];
  stampsNextCursor: string | null;
  mergeCandidates: { id: string; name: string; stamps: number; vouchers: number }[];
}

export function CustomerLoyaltyPanel({ customerId }: { customerId: string }) {
  const me = useAdmin();
  const toast = useToast();
  const program = useLoyaltyProgram();
  const [data, setData] = useState<CustomerLoyalty | null>(null);
  const [error, setError] = useState('');
  const [moreBusy, setMoreBusy] = useState(false);
  const [dialog, confirm] = useConfirm();

  const load = useCallback(() => {
    api<CustomerLoyalty>(`/admin/customers/${customerId}/loyalty`)
      .then(setData)
      .catch((e) => setError(errorMessage(e)));
  }, [customerId]);
  useEffect(load, [load]);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <SkeletonList label="Memuat Cutless Stamp…" count={1} height={160} />;
  if (!data.enabled) return null;

  const adjust = async (delta: 1 | -1) => {
    const reason = await confirm({
      title: delta === 1 ? 'Tambah 1 stempel?' : 'Cabut 1 stempel?',
      message: 'Penyesuaian manual tercatat di log aktivitas beserta alasan dan nama Anda.',
      input: { label: 'Alasan', required: true, maxLength: 300, singleLine: true },
      confirmLabel: delta === 1 ? 'Tambah stempel' : 'Cabut stempel',
      tone: delta === 1 ? 'default' : 'danger',
    });
    if (!reason) return;
    try {
      await api(`/admin/customers/${customerId}/loyalty/adjust`, { method: 'POST', json: { delta, reason } });
      toast(delta === 1 ? 'Stempel ditambahkan.' : 'Stempel dicabut.');
      load();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    }
  };

  const merge = async (g: CustomerLoyalty['mergeCandidates'][number]) => {
    const ok = await confirm({
      title: `Gabungkan data tamu "${g.name}"?`,
      message: `${g.stamps} stempel aktif & ${g.vouchers} voucher dari kunjungan walk-in dengan nomor WhatsApp yang sama akan dipindah ke akun ini. Pastikan orangnya sama (cocokkan di kasir).`,
      confirmLabel: 'Gabungkan',
      tone: 'default',
    });
    if (ok === null) return;
    try {
      const r = await api<{ moved: { stamps: number; vouchers: number } }>(`/admin/customers/${customerId}/loyalty/merge`, { method: 'POST', json: { guestId: g.id } });
      toast(`Digabung: ${r.moved.stamps} stempel, ${r.moved.vouchers} voucher.`);
      load();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    }
  };

  const more = async () => {
    if (!data.stampsNextCursor) return;
    setMoreBusy(true);
    try {
      const r = await api<{ stamps: LoyaltyStamp[]; nextCursor: string | null }>(`/admin/customers/${customerId}/loyalty/stamps?cursor=${encodeURIComponent(data.stampsNextCursor)}`);
      setData((d) => d && { ...d, stamps: [...d.stamps, ...r.stamps], stampsNextCursor: r.nextCursor });
    } finally {
      setMoreBusy(false);
    }
  };

  return (
    <section className={styles.loyaltyPanel} aria-label="Cutless Stamp">
      <h3 className={styles.h2}>Cutless Stamp</h3>
      {data.mergeCandidates.map((g) => (
        <Alert key={g.id} tone="warning" role="none" title="Ada data tamu dengan nomor yang sama">
          <p>
            {g.name || 'Tamu'}: {g.stamps} stempel aktif, {g.vouchers} voucher.
          </p>
          <Button variant="outline-dark" casing="normal" size="sm" onClick={() => merge(g)}>
            Gabungkan
          </Button>
        </Alert>
      ))}
      <StampCard card={data.card} program={program} />
      {me.admin.role === 'owner' && (
        <div className={styles.actionBar}>
          <Button variant="outline-dark" casing="normal" size="sm" icon="plus" onClick={() => adjust(1)}>
            Tambah stempel
          </Button>
          <Button variant="outline-danger" casing="normal" size="sm" onClick={() => adjust(-1)} disabled={data.card.stamps === 0}>
            Cabut stempel
          </Button>
        </div>
      )}
      <h4 className={styles.sectionLabel}>Voucher</h4>
      {data.vouchers.length === 0 ? (
        <p className={styles.muted}>Belum ada voucher.</p>
      ) : (
        <div className={styles.stack}>
          {data.vouchers.map((v) => (
            <VoucherItem key={v.id} v={v} />
          ))}
        </div>
      )}
      <h4 className={styles.sectionLabel}>Riwayat stempel</h4>
      {data.stamps.length === 0 ? (
        <EmptyState icon="scissors" title="Belum ada stempel" compact />
      ) : (
        <ul className={styles.hits}>
          {data.stamps.map((s) => (
            <li key={s.id} className={styles.historyItem}>
              <span className={styles.cardTop}>
                <span className={styles.cellMain}>{s.kind === 'manual' ? 'Penyesuaian manual' : `${s.service_name ?? 'Booking'}${s.booking_code ? ` · ${s.booking_code}` : ''}`}</span>
                <Badge tone={STAMP_STATUS[s.status].tone}>{STAMP_STATUS[s.status].label}</Badge>
              </span>
              <span className={styles.hitMeta}>
                {shortDay(s.created_at)}
                {s.branch_name ? ` · ${s.branch_name}` : ''}
                {s.created_by ? ` · oleh ${s.created_by}` : ''}
                {s.reason ? ` · ${s.reason}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <LoadMore shown={data.stamps.length} hasMore={Boolean(data.stampsNextCursor)} loading={moreBusy} onLoad={more} noun="stempel" />
      {dialog}
    </section>
  );
}

/* ---------- Voucher di detail booking ---------- */

export function BookingVoucherPanel({ bookingId, onChanged }: { bookingId: string; onChanged: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<{ enabled: boolean; redeemed: LoyaltyVoucher | null; eligible: LoyaltyVoucher[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [dialog, confirm] = useConfirm();
  const load = useCallback(() => {
    api<{ enabled: boolean; redeemed: LoyaltyVoucher | null; eligible: LoyaltyVoucher[] }>(`/admin/bookings/${bookingId}/vouchers`)
      .then(setData)
      .catch(() => setData({ enabled: false, redeemed: null, eligible: [] }));
  }, [bookingId]);
  useEffect(load, [load]);
  if (!data?.enabled || (!data.redeemed && data.eligible.length === 0)) return null;

  const redeem = async (v: LoyaltyVoucher) => {
    const ok = await confirm({
      title: `Tukar voucher ${v.code}?`,
      message: 'Harga booking ini menjadi Rp0 dan booking ini tidak mendapat stempel. Bisa dibatalkan selama booking belum Selesai.',
      confirmLabel: 'Tukar voucher',
      tone: 'default',
    });
    if (ok === null) return;
    setBusy(true);
    setMsg('');
    try {
      await api(`/admin/bookings/${bookingId}/voucher`, { method: 'POST', json: { voucherId: v.id } });
      setMsg(`Voucher ${v.code} ditukar.`);
      load();
      onChanged();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const release = async () => {
    const ok = await confirm({ title: 'Batalkan penukaran voucher?', message: 'Voucher aktif kembali dan harga booking dipulihkan.', confirmLabel: 'Batalkan penukaran' });
    if (ok === null) return;
    setBusy(true);
    try {
      await api(`/admin/bookings/${bookingId}/voucher`, { method: 'DELETE' });
      setMsg('Penukaran dibatalkan.');
      load();
      onChanged();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.subPanel} aria-label="Voucher Cutless Stamp">
      <h3 className={styles.sectionLabel}>Voucher Cutless Stamp</h3>
      {msg && (
        <Alert tone="success" role="status">
          {msg}
        </Alert>
      )}
      {data.redeemed ? (
        <VoucherItem
          v={data.redeemed}
          extra={
            <Button variant="text" casing="normal" size="sm" onClick={release} disabled={busy}>
              Batalkan penukaran
            </Button>
          }
        />
      ) : (
        <div className={styles.stack}>
          {data.eligible.map((v) => (
            <VoucherItem
              key={v.id}
              v={v}
              extra={
                <Button variant="dark" casing="normal" size="sm" onClick={() => redeem(v)} disabled={busy}>
                  Tukar voucher
                </Button>
              }
            />
          ))}
        </div>
      )}
      {dialog}
    </section>
  );
}

/* ---------- Pengaturan program (owner ubah, admin cabang lihat) ---------- */

interface ServiceOpt { id: number; name: string; category: string; is_bookable: number; is_active: number }

export function LoyaltySettingsPanel() {
  const me = useAdmin();
  const toast = useToast();
  const isOwner = me.admin.role === 'owner';
  const [state, setState] = useState<{ available: boolean; settings: LoyaltySettingsData | null } | null>(null);
  const [services, setServices] = useState<ServiceOpt[]>([]);
  const [f, setF] = useState<LoyaltySettingsData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ available: boolean; settings: LoyaltySettingsData | null }>('/admin/loyalty/settings')
      .then((s) => {
        setState(s);
        setF(s.settings);
      })
      .catch((e) => setError(errorMessage(e)));
    api<{ services: ServiceOpt[] }>('/admin/services').then((r) => setServices(r.services.filter((s) => s.is_bookable && s.is_active))).catch(() => undefined);
  }, []);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!state || !f) return <SkeletonList label="Memuat pengaturan…" count={2} height={120} />;

  const toggle = (key: 'tier1_service_ids' | 'tier2_service_ids', id: number, on: boolean) =>
    setF({ ...f, [key]: on ? [...f[key], id] : f[key].filter((x) => x !== id) });
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { settings } = await api<{ settings: LoyaltySettingsData }>('/admin/loyalty/settings', {
        method: 'PUT',
        json: {
          enabled: f.enabled,
          tier1_stamps: f.tier1_stamps,
          tier1_service_ids: f.tier1_service_ids,
          tier2_stamps: f.tier2_stamps,
          tier2_service_ids: f.tier2_service_ids,
          stamp_valid_months: f.stamp_valid_months,
          voucher_valid_days: f.voucher_valid_days,
        },
      });
      setF(settings);
      resetLoyaltyStatus();
      toast('Pengaturan Cutless Stamp tersimpan.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const disabled = !isOwner || !state.available;
  const serviceChecks = (key: 'tier1_service_ids' | 'tier2_service_ids') => (
    <div className={styles.checkList}>
      {services.map((s) => (
        <Checkbox key={s.id} checked={f[key].includes(s.id)} disabled={disabled} onChange={(e) => toggle(key, s.id, e.target.checked)}>
          {s.name}
        </Checkbox>
      ))}
    </div>
  );

  return (
    <Card tone="outline" as="form" onSubmit={save}>
      <div className={styles.cardHead}>
        <h2 className={styles.panelTitle}>Cutless Stamp</h2>
        <Badge tone={state.available && f.enabled ? 'success' : 'neutral'}>{state.available && f.enabled ? 'Program aktif' : 'Program mati'}</Badge>
      </div>
      {!state.available && <Alert tone="warning">Fitur belum tersedia di server ini (variabel LOYALTY_ENABLED). Pengaturan hanya bisa dilihat.</Alert>}
      {!isOwner && state.available && <Alert tone="info" role="none">Hanya owner yang bisa mengubah pengaturan program.</Alert>}
      <Checkbox checked={f.enabled} disabled={disabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} className={styles.checkRow}>
        Program aktif: booking yang Selesai mendapat stempel otomatis
      </Checkbox>
      <h3 className={styles.sectionLabel}>Hadiah pertama</h3>
      <Field label="Di stempel ke-">
        <Input type="number" min={1} max={50} value={f.tier1_stamps} disabled={disabled} onChange={(e) => setF({ ...f, tier1_stamps: Number(e.target.value) })} />
      </Field>
      {serviceChecks('tier1_service_ids')}
      <h3 className={styles.sectionLabel}>Hadiah utama (kartu kembali ke 0)</h3>
      <Field label="Di stempel ke-">
        <Input type="number" min={2} max={100} value={f.tier2_stamps} disabled={disabled} onChange={(e) => setF({ ...f, tier2_stamps: Number(e.target.value) })} />
      </Field>
      {serviceChecks('tier2_service_ids')}
      <h3 className={styles.sectionLabel}>Masa berlaku</h3>
      <FieldGrid>
        <Field label="Stempel (bulan)">
          <Input type="number" min={1} max={36} value={f.stamp_valid_months} disabled={disabled} onChange={(e) => setF({ ...f, stamp_valid_months: Number(e.target.value) })} />
        </Field>
        <Field label="Voucher (hari)">
          <Input type="number" min={1} max={365} value={f.voucher_valid_days} disabled={disabled} onChange={(e) => setF({ ...f, voucher_valid_days: Number(e.target.value) })} />
        </Field>
      </FieldGrid>
      {error && <Alert tone="danger">{error}</Alert>}
      {isOwner && state.available && (
        <div className={styles.formActions}>
          <Button type="submit" variant="dark" casing="normal" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan pengaturan'}
          </Button>
        </div>
      )}
      <p className={`${styles.muted} ${styles.exportNote}`}>
        Terakhir diubah {shortDay(f.updated_at)}
        {f.updated_by ? ` oleh ${f.updated_by}` : ''}. Perubahan target & masa berlaku berlaku untuk stempel/voucher berikutnya.
      </p>
    </Card>
  );
}

/* ---------- Ringkasan ---------- */

export interface LoyaltySummaryData {
  stamps: number;
  stampsByAdmin: { admin: string; kind: 'booking' | 'manual'; n: number }[];
  vouchersRedeemed: number;
  vouchersRedeemedValue: number;
  vouchersIssued?: number;
  vouchersExpired?: number;
  vouchersActive?: number;
  /** Voucher gagal terbit karena tabrakan kode (owner) */
  voucherIssueFailures?: number;
}

export function LoyaltySummary({ data }: { data: LoyaltySummaryData }) {
  return (
    <>
      <h2 className={styles.h2}>Cutless Stamp (30 hari)</h2>
      {Boolean(data.voucherIssueFailures) && (
        <Alert tone="danger" title={`${data.voucherIssueFailures} kali voucher gagal terbit`}>
          <p>
            Kode voucher bentrok berulang kali (sangat jarang). Voucher dicoba terbit lagi otomatis saat pelanggan itu mendapat stempel berikutnya. Detail ada di
            Pengaturan → Log aktivitas (aksi loyalty.voucher_issue_failed).
          </p>
        </Alert>
      )}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{data.stamps}</span>
          <span className={styles.statLabel}>stempel diberikan</span>
        </div>
        {data.vouchersIssued !== undefined && (
          <div className={styles.stat}>
            <span className={styles.statValue}>{data.vouchersIssued}</span>
            <span className={styles.statLabel}>voucher terbit · {data.vouchersActive ?? 0} aktif sekarang</span>
          </div>
        )}
        <div className={styles.stat}>
          <span className={styles.statValue}>{data.vouchersRedeemed}</span>
          <span className={styles.statLabel}>voucher ditukar · senilai {rupiah(data.vouchersRedeemedValue)}</span>
        </div>
        {data.vouchersExpired !== undefined && (
          <div className={styles.stat}>
            <span className={styles.statValue}>{data.vouchersExpired}</span>
            <span className={styles.statLabel}>voucher hangus</span>
          </div>
        )}
      </div>
      <h3 className={styles.sectionLabel}>Stempel per admin/hairstylist</h3>
      {data.stampsByAdmin.length === 0 ? (
        <p className={styles.muted}>Belum ada stempel dalam 30 hari terakhir.</p>
      ) : (
        <div className={styles.tableWrap} data-stack>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Diberikan oleh</th>
                <th>Jenis</th>
                <th className={styles.num}>Stempel</th>
              </tr>
            </thead>
            <tbody>
              {data.stampsByAdmin.map((r) => (
                <tr key={`${r.admin}-${r.kind}`}>
                  <td data-label="Oleh" className={styles.cellMain}>
                    {r.admin}
                  </td>
                  <td data-label="Jenis">{r.kind === 'manual' ? <Badge tone="warning">Manual</Badge> : <Badge>Booking Selesai</Badge>}</td>
                  <td data-label="Stempel" className={styles.num}>
                    {r.n}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={`${styles.muted} ${styles.exportNote}`}>Pantau angka yang jauh di atas jumlah booking Selesai, atau stempel manual yang sering.</p>
    </>
  );
}

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/app/api';
import { addDays, localDate } from '@shared/time';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert, EmptyState, SkeletonList } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAdmin } from './context';
import { LoyaltySummary, type LoyaltySummaryData } from './Loyalty';
import styles from './admin.module.css';

interface SummaryData {
  branches: { id: number; name: string; today: number | null; week: number | null }[];
  noShowRate: number;
  noShowCount: number;
  popularServices: { service: string; n: number }[];
  pendingCount: number;
  loyalty?: LoyaltySummaryData;
}

/** Ringkasan: booking hari ini/minggu ini per cabang, tingkat tidak datang, layanan terpopuler, ekspor CSV */
export function Summary() {
  const me = useAdmin();
  const [data, setData] = useState<SummaryData | null>(null);
  const [error, setError] = useState('');
  const today = localDate(Date.now(), 'Asia/Jakarta');
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const [branch, setBranch] = useState<string>('');

  useEffect(() => {
    api<SummaryData>('/admin/reports/summary').then(setData).catch((e) => setError(errorMessage(e)));
  }, []);

  const exportUrl = `/api/admin/reports/export.csv?${new URLSearchParams({ from, to, ...(branch ? { branch } : {}) })}`;

  return (
    <section aria-labelledby="sum-title">
      <PageHeader titleId="sum-title" title="Ringkasan" description="Angka booking per cabang, tingkat tidak datang, dan layanan terpopuler 30 hari terakhir." />
      {error && <Alert tone="danger">{error}</Alert>}
      {!data ? (
        !error && <SkeletonList label="Memuat ringkasan…" count={3} height={96} />
      ) : (
        <>
          <div className={styles.stats}>
            {data.branches.map((b) => (
              <div key={b.id} className={styles.stat}>
                <span className={styles.statValue}>{b.today ?? 0}</span>
                <span className={styles.statLabel}>
                  booking hari ini · <strong>{b.name}</strong>
                </span>
                <span className={styles.statLabel}>{b.week ?? 0} dalam 7 hari ke depan</span>
              </div>
            ))}
            <div className={styles.stat}>
              <span className={styles.statValue}>{data.noShowRate}%</span>
              <span className={styles.statLabel}>tingkat tidak datang (30 hari, {data.noShowCount} kali)</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{data.pendingCount}</span>
              <span className={styles.statLabel}>booking menunggu konfirmasi</span>
            </div>
          </div>
          <h2 className={styles.h2}>Layanan terpopuler (30 hari)</h2>
          {data.popularServices.length === 0 ? (
            <EmptyState icon="scissors" title="Belum ada data" compact />
          ) : (
            <ol className={styles.rank}>
              {data.popularServices.map((s) => (
                <li key={s.service}>
                  <span>{s.service}</span>
                  <strong>{s.n} booking</strong>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      {data?.loyalty && <LoyaltySummary data={data.loyalty} />}

      <h2 className={styles.h2}>Ekspor CSV</h2>
      <Card tone="outline" as="div">
        <div className={styles.exportRow}>
          <Field label="Dari" flush>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Sampai" flush>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          {me.admin.role === 'owner' && (
            <Field label="Cabang" flush>
              <Select value={branch} onChange={(e) => setBranch(e.target.value)}>
                <option value="">Semua</option>
                {me.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Button href={exportUrl} download variant="dark" casing="normal">
            Unduh CSV
          </Button>
        </div>
        <p className={`${styles.muted} ${styles.exportNote}`}>File bisa dibuka di Excel / Google Sheets. Berisi nomor pelanggan: simpan dengan aman.</p>
      </Card>
    </section>
  );
}

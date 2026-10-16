import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/app/api';
import { addDays, localDate } from '@shared/time';
import { useAdmin } from './context';
import styles from './admin.module.css';

interface SummaryData {
  branches: { id: number; name: string; today: number | null; week: number | null }[];
  noShowRate: number;
  noShowCount: number;
  popularServices: { service: string; n: number }[];
  pendingCount: number;
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
      <h1 id="sum-title" className={styles.h1}>
        Ringkasan
      </h1>
      {error && <p className={styles.alert} data-tone="error">{error}</p>}
      {!data ? (
        <p className={styles.muted}>Memuat…</p>
      ) : (
        <>
          <div className={styles.stats}>
            {data.branches.map((b) => (
              <div key={b.id} className={styles.stat}>
                <strong>{b.today ?? 0}</strong>
                <span>
                  booking hari ini · {b.name}
                  <br />
                  {b.week ?? 0} dalam 7 hari ke depan
                </span>
              </div>
            ))}
            <div className={styles.stat}>
              <strong>{data.noShowRate}%</strong>
              <span>tingkat tidak datang (30 hari, {data.noShowCount} kali)</span>
            </div>
            <div className={styles.stat}>
              <strong>{data.pendingCount}</strong>
              <span>booking menunggu konfirmasi</span>
            </div>
          </div>
          <h2 className={styles.h2}>Layanan terpopuler (30 hari)</h2>
          {data.popularServices.length === 0 ? (
            <p className={styles.muted}>Belum ada data.</p>
          ) : (
            <ol style={{ paddingLeft: 20, listStyle: 'decimal' }}>
              {data.popularServices.map((s) => (
                <li key={s.service}>
                  {s.service} · {s.n} booking
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      <h2 className={styles.h2}>Ekspor CSV</h2>
      <div className={styles.toolbar}>
        <label className={styles.control}>
          Dari
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className={styles.control}>
          Sampai
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {me.admin.role === 'owner' && (
          <label className={styles.control}>
            Cabang
            <select value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Semua</option>
              {me.branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
        )}
        <a className={styles.btn} style={{ display: 'inline-flex', alignItems: 'center' }} href={exportUrl} download>
          Unduh CSV
        </a>
      </div>
      <p className={styles.muted}>File bisa dibuka di Excel / Google Sheets. Berisi nomor pelanggan: simpan dengan aman.</p>
    </section>
  );
}

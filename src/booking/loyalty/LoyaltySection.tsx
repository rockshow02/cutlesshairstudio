import { useState } from 'react';
import { api } from '@/app/api';
import { shortDay, useLoyaltyProgram, useMyLoyalty, type LoyaltyStamp } from '@/app/loyalty';
import { usePaged } from '@/app/usePaged';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, SkeletonList } from '@/components/ui/Feedback';
import { LoadMore } from '@/components/ui/LoadMore';
import { StampCard, VoucherItem } from './StampCard';
import styles from './loyalty.module.css';
import bookingStyles from '../booking.module.css';

const STAMP_STATUS: Record<LoyaltyStamp['status'], { label: string; tone: 'success' | 'neutral' | 'info' | 'danger' }> = {
  active: { label: 'Aktif', tone: 'success' },
  used: { label: 'Ditukar hadiah', tone: 'info' },
  expired: { label: 'Hangus', tone: 'neutral' },
  removed: { label: 'Dicabut', tone: 'danger' },
};

/** Booking saya: kartu stempel, voucher aktif, riwayat stempel (berhalaman). Tidak tampil bila program mati. */
export function LoyaltySection({ reloadKey }: { reloadKey: number }) {
  const data = useMyLoyalty(reloadKey);
  const program = useLoyaltyProgram();
  const [showHistory, setShowHistory] = useState(false);
  if (!data) return <SkeletonList label="Memuat Cutless Stamp…" count={1} height={180} />;
  if (!data.enabled) return null;
  return (
    <section className={styles.section} aria-labelledby="stamp-title">
      <div className={styles.sectionHead}>
        <h2 id="stamp-title" className={bookingStyles.h2}>
          Cutless Stamp
        </h2>
        <div className={styles.links}>
          <a className={bookingStyles.link} href="/kebijakan-privasi#cutless-stamp">
            Syarat & ketentuan
          </a>
        </div>
      </div>
      <StampCard card={data.card} program={program} footer={program?.stampValidMonths ? `1 booking selesai = 1 stempel · berlaku ${program.stampValidMonths} bulan` : undefined} />
      {data.vouchers.length > 0 && (
        <div className={styles.vouchers}>
          {data.vouchers.map((v) => (
            <VoucherItem key={v.id} v={v} />
          ))}
          <p className={bookingStyles.hint}>Tunjukkan kode voucher di kasir saat datang. Voucher dipakai untuk layanan yang tertulis.</p>
        </div>
      )}
      <div className={styles.historyBlock}>
        <button type="button" className={bookingStyles.inlineBtn} aria-expanded={showHistory} aria-controls="riwayat-stempel" onClick={() => setShowHistory((v) => !v)}>
          {showHistory ? 'Sembunyikan riwayat stempel' : 'Lihat riwayat stempel'}
        </button>
        {showHistory && (
          <div id="riwayat-stempel">
            <StampHistory />
          </div>
        )}
      </div>
    </section>
  );
}

function StampHistory() {
  const list = usePaged<LoyaltyStamp>(async (cursor) => {
    const r = await api<{ stamps: LoyaltyStamp[]; nextCursor: string | null }>(`/me/loyalty/stamps${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
    return { items: r.stamps, nextCursor: r.nextCursor };
  }, []);
  if (!list.items) return <SkeletonList label="Memuat riwayat stempel…" count={2} height={52} />;
  if (list.items.length === 0) return <EmptyState icon="scissors" title="Belum ada stempel" compact>Stempel pertama didapat setelah treatment selesai.</EmptyState>;
  return (
    <div>
      <ul className={styles.stampList}>
        {list.items.map((s) => (
          <li key={s.id} className={styles.stampRow}>
            <span className={styles.stampWhat}>
              <strong>{s.kind === 'manual' ? 'Stempel dari cabang' : (s.service_name ?? 'Booking')}</strong>
              <small>
                {shortDay(s.created_at)}
                {s.branch_name ? ` · ${s.branch_name}` : ''}
                {s.status === 'active' ? ` · berlaku s.d. ${shortDay(s.expires_at)}` : ''}
              </small>
            </span>
            <Badge tone={STAMP_STATUS[s.status].tone}>{STAMP_STATUS[s.status].label}</Badge>
          </li>
        ))}
      </ul>
      <LoadMore shown={list.items.length} hasMore={list.hasMore} loading={list.loadingMore} onLoad={list.loadMore} noun="stempel" casing="upper" />
    </div>
  );
}


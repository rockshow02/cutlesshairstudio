/** Umpan balik: Alert (pesan di tempat), EmptyState, Skeleton. */
import type { CSSProperties, ReactNode } from 'react';
import type { IconName } from '@/types';
import { Icon } from './Icon';
import type { Tone } from './status';
import styles from './Feedback.module.css';

const TONE_ICON: Record<Tone, IconName> = { success: 'check', warning: 'alert', danger: 'alert', info: 'info', neutral: 'info' };

/** Pesan di tempat (error form, info cabang). role alert untuk danger, status untuk lainnya (kecuali role diberikan). */
export function Alert({ tone = 'info', title, role, className, children }: { tone?: Tone; title?: ReactNode; role?: 'alert' | 'status' | 'none'; className?: string; children?: ReactNode }) {
  const r = role ?? (tone === 'danger' ? 'alert' : undefined);
  return (
    <div className={[styles.alert, className].filter(Boolean).join(' ')} data-tone={tone} role={r === 'none' ? undefined : r}>
      <Icon name={TONE_ICON[tone]} size={18} className={styles.alertIcon} />
      <div className={styles.alertBody}>
        {title && <p className={styles.alertTitle}>{title}</p>}
        {children}
      </div>
    </div>
  );
}

/** Keadaan kosong: ikon sederhana + kalimat + aksi */
export function EmptyState({ icon = 'calendar', title, children, action, compact }: { icon?: IconName; title: ReactNode; children?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={styles.empty} data-compact={compact || undefined}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <Icon name={icon} size={compact ? 18 : 22} />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {children && <p className={styles.emptyText}>{children}</p>}
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  );
}

/** Blok abu-abu berdenyut halus (diam bila "kurangi gerakan") */
export function Skeleton({ width, height = 16, radius, className, style }: { width?: CSSProperties['width']; height?: CSSProperties['height']; radius?: CSSProperties['borderRadius']; className?: string; style?: CSSProperties }) {
  return <span className={[styles.skeleton, className].filter(Boolean).join(' ')} style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}

/** Daftar kartu skeleton + teks tersembunyi untuk pembaca layar */
export function SkeletonList({ label = 'Memuat…', count = 3, height = 72, className }: { label?: string; count?: number; height?: number; className?: string }) {
  return (
    <div className={[styles.skeletonList, className].filter(Boolean).join(' ')} role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={height} radius="var(--radius-lg)" />
      ))}
    </div>
  );
}

import type { ReactNode } from 'react';
import { STATUS_LABEL, STATUS_TONE, type BookingStatus, type Tone } from './status';
import styles from './Badge.module.css';

/** Pill kecil berwarna lembut. solid = latar penuh (mis. penanda "Baru"). */
export function Badge({ tone = 'neutral', solid, dot, className, children }: { tone?: Tone; solid?: boolean; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={[styles.badge, solid && styles.solid, className].filter(Boolean).join(' ')} data-tone={tone}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Status booking: label & warna dari satu sumber (status.ts). label = teks dari API bila ada. */
export function StatusBadge({ status, label, className }: { status: BookingStatus; label?: string; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot className={className}>
      {label ?? STATUS_LABEL[status]}
    </Badge>
  );
}

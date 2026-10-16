import type { ReactNode } from 'react';
import { Section } from '@/components/ui/Section';
import styles from './booking.module.css';

/** Kerangka halaman aplikasi: section terang, judul h1, lebar nyaman dibaca (tanpa animasi reveal) */
export function Page({ id, kicker, title, lead, children }: { id: string; kicker?: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <Section id={id} tone="light" labelledBy={`${id}-title`} className={styles.page}>
      <div className={styles.narrow}>
        {kicker && <p className={styles.kicker}>{kicker}</p>}
        <h1 id={`${id}-title`} className={styles.title}>
          {title}
        </h1>
        {lead && <p className={styles.lead}>{lead}</p>}
        {children}
      </div>
    </Section>
  );
}

export function Loading({ label = 'Memuat…' }: { label?: string }) {
  return (
    <p className={styles.muted} role="status">
      {label}
    </p>
  );
}

import type { ReactNode } from 'react';
import { Section } from '@/components/ui/Section';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonList } from '@/components/ui/Feedback';
import styles from './booking.module.css';

/** Kerangka halaman aplikasi: section terang, judul h1, lebar nyaman dibaca (tanpa animasi reveal) */
export function Page({ id, kicker, title, lead, actions, children }: { id: string; kicker?: string; title: string; lead?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <Section id={id} tone="light" labelledBy={`${id}-title`} className={styles.page}>
      <div className={styles.narrow}>
        <PageHeader variant="page" eyebrow={kicker} title={title} titleId={`${id}-title`} description={lead} actions={actions} />
        {children}
      </div>
    </Section>
  );
}

/** Kerangka memuat: kartu skeleton + teks untuk pembaca layar */
export function Loading({ label = 'Memuat…', count = 3 }: { label?: string; count?: number }) {
  return <SkeletonList label={label} count={count} />;
}

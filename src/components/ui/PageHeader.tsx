import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: ReactNode;
  titleId?: string;
  /** Label kecil di atas judul (gaya eyebrow landing page) */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Aksi utama di kanan (desktop) / di bawah judul (HP) */
  actions?: ReactNode;
  /** page = halaman pelanggan (judul besar), app = dashboard admin (padat) */
  variant?: 'page' | 'app';
}

/** Judul halaman konsisten: eyebrow, judul (font display), deskripsi singkat, aksi utama */
export function PageHeader({ title, titleId, eyebrow, description, actions, variant = 'app' }: PageHeaderProps) {
  return (
    <header className={styles.head} data-variant={variant}>
      <div className={styles.text}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 id={titleId} className={styles.title}>
          {title}
        </h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

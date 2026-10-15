import type { ReactNode } from 'react';
import { useSite } from '@/lib/SiteContext';
import type { ContentState } from '@/lib/useContent';
import styles from './SectionState.module.css';

interface SectionStateProps<T> {
  state: ContentState<T>;
  tone?: 'dark' | 'light';
  /** Kapan data dianggap kosong */
  isEmpty?: (data: T) => boolean;
  /** Jumlah blok skeleton saat loading */
  skeletonCount?: number;
  children: (data: T) => ReactNode;
}

/** Tangani loading / error / kosong secara seragam untuk setiap section. */
export function SectionState<T>({ state, tone = 'dark', isEmpty, skeletonCount = 3, children }: SectionStateProps<T>) {
  const { site } = useSite();
  const toneCls = tone === 'light' ? styles.light : styles.dark;

  if (state.status === 'loading') {
    return (
      <div className={`${styles.skeletonWrap} ${toneCls}`} aria-busy="true" aria-live="polite">
        <span className="visually-hidden">{site.ui.loading}</span>
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonGrid}>
          {Array.from({ length: skeletonCount }, (_, i) => (
            <div key={i} className={styles.skeletonBlock} />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <p className={`${styles.message} ${toneCls}`} role="alert">
        {site.ui.error}
      </p>
    );
  }

  if (isEmpty?.(state.data)) {
    return <p className={`${styles.message} ${toneCls}`}>{site.ui.empty}</p>;
  }

  return <>{children(state.data)}</>;
}

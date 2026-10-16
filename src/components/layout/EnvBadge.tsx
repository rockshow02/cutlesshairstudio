import { useId, useState } from 'react';
import status from 'virtual:content-status';
import styles from './EnvBadge.module.css';

const LABELS = { development: 'DEV', staging: 'STAGING' } as const;

/**
 * Penanda environment di pojok kiri bawah (hanya development & staging, tidak ikut ter-build ke produksi).
 * Klik untuk melihat konten yang belum siap tayang (nomor contoh, TODO, cabang belum lengkap).
 */
export default function EnvBadge() {
  const env = import.meta.env.VITE_APP_ENV;
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (env !== 'development' && env !== 'staging') return null;
  const count = status.issues.length;

  return (
    <div className={styles.wrap} data-env={env}>
      {open && count > 0 && (
        <div id={listId} className={styles.panel} role="region" aria-label="Konten belum siap tayang">
          <p className={styles.panelTitle}>Belum siap tayang ke produksi ({count})</p>
          <ul>
            {status.issues.map((issue) => (
              <li key={issue}>{issue.replace(/^\s*•\s*/, '')}</li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        className={styles.badge}
        aria-expanded={count > 0 ? open : undefined}
        aria-controls={count > 0 ? listId : undefined}
        onClick={() => count > 0 && setOpen((v) => !v)}
        title={count > 0 ? 'Klik untuk melihat konten yang belum siap tayang' : `Environment: ${env}`}
      >
        {LABELS[env]}
        {count > 0 && <span className={styles.count}>{count} belum siap</span>}
      </button>
    </div>
  );
}

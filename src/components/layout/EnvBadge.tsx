import { useId, useState } from 'react';
import status from 'virtual:content-status';
import styles from './EnvBadge.module.css';

const LABELS = { development: 'DEV', staging: 'STAGING' } as const;
const SHORT = { development: 'D', staging: 'S' } as const;
const KEY = 'cutless:env-badge-collapsed';

const readCollapsed = () => {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Penanda environment di kiri atas, tepat di bawah navbar (hanya development & staging, tidak ikut
 * ter-build ke produksi). Kecil agar tidak menutupi konten/tombol di bawah layar; bisa diciutkan
 * (diingat selama sesi). Klik label untuk melihat konten yang belum siap tayang.
 */
export default function EnvBadge() {
  const env = import.meta.env.VITE_APP_ENV;
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const listId = useId();
  if (env !== 'development' && env !== 'staging') return null;
  const count = status.issues.length;

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    setOpen(false);
    try {
      sessionStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      /* penyimpanan tidak tersedia: hanya berlaku di halaman ini */
    }
  };

  return (
    <div className={styles.wrap} data-env={env} data-collapsed={collapsed || undefined}>
      <div className={styles.row}>
        {collapsed ? (
          <button type="button" className={styles.badge} onClick={toggleCollapsed} aria-label={`Tampilkan penanda ${LABELS[env]}`} title={`Environment: ${env}`}>
            {SHORT[env]}
          </button>
        ) : (
          <>
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
            <button type="button" className={styles.collapse} onClick={toggleCollapsed} aria-label="Ciutkan penanda environment" title="Ciutkan">
              ‹
            </button>
          </>
        )}
      </div>
      {open && !collapsed && count > 0 && (
        <div id={listId} className={styles.panel} role="region" aria-label="Konten belum siap tayang">
          <p className={styles.panelTitle}>Belum siap tayang ke produksi ({count})</p>
          <ul>
            {status.issues.map((issue) => (
              <li key={issue}>{issue.replace(/^\s*•\s*/, '')}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

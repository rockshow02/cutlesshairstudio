/** Toast kecil untuk sukses/gagal. Satu region aria-live (status untuk sukses, alert untuk gagal). */
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastTone } from './toastContext';
import { Icon } from './Icon';
import styles from './Toast.module.css';

interface ToastItem { id: number; tone: ToastTone; text: string }

const DURATION_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(0);
  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (text: string, tone: ToastTone = 'success') => {
      const id = ++next.current;
      setItems((list) => [...list.slice(-2), { id, tone, text }]);
      window.setTimeout(() => dismiss(id), tone === 'danger' ? DURATION_MS * 1.5 : DURATION_MS);
    },
    [dismiss],
  );
  const value = useMemo(() => show, [show]);
  const render = (tone: 'polite' | 'assertive') =>
    items
      .filter((t) => (tone === 'assertive') === (t.tone === 'danger'))
      .map((t) => (
        <div key={t.id} className={styles.toast} data-tone={t.tone}>
          <Icon name={t.tone === 'danger' ? 'alert' : t.tone === 'info' ? 'info' : 'check'} size={18} />
          <p className={styles.text}>{t.text}</p>
          <button type="button" className={styles.close} aria-label="Tutup pemberitahuan" onClick={() => dismiss(t.id)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ));
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.region}>
        <div role="status" aria-live="polite" className={styles.stack}>
          {render('polite')}
        </div>
        {/* role=alert diumumkan saat disisipkan; hanya ada bila ada toast gagal (tidak menambah elemen alert kosong) */}
        {items.some((t) => t.tone === 'danger') && (
          <div role="alert" className={styles.stack}>
            {render('assertive')}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

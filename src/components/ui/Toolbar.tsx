import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  /** Selalu tampil (mis. navigasi tanggal) */
  primary?: ReactNode;
  /** Filter: sebaris di desktop, di HP dibuka lewat tombol "Filter" sebagai panel bawah */
  filters?: ReactNode;
  /** Jumlah filter aktif (angka di tombol Filter) */
  activeCount?: number;
  /** Aksi di ujung kanan (mis. "Hari ini") */
  actions?: ReactNode;
  label?: string;
}

/**
 * Toolbar filter. Kontrol dirender SEKALI (label/id tetap unik); di HP panel filter menjadi
 * bottom sheet (Esc / Selesai / klik latar menutup).
 */
export function Toolbar({ primary, filters, activeCount = 0, actions, label = 'Filter' }: ToolbarProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('select, input, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={styles.toolbar} role="toolbar" aria-label={label}>
      {primary && <div className={styles.primary}>{primary}</div>}
      {filters && (
        <>
          <button ref={toggle} type="button" className={styles.filterToggle} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
            <Icon name="filter" size={16} />
            Filter{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
          <div className={styles.backdrop} data-open={open || undefined} onClick={() => setOpen(false)} aria-hidden="true" />
          <div ref={panel} id={panelId} className={styles.filters} data-open={open || undefined}>
            <p className={styles.sheetTitle}>Filter</p>
            <div className={styles.filterControls}>{filters}</div>
            <button type="button" className={styles.done} onClick={() => setOpen(false)}>
              Selesai
            </button>
          </div>
        </>
      )}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

/** Sheet (bottom sheet di HP, side panel di desktop) & ConfirmDialog. Memakai <dialog> native: fokus terkunci, Esc menutup. */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Field, Textarea } from './Field';
import { Icon } from './Icon';
import styles from './Overlay.module.css';

function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return ref;
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Info kecil di bawah judul (mis. status) */
  meta?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** Panel detail: naik dari bawah di HP, menempel di kanan di layar ≥ 768 px */
export function Sheet({ open, onClose, title, meta, footer, children }: SheetProps) {
  const ref = useModal(open);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={titleId}
      // React meneruskan event close dari <dialog> anak (mis. ConfirmDialog di dalam Sheet): abaikan
      onClose={(e) => e.target === e.currentTarget && onClose()}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      data-lenis-prevent
    >
      <div className={styles.sheetInner}>
        <header className={styles.sheetHead}>
          <div className={styles.sheetTitleWrap}>
            <h2 id={titleId} className={styles.sheetTitle}>
              {title}
            </h2>
            {meta && <div className={styles.sheetMeta}>{meta}</div>}
          </div>
          <button type="button" className={styles.close} aria-label="Tutup" onClick={() => ref.current?.close()}>
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className={styles.sheetBody}>{children}</div>
        {footer && <footer className={styles.sheetFoot}>{footer}</footer>}
      </div>
    </dialog>
  );
}

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  /** Default "Kembali" */
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  /** Kolom isian (mis. alasan pembatalan) */
  input?: { label: string; required?: boolean; maxLength?: number; placeholder?: string; hint?: string };
  casing?: 'upper' | 'normal';
}

/**
 * Dialog konfirmasi. Fokus awal di tombol batal (bukan tombol bahaya), Esc / klik latar = batal.
 * input.required → tombol konfirmasi aktif setelah kolom terisi.
 */
export function ConfirmDialog({ open, options, onConfirm, onCancel }: { open: boolean; options: ConfirmOptions; onConfirm: (value: string) => void; onCancel: () => void }) {
  const ref = useModal(open);
  const titleId = useId();
  const descId = useId();
  const [value, setValue] = useState('');
  const { title, message, confirmLabel, cancelLabel = 'Kembali', tone = 'danger', input, casing = 'normal' } = options;
  const missing = Boolean(input?.required) && value.trim() === '';

  useEffect(() => {
    if (!open) return;
    setValue('');
    ref.current?.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();
  }, [open, ref]);

  return (
    <dialog
      ref={ref}
      className={styles.confirm}
      aria-labelledby={titleId}
      aria-describedby={message ? descId : undefined}
      onClose={(e) => e.target === e.currentTarget && open && onCancel()}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      data-lenis-prevent
    >
      <form
        method="dialog"
        className={styles.confirmInner}
        onSubmit={(e) => {
          e.preventDefault();
          if (!missing) onConfirm(value.trim());
        }}
      >
        <h2 id={titleId} className={styles.confirmTitle}>
          {title}
        </h2>
        {message && (
          <div id={descId} className={styles.confirmText}>
            {message}
          </div>
        )}
        {input && (
          <Field label={input.label} hint={input.hint ?? (input.required ? 'Wajib diisi.' : undefined)}>
            <Textarea value={value} onChange={(e) => setValue(e.target.value)} maxLength={input.maxLength ?? 300} placeholder={input.placeholder} required={input.required} rows={3} />
          </Field>
        )}
        <div className={styles.confirmActions}>
          <Button data-cancel variant="outline-dark" casing={casing} onClick={() => ref.current?.close()}>
            {cancelLabel}
          </Button>
          <Button type="submit" variant={tone === 'danger' ? 'danger' : 'dark'} casing={casing} disabled={missing}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

import { cloneElement, forwardRef, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import styles from './Field.module.css';

interface FieldProps {
  label: ReactNode;
  /** Teks bantuan di bawah field */
  hint?: ReactNode;
  /** Pesan error di bawah field (menandai aria-invalid) */
  error?: string;
  /** Tanpa jarak bawah (mis. di dalam toolbar) */
  flush?: boolean;
  className?: string;
  /** Satu kontrol: <Input>, <Select>, <Textarea>, atau elemen form lain */
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>;
}

/** Label di atas, kontrol, lalu bantuan & error di bawah. id & aria-describedby dihubungkan otomatis. */
export function Field({ label, hint, error, flush, className, children }: FieldProps) {
  const auto = useId();
  const id = children.props.id ?? auto;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [children.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={[styles.field, flush && styles.flush, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {cloneElement(children, { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={[styles.control, className].filter(Boolean).join(' ')} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={[styles.control, styles.select, className].filter(Boolean).join(' ')} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={[styles.control, styles.textarea, className].filter(Boolean).join(' ')} {...rest} />;
});

/** Checkbox dengan label di kanan (seluruh baris bisa diklik) */
export function Checkbox({ children, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { children: ReactNode }) {
  return (
    <label className={[styles.check, className].filter(Boolean).join(' ')}>
      <input type="checkbox" {...rest} />
      <span>{children}</span>
    </label>
  );
}

/** Dua kolom di desktop (≥ 720 px), satu kolom di HP */
export function FieldGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={[styles.grid, className].filter(Boolean).join(' ')}>{children}</div>;
}

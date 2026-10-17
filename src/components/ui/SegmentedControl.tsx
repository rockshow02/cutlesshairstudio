import styles from './SegmentedControl.module.css';

interface SegmentedControlProps<T extends string> {
  /** Nama grup untuk pembaca layar */
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Lebar penuh (mis. di form HP) */
  block?: boolean;
  /** Boleh turun baris bila pilihan banyak */
  wrap?: boolean;
}

/** Pilihan satu-dari-beberapa (Harian/Mingguan). Tombol aria-pressed dalam role="group". */
export function SegmentedControl<T extends string>({ label, options, value, onChange, block, wrap }: SegmentedControlProps<T>) {
  return (
    <div className={styles.seg} role="group" aria-label={label} data-block={block || undefined} data-wrap={wrap || undefined}>
      {options.map((o) => (
        <button key={o.value} type="button" className={styles.option} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

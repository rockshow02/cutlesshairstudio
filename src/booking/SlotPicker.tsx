import { useEffect, useState } from 'react';
import { api } from '@/app/api';
import { dateChip } from '@/app/format';
import type { Slot } from '@shared/slots';
import styles from './booking.module.css';

interface SlotPickerProps {
  branch: string | number;
  service: string | number;
  /** undefined = Siapa saja */
  barber?: string | number;
  dates: string[];
  date: string;
  onDate: (date: string) => void;
  selected?: string;
  onSelect: (slot: Slot) => void;
  emptyHint?: string;
  /** Sumber data lain (admin) — default GET /api/availability */
  endpoint?: string;
  reloadKey?: number;
}

/** Pilih tanggal (chip) lalu jam (grid). Data dari GET /api/availability. */
export function SlotPicker({ branch, service, barber, dates, date, onDate, selected, onSelect, emptyHint, endpoint = '/availability', reloadKey }: SlotPickerProps) {
  const [state, setState] = useState<{ loading: boolean; slots: Slot[]; error?: string }>({ loading: true, slots: [] });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    const q = new URLSearchParams({ branch: String(branch), service: String(service), barber: barber === undefined ? 'any' : String(barber), date });
    api<{ slots: Slot[] }>(`${endpoint}?${q}`)
      .then((r) => !cancelled && setState({ loading: false, slots: r.slots }))
      .catch((e) => !cancelled && setState({ loading: false, slots: [], error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [branch, service, barber, date, endpoint, reloadKey]);

  const groups: [string, Slot[]][] = [
    ['Pagi', state.slots.filter((s) => s.time < '12:00')],
    ['Siang', state.slots.filter((s) => s.time >= '12:00' && s.time < '15:00')],
    ['Sore & malam', state.slots.filter((s) => s.time >= '15:00')],
  ];

  return (
    <div>
      <ul className={styles.dates} aria-label="Pilih tanggal">
        {dates.map((d, i) => {
          const chip = dateChip(d, i);
          return (
            <li key={d}>
              <button type="button" className={styles.date} aria-pressed={d === date} onClick={() => onDate(d)}>
                <strong>{chip.top}</strong>
                <span>{chip.bottom}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {state.error && (
        <p className={styles.alert} data-tone="error" role="alert">
          {state.error}
        </p>
      )}
      {state.loading ? (
        <p className={styles.muted} role="status">
          Memuat jam tersedia…
        </p>
      ) : state.slots.length === 0 ? (
        <p className={styles.empty}>{emptyHint ?? 'Tidak ada jam tersedia di tanggal ini. Coba tanggal lain.'}</p>
      ) : (
        groups
          .filter(([, list]) => list.length > 0)
          .map(([label, list]) => (
            <div key={label}>
              <p className={styles.slotGroup}>{label}</p>
              <ul className={styles.slots} aria-label={`Jam ${label.toLowerCase()}`}>
                {list.map((s) => (
                  <li key={s.startAt}>
                    <button type="button" className={styles.slot} aria-pressed={s.startAt === selected} onClick={() => onSelect(s)}>
                      {s.time.replace(':', '.')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
      )}
    </div>
  );
}

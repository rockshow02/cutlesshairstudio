/** Satu sumber label & nada warna status booking (pelanggan & admin). Warna ada di tokens.css (--c-<nada>*). */
import { STATUS_LABEL, type BookingStatus } from '@shared/booking';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const STATUS_TONE: Record<BookingStatus, Tone> = {
  pending: 'warning',
  confirmed: 'success',
  completed: 'info',
  no_show: 'danger',
  cancelled: 'neutral',
};

export { STATUS_LABEL };
export type { BookingStatus };

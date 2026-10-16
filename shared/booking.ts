/** Aturan booking yang dipakai bersama Worker & frontend. */

export const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'no_show', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'confirmed'];

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Menunggu konfirmasi',
  confirmed: 'Terkonfirmasi',
  completed: 'Selesai',
  no_show: 'Tidak datang',
  cancelled: 'Dibatalkan',
};

export type Actor = 'customer' | 'admin' | 'barber' | 'system';

/**
 * Transisi yang diizinkan. Selain ini ditolak API.
 * - pending → confirmed (admin), cancelled (pelanggan/admin/sistem)
 * - confirmed → completed (admin/barber), no_show (admin/barber, ≥ 15 menit setelah mulai), cancelled (pelanggan/admin)
 */
const TRANSITIONS: Record<BookingStatus, Partial<Record<BookingStatus, Actor[]>>> = {
  pending: { confirmed: ['admin'], cancelled: ['customer', 'admin', 'system'] },
  confirmed: { completed: ['admin', 'barber'], no_show: ['admin', 'barber'], cancelled: ['customer', 'admin'] },
  completed: {},
  no_show: {},
  cancelled: {},
};

export function canTransition(from: BookingStatus, to: BookingStatus, actor: Actor): boolean {
  return TRANSITIONS[from]?.[to]?.includes(actor) ?? false;
}

/** No-show paling cepat 15 menit setelah jam mulai */
export const NO_SHOW_AFTER_MIN = 15;
/** Pending tidak dikonfirmasi dalam 2 jam, atau < 60 menit sebelum jadwal → dibatalkan otomatis */
export const PENDING_TTL_MIN = 120;
export const PENDING_CUTOFF_BEFORE_START_MIN = 60;
/** Batas anti-spam per akun */
export const MAX_ACTIVE_BOOKINGS = 2;
export const MAX_BOOKINGS_PER_DAY = 5;
export const MAX_NO_SHOW = 3;

/** Kode booking 8 karakter tanpa karakter mirip (O/0, I/1/L) */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function generateBookingCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/**
 * Nomor WhatsApp Indonesia → format 62xxx. Menerima 08xx, +62, 62, dengan spasi/strip/titik.
 * null bila tidak valid (62 + 8–13 digit, digit pertama setelah 62 harus 8 untuk seluler).
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[\s().-]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  if (!/^628\d{7,12}$/.test(digits)) return null;
  return digits;
}

/** 6281234567890 → 0812-3456-7890 (tampilan) */
export function formatPhone(phone: string): string {
  const local = `0${phone.replace(/^62/, '')}`;
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
}

/**
 * Notifikasi cabang via Telegram (opsional, gratis): booking baru, pembatalan, jadwal ulang, pending.
 * Aktif hanya bila secret TELEGRAM_BOT_TOKEN ada DAN cabang mengisi telegram_chat_id.
 * Dijalankan lewat waitUntil: kegagalan Telegram tidak pernah menggagalkan booking.
 * Isi pesan tanpa nomor pelanggan lengkap (nomor ada di dashboard admin).
 */
import { STATUS_LABEL, type BookingStatus } from '../../shared/booking';
import { localDate, localTime } from '../../shared/time';
import type { Env } from '../env';
import type { BranchRow } from './availability';

export type NotifyEvent = 'new' | 'pending' | 'cancelled' | 'rescheduled' | 'auto_cancelled';

const TITLE: Record<NotifyEvent, string> = {
  new: '🆕 Booking baru',
  pending: '⏳ Booking baru, PERLU DIKONFIRMASI',
  cancelled: '❌ Booking dibatalkan',
  rescheduled: '🔁 Booking dijadwal ulang',
  auto_cancelled: '⌛ Booking pending dibatalkan otomatis',
};

export async function notifyBranch(env: Env, branch: Pick<BranchRow, 'id' | 'telegram_chat_id' | 'timezone' | 'name'>, event: NotifyEvent, bookingId: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !branch.telegram_chat_id) return;
  try {
    const b = await env.DB.prepare(
      `SELECT b.code, b.start_at, b.service_name_snapshot, b.status, c.name AS customer, ba.name AS barber
       FROM bookings b JOIN customers c ON c.id = b.customer_id JOIN barbers ba ON ba.id = b.barber_id WHERE b.id = ?`,
    )
      .bind(bookingId)
      .first<{ code: string; start_at: string; service_name_snapshot: string; status: BookingStatus; customer: string; barber: string }>();
    if (!b) return;
    const ms = Date.parse(b.start_at);
    const text = [
      `${TITLE[event]} · ${branch.name}`,
      `Kode: ${b.code}`,
      `Jadwal: ${localDate(ms, branch.timezone)} ${localTime(ms, branch.timezone)}`,
      `Layanan: ${b.service_name_snapshot}`,
      `Hairstylist: ${b.barber}`,
      `Pelanggan: ${b.customer}`,
      `Status: ${STATUS_LABEL[b.status]}`,
    ].join('\n');
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: branch.telegram_chat_id, text, disable_web_page_preview: true }),
    });
  } catch (e) {
    console.error('telegram', e);
  }
}

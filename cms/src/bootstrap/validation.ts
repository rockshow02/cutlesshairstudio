import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { UID } from './uids';

const { ValidationError } = errors;

type Data = Record<string, unknown>;

interface OpeningHourInput {
  day?: string;
  openTime?: string | null;
  closeTime?: string | null;
  isClosed?: boolean | null;
}

const toTime = (value: unknown): number | null => {
  if (!value) return null;
  const t = new Date(value as string).getTime();
  return Number.isNaN(t) ? null : t;
};

/** "10:00:00.000" → menit sejak 00:00 */
const toMinutes = (value?: string | null): number | null => {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/**
 * Validasi lintas-field yang tidak bisa diekspresikan di schema.json:
 * - Promo & Pengumuman: endDate harus setelah startDate.
 * - Pengaturan Situs: jam tutup harus setelah jam buka (kecuali hari libur).
 * Dipasang sebagai middleware Document Service → berlaku untuk panel admin, REST API, dan seed.
 */
export function registerValidation(strapi: Core.Strapi) {
  strapi.documents.use(async (context, next) => {
    if (context.action !== 'create' && context.action !== 'update') return next();
    const params = context.params as { data?: Data; documentId?: string };
    const data = params.data;
    if (!data) return next();

    if (context.uid === UID.promo || context.uid === UID.announcement) {
      let start = data.startDate;
      let end = data.endDate;
      // Update parsial: ambil nilai yang tidak dikirim dari dokumen yang ada
      if (context.action === 'update' && params.documentId && (start === undefined || end === undefined)) {
        const existing = (await strapi.documents(context.uid).findOne({
          documentId: params.documentId,
          fields: ['startDate', 'endDate'],
        })) as Data | null;
        if (start === undefined) start = existing?.startDate;
        if (end === undefined) end = existing?.endDate;
      }
      const s = toTime(start);
      const e = toTime(end);
      if (s !== null && e !== null && e <= s) {
        throw new ValidationError('Tanggal selesai harus setelah tanggal mulai.', {
          errors: [{ path: ['endDate'], message: 'Tanggal selesai harus setelah tanggal mulai.' }],
        });
      }
    }

    if (context.uid === UID.settings && Array.isArray(data.openingHours)) {
      (data.openingHours as OpeningHourInput[]).forEach((h, i) => {
        if (h.isClosed) return;
        const open = toMinutes(h.openTime);
        const close = toMinutes(h.closeTime);
        if (open === null || close === null) {
          throw new ValidationError(`Jam buka #${i + 1} (${h.day ?? '?'}): isi jam buka & tutup, atau centang "Tutup".`);
        }
        if (close <= open) {
          throw new ValidationError(`Jam buka #${i + 1} (${h.day ?? '?'}): jam tutup harus setelah jam buka.`);
        }
      });
    }

    return next();
  });
}

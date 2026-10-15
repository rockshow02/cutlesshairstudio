import type { Core } from '@strapi/strapi';
import { ALL_UIDS, COLLECTION_UIDS, SINGLE_UIDS } from './uids';

const PERMISSION_UID = 'plugin::users-permissions.permission';
const ROLE_UID = 'plugin::users-permissions.role';

/**
 * Role "Public" (pengunjung website tanpa login): HANYA baca.
 * - Collection type: find + findOne
 * - Single type (Pengaturan Situs): find
 * Izin tulis apa pun yang mungkin pernah dicentang manual akan dicabut setiap start.
 */
export async function ensurePublicReadOnly(strapi: Core.Strapi) {
  const publicRole = (await strapi.db.query(ROLE_UID).findOne({ where: { type: 'public' } })) as { id: number } | null;
  if (!publicRole) {
    strapi.log.warn('[cutless] Role Public tidak ditemukan; izin API publik belum diatur.');
    return;
  }

  const allowed = new Set<string>([
    ...COLLECTION_UIDS.flatMap((uid) => [`${uid}.find`, `${uid}.findOne`]),
    ...SINGLE_UIDS.map((uid) => `${uid}.find`),
  ]);

  const existing = (await strapi.db.query(PERMISSION_UID).findMany({
    where: { role: publicRole.id },
    select: ['id', 'action'],
  })) as { id: number; action: string }[];

  // Cabut izin selain baca untuk content type kita
  const toRemove = existing.filter((p) => ALL_UIDS.some((uid) => p.action.startsWith(`${uid}.`)) && !allowed.has(p.action));
  for (const p of toRemove) {
    await strapi.db.query(PERMISSION_UID).delete({ where: { id: p.id } });
  }

  const have = new Set(existing.map((p) => p.action));
  const toAdd = [...allowed].filter((action) => !have.has(action));
  for (const action of toAdd) {
    await strapi.db.query(PERMISSION_UID).create({ data: { action, role: publicRole.id } });
  }

  if (toAdd.length || toRemove.length) {
    strapi.log.info(`[cutless] Izin Public diperbarui: +${toAdd.length} baca, -${toRemove.length} tulis.`);
  }
}

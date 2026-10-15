import type { Core } from '@strapi/strapi';
import { UID, type CmsUid } from './uids';

/**
 * Dua role panel admin:
 * - Owner : kelola semua konten tahap 1 + Pengaturan Situs + Media Library.
 * - Staff : hanya Daftar Harga, Galeri, Pengumuman (+ Media Library untuk upload foto galeri).
 *           Tidak bisa melihat/mengubah Barber, Promo, maupun Pengaturan Situs.
 * Permission disinkronkan setiap Strapi start (idempoten): perubahan manual di panel akan
 * dikembalikan ke definisi ini, sehingga hak akses selalu sesuai dokumen.
 */
const CONTENT_ACTIONS = [
  'plugin::content-manager.explorer.create',
  'plugin::content-manager.explorer.read',
  'plugin::content-manager.explorer.update',
  'plugin::content-manager.explorer.delete',
  'plugin::content-manager.explorer.publish',
];

const MEDIA_ACTIONS = [
  'plugin::upload.read',
  'plugin::upload.assets.create',
  'plugin::upload.assets.update',
  'plugin::upload.assets.download',
  'plugin::upload.assets.copy-link',
];

interface RoleDef {
  name: string;
  code: string;
  description: string;
  subjects: CmsUid[];
}

export const ADMIN_ROLES: RoleDef[] = [
  {
    name: 'Owner',
    code: 'cutless-owner',
    description: 'Pemilik: kelola harga, barber, galeri, promo, pengumuman, dan pengaturan situs.',
    subjects: [UID.pricing, UID.barber, UID.gallery, UID.promo, UID.announcement, UID.settings],
  },
  {
    name: 'Staff',
    code: 'cutless-staff',
    description: 'Staf: kelola daftar harga, galeri, dan pengumuman saja.',
    subjects: [UID.pricing, UID.gallery, UID.announcement],
  },
];

interface ActionDef {
  actionId: string;
  section: string;
  subjects?: string[];
}

interface PermissionLike {
  action: string;
  subject?: string | null;
  properties?: Record<string, unknown>;
  conditions?: string[];
}

export async function ensureAdminRoles(strapi: Core.Strapi) {
  const roleService = strapi.service('admin::role') as unknown as {
    findOne(params: Record<string, unknown>): Promise<{ id: number } | null>;
    create(attrs: { name: string; code: string; description: string }): Promise<{ id: number }>;
    assignPermissions(roleId: number, permissions: PermissionLike[]): Promise<unknown>;
  };
  const permissionService = strapi.service('admin::permission') as unknown as {
    actionProvider: { values(): ActionDef[] };
  };
  const contentTypeService = strapi.service('admin::content-type') as unknown as {
    getPermissionsWithNestedFields(actions: ActionDef[]): PermissionLike[];
  };

  const contentActions = permissionService.actionProvider.values().filter((a) => CONTENT_ACTIONS.includes(a.actionId));
  // Permission lengkap dengan daftar field (termasuk field komponen) untuk setiap content type
  const allContentPermissions = contentTypeService.getPermissionsWithNestedFields(contentActions);
  const mediaPermissions: PermissionLike[] = MEDIA_ACTIONS.map((action) => ({ action, subject: null, properties: {}, conditions: [] }));

  for (const def of ADMIN_ROLES) {
    let role = await roleService.findOne({ code: def.code });
    if (!role) {
      role = (await roleService.findOne({ name: def.name })) ?? (await roleService.create({ name: def.name, code: def.code, description: def.description }));
      strapi.log.info(`[cutless] Role admin "${def.name}" dibuat.`);
    }

    const permissions: PermissionLike[] = [
      ...allContentPermissions
        .filter((p) => p.subject && def.subjects.includes(p.subject as CmsUid))
        .map((p) => ({ action: p.action, subject: p.subject, properties: p.properties ?? {}, conditions: [] })),
      ...mediaPermissions,
    ];
    await roleService.assignPermissions(role.id, permissions);
  }
}

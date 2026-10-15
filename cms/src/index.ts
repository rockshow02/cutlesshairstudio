import type { Core } from '@strapi/strapi';
import { registerValidation } from './bootstrap/validation';
import { ensurePublicReadOnly } from './bootstrap/public-permissions';
import { ensureAdminRoles } from './bootstrap/admin-roles';
import { ensureAdminLabels } from './bootstrap/admin-labels';

export default {
  /** Sebelum aplikasi siap: pasang validasi lintas-field di Document Service. */
  register({ strapi }: { strapi: Core.Strapi }) {
    registerValidation(strapi);
  },

  /**
   * Setiap start (idempoten):
   * 1. Role Public = read-only (find/findOne).
   * 2. Role admin Owner & Staff dengan hak akses sesuai dokumen.
   * 3. Label & bantuan field panel admin dalam bahasa Indonesia.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensurePublicReadOnly(strapi);
    await ensureAdminRoles(strapi);
    await ensureAdminLabels(strapi);
  },
};

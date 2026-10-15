import type { StrapiApp } from '@strapi/strapi/admin';

export default {
  config: {
    // Bahasa Indonesia tersedia di menu profil admin (Profil > Bahasa antarmuka).
    locales: ['id'],
    tutorials: false,
    notifications: { releases: false },
  },
  bootstrap(_app: StrapiApp) {},
};

import type { Announcement } from '@/types';

/**
 * Fallback pengumuman bila CMS tidak bisa diakses. Sengaja kosong:
 * pengumuman dikelola di CMS (Strapi → Pengumuman).
 */
export const announcements: Announcement[] = [];

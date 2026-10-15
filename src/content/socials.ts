import type { SocialLink } from '@/types';

// URL Instagram & TikTok diambil dari Pages CMS (settings.json); link yang dikosongkan
// di sana akan disembunyikan. Label & handle default di bawah dipakai sebagai cadangan.
// TODO: ganti username & URL sosial media resmi
export const socials: SocialLink[] = [
  { platform: 'instagram', label: 'Instagram', handle: '@cutlesshairstudio', url: 'https://www.instagram.com/cutlesshairstudio/' },
  { platform: 'tiktok', label: 'TikTok', handle: '@cutlesshairstudio', url: 'https://www.tiktok.com/@cutlesshairstudio' },
];

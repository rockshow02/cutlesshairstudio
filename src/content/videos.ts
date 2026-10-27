import type { VideosCopy } from '@/types';

/**
 * Label UI bagian Video yang tidak diedit admin. Daftar video (link Instagram, foto sampul, keterangan) ada di
 * src/content/videos.json (Pages CMS → Video).
 */
export const videosCopy: VideosCopy = {
  defaultKicker: 'Video',
  playLabel: 'Putar video: {caption}',
  untitled: 'video {n}',
  watchOnInstagram: 'Tonton di Instagram',
  loading: 'Memuat video dari Instagram…',
  failed: 'Video tidak bisa dimuat di sini.',
};

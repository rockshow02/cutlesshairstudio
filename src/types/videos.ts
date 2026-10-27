import type { ImageAsset, SectionHeading } from './common';

/** Label UI bagian Video (src/content/videos.ts) */
export interface VideosCopy {
  defaultKicker: string;
  /** Label tombol putar untuk pembaca layar: "{caption}" / nomor video */
  playLabel: string;
  untitled: string;
  watchOnInstagram: string;
  loading: string;
  failed: string;
}

/** Bagian Video beranda (Pages CMS → Video). null di getVideos = bagian tidak dirender. */
export interface VideosContent {
  heading: SectionHeading;
  copy: VideosCopy;
  items: { id: string; url: string; image: ImageAsset; caption?: string }[];
}

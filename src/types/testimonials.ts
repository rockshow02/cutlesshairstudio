import type { SectionHeading } from './common';

export type Rating = 1 | 2 | 3 | 4 | 5;

export interface RatingSummary {
  /** Teks tampil, mis. "4,9" (kosong bila disembunyikan di pengaturan) */
  ratingDisplay?: string;
  rating?: number;
  /** Mis. "dari 300 ulasan Google" (kosong bila disembunyikan) */
  reviewCountLabel?: string;
  /** Link halaman ulasan (Google Maps) */
  url?: string;
  ctaLabel: string;
}

export type TestimonialSource = 'Google' | 'Instagram' | 'TikTok' | 'Langsung';

export interface Testimonial {
  id: string;
  author: string;
  avatarColor: string;
  /** Mis. "2 minggu lalu" (dihitung dari tanggal ulasan) */
  relativeTime?: string;
  rating: Rating;
  text: string;
  source: TestimonialSource;
}

export interface TestimonialsCopy {
  heading: SectionHeading;
  ctaLabel: string;
  /** {count} */
  reviewCountLabel: string;
}

export interface TestimonialsContent {
  heading: SectionHeading;
  summary: RatingSummary;
  items: Testimonial[];
}

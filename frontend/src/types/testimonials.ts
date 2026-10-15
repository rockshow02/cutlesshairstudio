import type { SectionHeading } from './common';

export type Rating = 1 | 2 | 3 | 4 | 5;

export interface RatingSummary {
  rating: number;
  /** Teks tampil, mis. "4,9" */
  ratingDisplay: string;
  /** Mis. "dari 300+ ulasan Google" */
  reviewCountLabel: string;
  source: 'google';
  url: string;
  ctaLabel: string;
  /** true = data contoh, tampil badge "Contoh" */
  isPlaceholder?: boolean;
}

export interface Testimonial {
  id: string;
  author: string;
  /** Opsional: foto profil; bila kosong pakai inisial */
  avatarUrl?: string;
  avatarColor?: string;
  /** Mis. "Local Guide" */
  badge?: string;
  /** Mis. "2 minggu lalu" */
  relativeTime: string;
  rating: Rating;
  text: string;
  source: 'google' | 'instagram' | 'manual';
  /** true = ulasan contoh, WAJIB diganti sebelum live */
  isPlaceholder?: boolean;
}

export interface TestimonialsContent {
  heading: SectionHeading;
  summary: RatingSummary;
  items: Testimonial[];
}

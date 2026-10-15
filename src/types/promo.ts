import type { ImageAsset, SectionHeading } from './common';

/** Promo berbatas waktu (CMS: collection type Promo, Draft & Publish). */
export interface Promo {
  id: string;
  title: string;
  description?: string;
  image?: ImageAsset;
  ctaLabel: string;
  /** Pesan WA khusus promo; mendukung placeholder {brand} {promo}. Kosong = template umum. */
  waMessage?: string;
  /** ISO 8601 (UTC) */
  startDate: string;
  endDate: string;
  /** Kosong = semua cabang */
  branchSlugs: string[];
  /** Nama cabang yang berlaku (untuk label "Berlaku di ...") */
  branchNames: string[];
}

export interface PromoContent {
  heading: SectionHeading;
  labels: {
    /** Mendukung placeholder {date} */
    validUntil: string;
    badge: string;
  };
  items: Promo[];
}

/** Teks statis section Promo (daftar promo di src/content/promos.json) */
export type PromoCopy = Omit<PromoContent, 'items'>;

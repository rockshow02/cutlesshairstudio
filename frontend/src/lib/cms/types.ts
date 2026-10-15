/**
 * Bentuk respons mentah Strapi v5 REST API (format "flat", tanpa `attributes`).
 * Hanya dipakai oleh mapper; komponen tidak pernah melihat tipe ini.
 */
import type { AnnouncementType, GalleryStyle, PriceBadge, PriceCategoryKey } from '@/types';

export interface StrapiMeta {
  pagination?: { page: number; pageSize: number; pageCount: number; total: number };
}

export interface StrapiList<T> {
  data: T[];
  meta: StrapiMeta;
}

export interface StrapiSingle<T> {
  data: T | null;
  meta: StrapiMeta;
}

interface StrapiEntity {
  id: number;
  documentId: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
}

export interface StrapiMediaFormat {
  url: string;
  width: number;
  height: number;
}

export interface StrapiMedia {
  id: number;
  documentId?: string;
  url: string;
  alternativeText: string | null;
  width: number | null;
  height: number | null;
  formats?: Partial<Record<'thumbnail' | 'small' | 'medium' | 'large', StrapiMediaFormat>> | null;
}

export interface CmsPricingItem extends StrapiEntity {
  name: string;
  category: PriceCategoryKey;
  price: number;
  priceFrom: boolean | null;
  description: string | null;
  badge: PriceBadge | null;
  order: number | null;
  isActive: boolean;
}

export interface CmsBarber extends StrapiEntity {
  name: string;
  role: string | null;
  photo: StrapiMedia | null;
  specialty: string | null;
  whatsappNumber: string | null;
  instagram: string | null;
  order: number | null;
  isActive: boolean;
}

export interface CmsGalleryItem extends StrapiEntity {
  image: StrapiMedia | null;
  altText: string;
  styleCategory: GalleryStyle | null;
  caption: string | null;
  order: number | null;
  isActive: boolean;
}

export interface CmsPromo extends StrapiEntity {
  title: string;
  description: string | null;
  image: StrapiMedia | null;
  ctaLabel: string | null;
  waMessage: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface CmsAnnouncement extends StrapiEntity {
  message: string;
  type: AnnouncementType;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

export type CmsDay = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | 'Minggu';

export interface CmsOpeningHour {
  id: number;
  day: CmsDay;
  /** "10:00:00.000" */
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean | null;
}

export interface CmsSiteSettings extends StrapiEntity {
  logo: StrapiMedia | null;
  siteName: string;
  mainWhatsappNumber: string;
  defaultWaMessage: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  googleMapsUrl: string | null;
  address: string | null;
  footerText: string | null;
  openingHours: CmsOpeningHour[] | null;
}

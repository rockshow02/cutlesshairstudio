import type { ImageAsset, SectionHeading } from './common';

export interface Barber {
  id: string;
  name: string;
  /** Opsional (CMS: field `role`) */
  role?: string;
  specialties: string[];
  /** Foto rasio 3:4 */
  photo: ImageAsset;
  /** Opsional: URL Instagram pribadi barber */
  instagram?: string;
  /** Nomor WA khusus barber (format 62...). Kosong = pakai nomor utama. */
  whatsappNumber?: string;
}

export interface BarbersContent {
  heading: SectionHeading;
  items: Barber[];
}

/** Teks statis section Barber (data barber di src/content/barbers.json) */
export type BarbersCopy = Pick<BarbersContent, 'heading'>;

import type { SectionHeading } from './common';

/** 0 = Minggu ... 6 = Sabtu (mengikuti Date.getDay()) */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface OpeningHour {
  day: DayIndex;
  label: string;
  /** Format 24 jam "HH:mm" */
  open?: string;
  close?: string;
  closed?: boolean;
}

export interface Address {
  /** Alamat utuh dalam satu teks (dari CMS Site Settings). Bila diisi, dipakai untuk tampilan. */
  formatted?: string;
  street: string;
  area?: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface Location {
  id: string;
  /** Nama singkat untuk tab cabang, mis. "Bogor" */
  shortName: string;
  name: string;
  address: Address;
  phoneDisplay: string;
  /** Opsional: nomor WA khusus cabang; bila kosong pakai nomor utama di site */
  whatsappNumber?: string;
  hours: OpeningHour[];
  map: {
    embedUrl: string;
    directionsUrl: string;
    title: string;
  };
  geo?: { lat: number; lng: number };
}

export interface LocationsContent {
  heading: SectionHeading;
  labels: {
    hoursCaption: string;
    today: string;
    closed: string;
    directions: string;
    bookBranch: string;
    branchTabs: string;
  };
  items: Location[];
}

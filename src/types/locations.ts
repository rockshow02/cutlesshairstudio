import type { SectionHeading } from './common';
import type { Branch, BranchCopy } from './branches';

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

/** Section Lokasi: semua cabang + teks pendukung */
export interface LocationsContent {
  heading: SectionHeading;
  labels: BranchCopy['labels'];
  items: Branch[];
}

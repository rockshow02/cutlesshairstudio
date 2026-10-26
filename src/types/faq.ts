import type { SectionHeading } from './common';

/** Bagian FAQ beranda (Pages CMS → FAQ). Hanya item aktif & berjawaban; null di getFaq = bagian tidak dirender. */
export interface FaqContent {
  heading: SectionHeading;
  items: { id: string; question: string; answer: string }[];
}

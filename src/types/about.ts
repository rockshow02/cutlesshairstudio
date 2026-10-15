import type { ImageAsset, SectionHeading } from './common';

export interface AboutValue {
  title: string;
  description: string;
}

export interface AboutStat {
  /** Nilai angka; dianimasikan & diformat id-ID bila `animate` true */
  value: number;
  /** Teks tampil apa adanya (mis. tahun "2021" atau rating "4,9"). Dipakai bila `animate` false. */
  display?: string;
  prefix?: string;
  suffix?: string;
  animate?: boolean;
  label: string;
}

export interface AboutContent {
  heading: SectionHeading;
  lead: string;
  body: string[];
  image: ImageAsset;
  imageCaption: string;
  values: AboutValue[];
  stats: AboutStat[];
}

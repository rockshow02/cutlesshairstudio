import type { IconName, ImageAsset, SectionHeading } from './common';

export type PartnerTarget = 'cabang' | 'brand' | 'korporat';

/** Label UI statis (src/content/partnerCopy.ts) */
export interface PartnerCopy {
  /** Tombol "ajukan" di section detail (scroll ke form dengan jenis terpilih) */
  applyLabel: string;
  investmentLabel: string;
  form: {
    type: string;
    typePlaceholder: string;
    name: string;
    company: string;
    optional: string;
    city: string;
    phone: string;
    phoneHint: string;
    message: string;
    messagePlaceholder: string;
    required: string;
    errorSummary: string;
    opened: string;
  };
}

export interface PartnerPoint {
  title: string;
  description: string;
}

/** Halaman /partner/ (src/content/partner.json). Section bernilai null = dimatikan admin / tanpa isi → tidak dirender. */
export interface PartnerPageContent {
  /** Nomor tujuan semua tombol & form (nomor partnership, kosong → nomor pusat) */
  whatsappNumber: string;
  brandName: string;
  copy: PartnerCopy;
  hero: {
    kicker: string;
    title: string;
    subtitle: string;
    image: ImageAsset;
    /** null bila form dimatikan (tombol scroll ke form ikut hilang) */
    primaryLabel: string | null;
    secondaryLabel: string;
    /** Link wa.me tombol "Chat Tim Partnership" */
    chatHref: string;
  } | null;
  types: {
    heading: SectionHeading;
    items: { target: PartnerTarget; title: string; description: string; icon: IconName; buttonLabel: string; href: string }[];
  } | null;
  franchise: {
    heading: SectionHeading;
    reasonsTitle: string;
    reasons: PartnerPoint[];
    benefitsTitle: string;
    benefits: string[];
    stepsTitle: string;
    steps: PartnerPoint[];
    citiesTitle: string;
    cities: string[];
    investmentRange: string | null;
  } | null;
  brand: {
    heading: SectionHeading;
    forms: PartnerPoint[];
    logosTitle: string;
    /** Kosong → bagian logo tidak dirender */
    logos: { name: string; logo: ImageAsset; url: string | null }[];
  } | null;
  corporate: {
    heading: SectionHeading;
    services: (PartnerPoint & { icon: IconName })[];
    note: string | null;
  } | null;
  testimonials: {
    heading: SectionHeading;
    items: { name: string; institution: string | null; quote: string }[];
  } | null;
  faq: {
    heading: SectionHeading;
    items: { question: string; answer: string }[];
  } | null;
  form: {
    heading: SectionHeading;
    submitLabel: string;
    privacyNote: string;
    options: { value: PartnerTarget; label: string }[];
  } | null;
}

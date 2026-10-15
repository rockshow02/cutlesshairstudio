import type { ImageAsset, SectionHeading } from './common';
import type { OpeningHour } from './locations';

/** Sama dengan enum di src/content/schema.ts & .pages.yml */
export type BranchStatus = 'Aktif' | 'Segera Dibuka' | 'Tutup Sementara';
export type BranchTimezone = 'Asia/Jakarta' | 'Asia/Makassar' | 'Asia/Jayapura';

/** Satu cabang (1:1 dengan tabel `branches` di tahap booking) */
export interface Branch {
  slug: string;
  /** Nama tanpa merek, mis. "Bogor Bantarjati" */
  name: string;
  city: string;
  province: string;
  address?: string;
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
  /** Format 62xxxx */
  whatsappNumber: string;
  /** Mis. "0812-3456-7890" */
  phoneDisplay: string;
  timezone: BranchTimezone;
  hours: OpeningHour[];
  status: BranchStatus;
  photo?: ImageAsset;
  order: number;
  /** Status Aktif + nomor WA valid → boleh booking */
  bookable: boolean;
  /** URL halaman cabang, mis. "/cabang/cibubur/" */
  pageUrl: string;
  mapEmbedUrl: string;
  directionsUrl: string;
}

/** Status buka cabang saat ini (dihitung di zona waktu cabang) */
export interface BranchOpenStatus {
  state:
    | 'open'
    | 'later-today'
    | 'closed-today'
    | 'opens-tomorrow'
    | 'opens-later'
    | 'special'
    | 'coming-soon'
    | 'temporarily-closed'
    | 'unknown';
  label: string;
}

/** Teks statis seputar cabang (pemilih cabang, status buka, halaman cabang) */
export interface BranchCopy {
  heading: SectionHeading;
  indexHeading: SectionHeading;
  labels: {
    hoursCaption: string;
    today: string;
    closed: string;
    directions: string;
    book: string;
    branchTabs: string;
    selectThis: string;
    selected: string;
    viewPage: string;
    allBranches: string;
    statusBadge: Record<BranchStatus, string>;
    /** {open} {close} */
    openNow: string;
    /** {open} {close} */
    opensLaterToday: string;
    closedToday: string;
    /** {open} */
    opensTomorrow: string;
    /** {day} {open} */
    opensOn: string;
    /** {message} */
    specialHours: string;
    comingSoonNote: string;
    temporarilyClosedNote: string;
    /** {count} {cities} */
    summary: string;
    pickBranch: string;
    changeBranch: string;
    /** {branch} */
    yourBranch: string;
    /** {branch} */
    priceFor: string;
    priceVaries: string;
    /** {branch} */
    barbersFor: string;
    noBarbers: string;
    /** {branches} */
    promoFor: string;
    notFoundTitle: string;
    notFoundText: string;
    backToBranches: string;
  };
  picker: {
    title: string;
    subtitle: string;
    chooseCity: string;
    chooseBranch: string;
    nearest: string;
    nearestLoading: string;
    nearestDenied: string;
    nearestUnavailable: string;
    /** {branch} {distance} */
    nearestFound: string;
    back: string;
    close: string;
    unavailableBadge: string;
  };
}

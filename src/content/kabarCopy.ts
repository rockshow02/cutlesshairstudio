/**
 * Teks UI halaman Kabar, Promo & Acara (/kabar/, /kabar/<slug>/) dan kotak "Promo & acara" di halaman cabang. Dipakai
 * bersama oleh ringkasan statis (scripts/kabar.ts) dan komponen React supaya teksnya sama persis.
 */
import { KABAR_ALL_BRANCHES, formatKabarDate, formatKabarDateTime, kabarStartLabel, kabarStatus, type KabarArticle, type KabarSummary } from './kabarSeo';

export const kabarCopy = {
  heading: {
    kicker: 'Info terbaru',
    title: 'Kabar, Promo & Acara',
    intro: 'Kabar terbaru, promo, dan acara dari Cutless Hair Studio di setiap cabang.',
  },
  groups: {
    active: 'Sedang berlangsung & akan datang',
    news: 'Kabar terbaru',
    ended: 'Sudah berakhir',
  },
  box: { title: 'Promo & acara' },
  labels: {
    home: 'Beranda',
    published: 'Terbit',
    branches: 'Cabang',
    allBranches: 'Semua cabang',
    period: 'Periode',
    time: 'Waktu',
    location: 'Lokasi',
    openMap: 'Lihat di peta',
    eventLink: 'Buka tautan acara',
    empty: 'Belum ada kabar, promo, atau acara.',
    promoEnded: 'Promo telah berakhir',
    eventEnded: 'Acara telah selesai',
    readMore: 'Selengkapnya',
    breadcrumb: 'Breadcrumb',
    filterLabel: 'Saring kabar',
    filterBranch: 'Cabang',
    filterKind: 'Jenis',
    filterAllKinds: 'Semua',
    noMatch: 'Belum ada kabar, promo, atau acara untuk pilihan ini.',
  },
  cta: {
    /** Teks tombol bila "Teks tombol WhatsApp" kosong */
    button: 'Booking via WhatsApp',
    /** 2+ cabang: satu tombol per cabang */
    branchButton: 'Booking di {branch}',
    /** Pesan otomatis; {title} = judul, {brand} & {branch} diisi saat tombol ditekan (cabang dipilih) */
    message: 'Halo Kak! Saya tertarik dengan "{title}" di {brand} cabang {branch}.',
  },
} as const;

/** Pesan WhatsApp detail: judul diisi di sini (tanpa { } agar tidak terbaca placeholder) */
export const kabarCtaMessage = (title: string): string => kabarCopy.cta.message.replace('{title}', title.replace(/[{}]/g, ''));

export interface KabarWaButton {
  label: string;
  /** Cabang tujuan; kosong = pemilih cabang (item untuk semua cabang) */
  branchSlug?: string;
}

/**
 * Tombol WhatsApp halaman detail: 'semua' → satu tombol (pemilih cabang); satu cabang → satu tombol ke cabang itu;
 * 2+ cabang → satu tombol per cabang (urutan daftar cabang). Cabang yang tidak bisa booking dilewati.
 * Promo/Acara yang sudah berakhir → tanpa tombol.
 */
export function kabarWaButtons(a: KabarArticle, branches: { slug: string; name: string; bookable: boolean }[], now: number): KabarWaButton[] {
  if (kabarStatus(a, now) === 'berakhir') return [];
  const label = a.waLabel || kabarCopy.cta.button;
  if (a.branches.includes(KABAR_ALL_BRANCHES)) return [{ label }];
  const chosen = branches.filter((b) => b.bookable && a.branches.includes(b.slug));
  if (chosen.length === 1) return [{ label, branchSlug: chosen[0].slug }];
  return chosen.map((b) => ({ label: a.waLabel ? `${a.waLabel} (${b.name})` : kabarCopy.cta.branchButton.replace('{branch}', b.name), branchSlug: b.slug }));
}

/** "Promo telah berakhir" / "Acara telah selesai" / "Mulai <tanggal>" / undefined (sedang berlangsung & Kabar) */
export function kabarStatusLabel(k: KabarSummary, now: number): string | undefined {
  const status = kabarStatus(k, now);
  if (status === 'berakhir') return k.kind === 'Promo' ? kabarCopy.labels.promoEnded : kabarCopy.labels.eventEnded;
  if (status === 'akan-datang') return kabarStartLabel(k);
  return undefined;
}

/** Periode Promo ("Berlaku 1 Desember 2026 – 31 Desember 2026" / "Berlaku sampai ...") atau waktu Acara; Kabar → undefined */
export function kabarPeriodLabel(k: KabarSummary): string | undefined {
  if (k.kind === 'Promo' && k.validUntil) return `Berlaku ${k.validFrom ? `${formatKabarDate(k.validFrom)} – ` : 'sampai '}${formatKabarDate(k.validUntil)}`;
  if (k.kind === 'Acara' && k.startsAt && k.endsAt) return `${formatKabarDateTime(k.startsAt)} – ${formatKabarDateTime(k.endsAt)}`;
  return undefined;
}

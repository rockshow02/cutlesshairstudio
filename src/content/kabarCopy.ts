/**
 * Teks UI halaman Kabar, Promo & Acara (/kabar/, /kabar/<slug>/) dan kotak "Promo & acara" di halaman cabang. Dipakai
 * bersama oleh ringkasan statis (scripts/kabar.ts) dan komponen React supaya teksnya sama persis.
 */
import { formatKabarDate, formatKabarDateTime, kabarStartLabel, kabarStatus, type KabarSummary } from './kabarSeo';

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
  },
} as const;

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

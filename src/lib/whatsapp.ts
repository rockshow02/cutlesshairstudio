import type { Cta, SiteContent } from '@/types';

/** Normalisasi nomor ke format wa.me: hanya digit, awalan 0 diganti 62. */
export function normalizeWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
}

/** Bangun tautan WhatsApp click-to-chat dengan pesan terisi. */
export function buildWhatsAppLink(number: string, message?: string): string {
  const base = `https://wa.me/${normalizeWhatsAppNumber(number)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Isi placeholder {nama} pada template. Placeholder tanpa nilai dibiarkan apa adanya. */
export function fillTemplate(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}

/**
 * Pastikan pesan booking menyebut cabang: template yang belum memuat {branch}
 * (mis. pesan custom dari admin) disisipi "cabang {branch}" setelah {brand}.
 */
export function withBranchPlaceholder(template: string): string {
  if (template.includes('{branch}')) return template;
  return template.includes('{brand}') ? template.replace('{brand}', '{brand} cabang {branch}') : template;
}

export type MessageKind = keyof SiteContent['whatsapp']['templates'];

export interface MessageVars {
  service?: string;
  barber?: string;
  branch?: string;
  package?: string;
  product?: string;
  promo?: string;
}

/** Buat pesan dari template di konten site. Bila `vars.branch` diisi, nama cabang pasti tercantum. */
export function bookingMessage(site: SiteContent, kind: MessageKind, vars: MessageVars = {}): string {
  const template = vars.branch ? withBranchPlaceholder(site.whatsapp.templates[kind]) : site.whatsapp.templates[kind];
  return fillTemplate(template, { brand: site.brandName, ...vars });
}

/** Link WhatsApp siap pakai. `number` default: nomor pusat (pertanyaan umum). */
export function bookingLink(site: SiteContent, kind: MessageKind, vars?: MessageVars, number = site.whatsapp.number): string {
  return buildWhatsAppLink(number, bookingMessage(site, kind, vars));
}

export interface ResolvedCta {
  href: string;
  external: boolean;
}

/** Cta bertipe link → href. (Cta bertipe whatsapp ditangani useBooking agar memakai nomor cabang.) */
export function resolveLinkCta(cta: Cta): ResolvedCta | null {
  const { action } = cta;
  if (action.type !== 'link') return null;
  return { href: action.href, external: action.external ?? /^https?:/.test(action.href) };
}

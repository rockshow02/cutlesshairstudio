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

type MessageKind = keyof SiteContent['whatsapp']['templates'];

/** Buat pesan booking dari template di konten site. */
export function bookingMessage(
  site: SiteContent,
  kind: MessageKind,
  vars: { service?: string; barber?: string; branch?: string; package?: string } = {},
): string {
  return fillTemplate(site.whatsapp.templates[kind], { brand: site.brandName, ...vars });
}

/** Link booking siap pakai. `number` opsional untuk nomor cabang. */
export function bookingLink(
  site: SiteContent,
  kind: MessageKind,
  vars?: Parameters<typeof bookingMessage>[2],
  number = site.whatsapp.number,
): string {
  return buildWhatsAppLink(number, bookingMessage(site, kind, vars));
}

export interface ResolvedCta {
  href: string;
  external: boolean;
}

/** Ubah Cta dari konten menjadi href. */
export function resolveCta(cta: Cta, site: SiteContent): ResolvedCta {
  const { action } = cta;
  if (action.type === 'whatsapp') {
    const message = action.message
      ? fillTemplate(action.message, { brand: site.brandName })
      : action.service
        ? bookingMessage(site, 'service', { service: action.service })
        : bookingMessage(site, 'general');
    return { href: buildWhatsAppLink(site.whatsapp.number, message), external: true };
  }
  return { href: action.href, external: action.external ?? /^https?:/.test(action.href) };
}

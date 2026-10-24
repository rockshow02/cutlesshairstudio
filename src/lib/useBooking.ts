import type { MouseEvent } from 'react';
import type { Branch, Cta } from '@/types';
import { useSite } from './SiteContext';
import { useBranch } from './BranchContext';
import {
  bookingMessage,
  buildWhatsAppLink,
  fillTemplate,
  resolveLinkCta,
  withBranchPlaceholder,
  type MessageKind,
  type MessageVars,
} from './whatsapp';

export interface BookingOptions {
  /** Template di site.ts (default: general / "Pesan booking default" dari Pengaturan Situs) */
  kind?: MessageKind;
  vars?: MessageVars;
  /** Pesan custom (mis. pesan promo); boleh berisi {brand} {branch} {promo}. Nama cabang selalu disisipkan. */
  message?: string;
  /** Paksa cabang tertentu (mis. tombol di halaman cabang / kartu barber) */
  branchSlug?: string;
  /** Nomor tujuan khusus (mis. WA pribadi barber). Default: WA cabang. */
  number?: string;
  /** Hanya cabang ini yang boleh dipilih (mis. promo khusus cabang) */
  allowedSlugs?: string[];
}

export interface BookingTarget {
  href: string;
  /** true → buka di tab baru (link wa.me) */
  external: boolean;
  /** Ada bila cabang belum ditentukan: buka pemilih cabang dulu, lalu WhatsApp cabang itu */
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  branch?: Branch;
}

/**
 * Semua tombol booking & pesan lewat sini → WhatsApp CABANG dengan pesan yang menyebut cabang:
 * "Halo Cutless Hair Studio cabang Cibubur, saya mau booking ...".
 * Belum memilih cabang → pemilih cabang terbuka dulu, lalu WhatsApp dibuka dari klik yang sama.
 */
export function useBooking(): (options?: BookingOptions) => BookingTarget {
  const { site } = useSite();
  const { branches, effective, openPicker } = useBranch();

  const linkFor = (branch: Branch, o: BookingOptions) => {
    const vars = { ...o.vars, branch: branch.name };
    const message = o.message
      ? fillTemplate(withBranchPlaceholder(o.message), { brand: site.brandName, ...vars })
      : bookingMessage(site, o.kind ?? 'general', vars);
    return buildWhatsAppLink(o.number || branch.whatsappNumber, message);
  };

  return (options: BookingOptions = {}) => {
    const allowed = (b: Branch) => !options.allowedSlugs?.length || options.allowedSlugs.includes(b.slug);
    const forced = options.branchSlug ? branches.find((b) => b.slug === options.branchSlug) : undefined;
    const target = forced ?? (effective && effective.bookable && allowed(effective) ? effective : undefined);

    if (target?.bookable) return { href: linkFor(target, options), external: true, branch: target };

    return {
      href: '#pilih-cabang',
      external: false,
      onClick: (event) => {
        event.preventDefault();
        openPicker({
          allowedSlugs: options.allowedSlugs,
          onSelect: (branch) => window.open(linkFor(branch, options), '_blank', 'noopener,noreferrer'),
        });
      },
    };
  };
}

/** Cta dari konten (hero, CTA penutup): whatsapp → booking cabang, link → href biasa */
export function useCtaTarget(): (cta: Cta) => BookingTarget {
  const book = useBooking();
  return (cta: Cta) => {
    const link = resolveLinkCta(cta);
    if (link) return link;
    const action = cta.action as Extract<Cta['action'], { type: 'whatsapp' }>;
    return book({ kind: action.service ? 'service' : 'general', vars: { service: action.service }, message: action.message });
  };
}

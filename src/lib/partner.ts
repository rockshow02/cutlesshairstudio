/**
 * Halaman Partner: susun konten dari partner.json, dan bentuk pesan WhatsApp dari form pengajuan.
 * Tidak ada data yang dikirim ke server: form hanya membuka wa.me di perangkat pengunjung.
 */
import { PARTNER_SECTION_IDS, PARTNER_TARGET_LABELS, PARTNER_TARGETS } from '@/content/partnerOptions';
import type { PartnerEntry } from '@/content/schema';
import type { ImageAsset, PartnerCopy, PartnerPageContent, PartnerTarget, SectionHeading } from '@/types';
import { buildWhatsAppLink } from './whatsapp';
import { responsiveImage } from './contentTransforms';

/** id section (anchor) halaman partner */
export const PARTNER_IDS = { types: 'jenis-kerja-sama', ...PARTNER_SECTION_IDS, testimonials: 'testimoni-partner', faq: 'faq', form: 'ajukan' } as const;

const text = (v: string | null | undefined) => (v ?? '').trim() || null;
const heading = (s: { kicker: string; title: string; intro?: string | null }): SectionHeading => {
  const intro = text(s.intro);
  return intro ? { kicker: s.kicker, title: s.title, intro } : { kicker: s.kicker, title: s.title };
};
/** Toggle yang tidak ditulis CMS = default Zod (tampil, kecuali testimoni) */
const on = (enabled: boolean | null | undefined, fallback = true) => (enabled === undefined || enabled === null ? fallback : enabled);

/** Nomor tujuan: nomor partnership; kosong → Nomor WhatsApp pusat (Pengaturan Situs) */
export function partnerWhatsappNumber(partnershipWhatsapp: string | null | undefined, mainWhatsappNumber: string): string {
  return text(partnershipWhatsapp) ?? mainWhatsappNumber;
}

export function buildPartnerPage(
  p: PartnerEntry,
  settings: { mainWhatsappNumber: string; siteName: string },
  fallbackImage: ImageAsset,
  copy: PartnerCopy,
): PartnerPageContent {
  const number = partnerWhatsappNumber(p.partnershipWhatsapp, settings.mainWhatsappNumber);
  const brandName = settings.siteName;
  const enabled: Record<PartnerTarget, boolean> = {
    cabang: on(p.franchise.enabled),
    brand: on(p.brand.enabled),
    korporat: on(p.corporate.enabled),
  };
  const formOn = on(p.form.enabled);
  const heroImage = text(p.hero.image);

  const logos = (p.brand.logos ?? [])
    .filter((l) => l.isActive !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((l) => ({ name: l.name, logo: responsiveImage(l.logo, l.name, '160px', { width: 400, height: 200 }), url: text(l.url) }));
  const testimonials = p.testimonials.items ?? [];
  const faq = p.faq.items ?? [];
  // Kartu jenis kerja sama: hanya yang section tujuannya tampil (link anchor ke section mati tidak dirender)
  const typeItems = (p.types.items ?? [])
    .filter((t) => enabled[t.target])
    .map((t) => ({ ...t, icon: t.icon ?? 'star', href: `#${PARTNER_SECTION_IDS[t.target]}` }));

  return {
    whatsappNumber: number,
    brandName,
    copy,
    hero: on(p.hero.enabled)
      ? {
          kicker: p.hero.kicker,
          title: p.hero.title,
          subtitle: p.hero.subtitle,
          image: heroImage
            ? responsiveImage(heroImage, text(p.hero.imageAlt) ?? p.hero.title, '100vw', { width: 1920, height: 1080 })
            : fallbackImage,
          primaryLabel: formOn ? p.hero.primaryLabel : null,
          secondaryLabel: p.hero.secondaryLabel,
          chatHref: buildWhatsAppLink(number, `Halo Tim Partnership ${brandName}, saya ingin bertanya tentang kerja sama.`),
        }
      : null,
    types: on(p.types.enabled) && typeItems.length ? { heading: heading(p.types), items: typeItems } : null,
    franchise: enabled.cabang
      ? {
          heading: heading(p.franchise),
          reasonsTitle: p.franchise.reasonsTitle,
          reasons: p.franchise.reasons ?? [],
          benefitsTitle: p.franchise.benefitsTitle,
          benefits: p.franchise.benefits ?? [],
          stepsTitle: p.franchise.stepsTitle,
          steps: p.franchise.steps ?? [],
          citiesTitle: p.franchise.citiesTitle,
          cities: p.franchise.cities ?? [],
          investmentRange: text(p.franchise.investmentRange),
        }
      : null,
    brand: enabled.brand ? { heading: heading(p.brand), forms: p.brand.forms ?? [], logosTitle: p.brand.logosTitle, logos } : null,
    corporate: enabled.korporat
      ? {
          heading: heading(p.corporate),
          services: (p.corporate.services ?? []).map((s) => ({ ...s, icon: s.icon ?? 'star' })),
          note: text(p.corporate.note),
        }
      : null,
    testimonials:
      on(p.testimonials.enabled, false) && testimonials.length
        ? {
            heading: heading(p.testimonials),
            items: testimonials.map((t) => ({ name: t.name, institution: text(t.institution), quote: t.quote })),
          }
        : null,
    faq: on(p.faq.enabled) && faq.length ? { heading: heading(p.faq), items: faq } : null,
    form: formOn
      ? {
          heading: heading(p.form),
          submitLabel: p.form.submitLabel,
          privacyNote: p.form.privacyNote,
          options: PARTNER_TARGETS.map((value) => ({ value, label: PARTNER_TARGET_LABELS[value] })),
        }
      : null,
  };
}

/* ---------- Form pengajuan → WhatsApp ---------- */

export interface PartnerFormValues {
  type: PartnerTarget | '';
  name: string;
  company: string;
  city: string;
  phone: string;
  message: string;
}

export const EMPTY_PARTNER_FORM: PartnerFormValues = { type: '', name: '', company: '', city: '', phone: '', message: '' };

export type PartnerFormErrors = Partial<Record<keyof PartnerFormValues, string>>;

export const PARTNER_LIMITS = { name: 80, company: 80, city: 60, phone: 20, message: 500 } as const;

/** Nomor HP Indonesia: awalan 08 atau 62 (boleh +62, spasi, strip, titik), 10–15 digit */
const PHONE = /^(08\d{8,12}|628\d{7,11})$/;
export const cleanPhone = (raw: string) => raw.replace(/[\s.()-]/g, '').replace(/^\+/, '');

export function validatePartnerForm(v: PartnerFormValues): PartnerFormErrors {
  const e: PartnerFormErrors = {};
  if (!v.type || !(PARTNER_TARGETS as readonly string[]).includes(v.type)) e.type = 'Pilih jenis kerja sama.';
  if (!v.name.trim()) e.name = 'Nama wajib diisi.';
  if (!v.city.trim()) e.city = 'Kota wajib diisi.';
  if (!v.phone.trim()) e.phone = 'Nomor WhatsApp wajib diisi.';
  else if (!PHONE.test(cleanPhone(v.phone))) e.phone = 'Nomor harus diawali 08 atau 62, mis. 081234567890.';
  if (!v.message.trim()) e.message = 'Pesan singkat wajib diisi.';
  for (const [key, max] of Object.entries(PARTNER_LIMITS) as [keyof typeof PARTNER_LIMITS, number][]) {
    if (!e[key] && v[key].trim().length > max) e[key] = `Maksimal ${max} karakter.`;
  }
  return e;
}

/** Pesan WhatsApp rapi berisi semua isian form */
export function buildPartnerMessage(v: PartnerFormValues, brandName: string): string {
  return [
    `Halo Tim Partnership ${brandName}, saya ingin mengajukan kerja sama.`,
    '',
    `*Jenis kerja sama:* ${v.type ? PARTNER_TARGET_LABELS[v.type] : '-'}`,
    `*Nama:* ${v.name.trim()}`,
    `*Perusahaan/brand:* ${v.company.trim() || '-'}`,
    `*Kota:* ${v.city.trim()}`,
    `*Nomor WhatsApp:* ${cleanPhone(v.phone)}`,
    '',
    '*Pesan:*',
    v.message.trim(),
  ].join('\n');
}

export const partnerFormLink = (number: string, v: PartnerFormValues, brandName: string) =>
  buildWhatsAppLink(number, buildPartnerMessage(v, brandName));

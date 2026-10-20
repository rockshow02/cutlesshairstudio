/**
 * Pilihan tetap Halaman Partner. Dipakai skema Zod (schema.ts), .pages.yml (pilihan select, dijaga tes), dan
 * frontend. Tanpa Zod agar aman diimpor ke kode browser.
 */

/** Jenis kerja sama: kunci tetap untuk kartu pilihan, dropdown form, dan anchor section */
export const PARTNER_TARGETS = ['cabang', 'brand', 'korporat'] as const;
export type PartnerTarget = (typeof PARTNER_TARGETS)[number];

/** id section (anchor) tiap jenis kerja sama */
export const PARTNER_SECTION_IDS: Record<PartnerTarget, string> = {
  cabang: 'kemitraan-cabang',
  brand: 'brand-kolaborasi',
  korporat: 'korporat-event',
};

/** Nama jenis kerja sama di dropdown form & pesan WhatsApp */
export const PARTNER_TARGET_LABELS: Record<PartnerTarget, string> = {
  cabang: 'Kemitraan Cabang',
  brand: 'Brand & Kolaborasi',
  korporat: 'Korporat & Event',
};

/** Ikon yang boleh dipilih admin (src/components/ui/Icon.tsx) */
export const PARTNER_ICONS = ['store', 'handshake', 'briefcase', 'pin', 'gift', 'tag', 'calendar', 'user', 'scissors', 'star', 'check', 'shave', 'wash'] as const;
export type PartnerIcon = (typeof PARTNER_ICONS)[number];

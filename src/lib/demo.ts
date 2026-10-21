/**
 * Data demo (field "Data demo" di Pages CMS): badge "DEMO" hanya di staging & development.
 * Di produksi konstanta ini false (diganti saat build) dan build produksi menolak data demo yang tayang
 * (src/content/schema.ts → crossCheck, mode ketat).
 */
export const SHOW_DEMO_BADGE = import.meta.env.VITE_APP_ENV !== 'production';

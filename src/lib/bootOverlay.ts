import { BOOT_OVERLAY_ID } from './bootOverlayConst';
import { matches, REDUCED_MOTION_QUERY } from './useMediaQuery';

export { BOOT_FALLBACK_SECONDS, BOOT_OVERLAY_ID } from './bootOverlayConst';

/**
 * Overlay statis penutup ringkasan prerender (`.prerender`) sejak paint pertama (disisipkan ke HTML saat build oleh
 * scripts/bootOverlay.ts bila Pengaturan Situs → Tampilkan animasi pembuka aktif). Tampil tanpa JavaScript dan memudar
 * sendiri lewat CSS setelah BOOT_FALLBACK_SECONDS (pengaman bila JS gagal). Bila JS jalan, React yang melepasnya:
 * - Preloader React tampil → serah-terima seketika (tampilan sama, tanpa kedip ganda): removeBootOverlay.
 * - Preloader tidak tampil (sudah sekali per sesi / kurangi gerakan) → memudar singkat saat konten siap: fadeOutBootOverlay.
 */
const FADE_MS = 250;

const overlay = () => (typeof document === 'undefined' ? null : document.getElementById(BOOT_OVERLAY_ID));

export const hasBootOverlay = () => overlay() !== null;

/** Lepas seketika (Preloader React sudah menutupi layar dengan tampilan yang sama) */
export function removeBootOverlay() {
  overlay()?.remove();
}

/** Pudar singkat lalu lepas; "kurangi gerakan" → lepas seketika */
export function fadeOutBootOverlay() {
  const el = overlay();
  if (!el) return;
  if (matches(REDUCED_MOTION_QUERY)) {
    el.remove();
    return;
  }
  el.setAttribute('data-leave', '');
  window.setTimeout(() => el.remove(), FADE_MS + 50);
}

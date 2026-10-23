import { useEffect, type RefObject } from 'react';
import { matches, REDUCED_MOTION_QUERY, SMOOTH_SCROLL_QUERY } from '@/lib/useMediaQuery';

/**
 * Smooth scroll (Lenis) khusus desktop dengan mouse/trackpad. Di HP/tablet (layar sentuh) scroll tetap native.
 * Lenis dimuat dinamis, jadi tidak ikut terunduh di HP.
 *
 * Snap section layar penuh (hero & editorial):
 * - tanpa Lenis → CSS `scroll-snap-type: y proximity` (global.css, html:not(.lenis))
 * - dengan Lenis → lenis/snap tipe "proximity" (CSS snap bentrok dengan smooth scroll)
 */

type SnapInstance = { addElement: (el: HTMLElement, options?: { align?: string[] }) => () => void; destroy: () => void; start: () => void; stop: () => void };

let snap: SnapInstance | null = null;
/** Elemen snap yang terdaftar (ditambahkan ke lenis/snap begitu siap) */
const snapTargets = new Map<HTMLElement, (() => void) | null>();

export async function startSmoothScroll(): Promise<() => void> {
  if (!matches(SMOOTH_SCROLL_QUERY) || matches(REDUCED_MOTION_QUERY)) return () => {};
  const [{ default: Lenis }, { default: Snap }] = await Promise.all([import('lenis'), import('lenis/snap')]);
  const lenis = new Lenis({
    autoRaf: true,
    lerp: 0.12,
    // Link #section ikut halus (offset navbar dari scroll-padding/scroll-margin CSS)
    anchors: true,
    // Dialog (pemilih cabang) & area bertanda data-lenis-prevent memakai scroll native
    prevent: (node) => Boolean(node.closest('dialog, [data-lenis-prevent]')),
  });
  snap = new Snap(lenis, { type: 'proximity', distanceThreshold: '30%', duration: 0.9, debounce: 400 }) as unknown as SnapInstance;
  for (const el of snapTargets.keys()) snapTargets.set(el, snap.addElement(el, { align: ['start'] }));

  // Snap berjalan 400 ms setelah gulir roda terakhir, dari posisi saat itu. Klik link #section tepat setelah menggulir
  // (mis. gulir ke atas agar navbar muncul) membuat snap membelokkan lompatan ke section lain. Snap dijeda saat link
  // diklik dan aktif lagi pada gulir roda/trackpad pengunjung berikutnya.
  const pauseSnap = (e: MouseEvent) => {
    if (e.target instanceof Element && e.target.closest('a[href*="#"]')) snap?.stop();
  };
  const resumeSnap = () => snap?.start();
  document.addEventListener('click', pauseSnap, true);
  lenis.on('virtual-scroll', resumeSnap);

  return () => {
    document.removeEventListener('click', pauseSnap, true);
    lenis.off('virtual-scroll', resumeSnap);
    snap?.destroy();
    snap = null;
    for (const el of snapTargets.keys()) snapTargets.set(el, null);
    lenis.destroy();
  };
}

/** Daftarkan section sebagai titik snap (juga memberi atribut data-snap untuk CSS scroll snap) */
export function useSnap(ref: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    el.dataset.snap = '';
    snapTargets.set(el, snap ? snap.addElement(el, { align: ['start'] }) : null);
    return () => {
      snapTargets.get(el)?.();
      snapTargets.delete(el);
      delete el.dataset.snap;
    };
  }, [ref, enabled]);
}

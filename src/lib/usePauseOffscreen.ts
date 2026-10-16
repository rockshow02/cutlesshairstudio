import { useEffect, type RefObject } from 'react';

/**
 * Animasi CSS berulang (marquee) dijeda saat elemennya di luar layar: menandai `data-offscreen`
 * lewat IntersectionObserver, CSS lalu memasang animation-play-state: paused. Hemat CPU/baterai HP.
 */
export function usePauseOffscreen(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return;
    el.dataset.offscreen = '';
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) delete el.dataset.offscreen;
      else el.dataset.offscreen = '';
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
}

import { useCallback, useEffect, useRef, useState, type FocusEvent, type PointerEvent, type RefObject } from 'react';
import { useInView, useReducedMotion } from 'motion/react';

/** Durasi crossfade (ms); sama dengan --slide-fade di About.module.css */
export const SLIDE_FADE_MS = 800;

/**
 * Status slideshow foto: berjalan otomatis hanya bila terlihat, tab aktif, tidak di-hover/fokus, dan tidak dijeda.
 * "Kurangi gerakan" → tidak berjalan otomatis (navigasi manual saja).
 * Pemuatan bertahap: hanya foto pertama yang dimuat di awal; foto berikutnya dipasang satu per satu
 * saat slideshow berjalan (atau saat dipilih). Foto baru tampil setelah selesai dimuat (tidak berkedip kosong).
 */
export function useSlideshow({ count, intervalMs, frameRef }: { count: number; intervalMs: number; frameRef: RefObject<HTMLElement | null> }) {
  const reduce = useReducedMotion() ?? false;
  const inView = useInView(frameRef, { amount: 0.3 });
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  /** Slide yang dipilih (target) dan slide yang sedang terlihat (sudah selesai dimuat) */
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(0);
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([0]));
  const loaded = useRef(new Set<number>());
  const target = useRef(0);
  const multi = count > 1;
  const playing = multi && !reduce && !userPaused && inView && pageVisible && !hovered && !focused;

  useEffect(() => {
    const onChange = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  const mount = useCallback((i: number) => setMounted((s) => (s.has(i) ? s : new Set(s).add(i))), []);

  const go = useCallback(
    (i: number) => {
      const next = ((i % count) + count) % count;
      mount(next);
      target.current = next;
      setIndex(next);
      if (loaded.current.has(next)) setVisible(next);
    },
    [count, mount],
  );

  /** Dipanggil <img onLoad>: tampilkan bila itu slide yang sedang dituju */
  const onLoaded = useCallback((i: number) => {
    loaded.current.add(i);
    if (target.current === i) setVisible(i);
  }, []);

  // Preload satu foto berikutnya saat slideshow berjalan (bukan di awal halaman)
  useEffect(() => {
    if (playing) mount((index + 1) % count);
  }, [playing, index, count, mount]);

  // Timer: sisa waktu disimpan saat jeda, dilanjutkan saat berjalan lagi
  const elapsed = useRef(0);
  useEffect(() => {
    elapsed.current = 0;
  }, [visible]);
  useEffect(() => {
    if (!playing) return;
    const started = performance.now();
    const t = window.setTimeout(() => go(visible + 1), Math.max(0, intervalMs - elapsed.current));
    return () => {
      window.clearTimeout(t);
      elapsed.current += performance.now() - started;
    };
  }, [playing, visible, intervalMs, go]);

  return {
    multi,
    reduce,
    playing,
    userPaused,
    index,
    visible,
    mounted,
    go,
    next: () => go(visible + 1),
    prev: () => go(visible - 1),
    onLoaded,
    togglePause: () => setUserPaused((p) => !p),
    /** Pasang di bingkai foto: jeda saat di-hover (mouse) atau fokus keyboard di dalamnya */
    frameHandlers: {
      onPointerEnter: (e: PointerEvent) => e.pointerType === 'mouse' && setHovered(true),
      onPointerLeave: (e: PointerEvent) => e.pointerType === 'mouse' && setHovered(false),
      onFocus: () => setFocused(true),
      onBlur: (e: FocusEvent) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocused(false),
    },
  };
}

/** Geser horizontal ≥ 40 px (sentuh/pena) → sebelumnya/berikutnya; geser vertikal tetap menggulir halaman */
export function useSwipe(onPrev: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') start.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2) (dx < 0 ? onNext : onPrev)();
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}

import { useEffect, useRef, type RefObject } from 'react';
import { motionValue, useTransform, type MotionValue } from 'motion/react';

/**
 * Progress scroll (0–1) sebuah elemen untuk animasi scroll-linked (parallax, kartu membesar),
 * memakai motion value + useTransform dari Motion.
 *
 * Kenapa tidak useScroll() bawaan Motion? Diukur di HP kelas menengah (CPU 4× lebih lambat):
 * - useScroll({ target }) membuat ViewTimeline per elemen yang memaksa layout ulang seluruh halaman
 *   (±150–200 ms per elemen saat halaman dimuat);
 * - useScroll() memeriksa ukuran dokumen setiap frame (membaca layout) selama halaman masih disusun.
 * Di sini: SATU listener scroll pasif untuk seluruh situs (hanya membaca window.scrollY), dan posisi elemen
 * dibaca dari IntersectionObserver (dihitung browser saat layout normal, tanpa memaksa layout tambahan),
 * hanya saat ukuran halaman berubah.
 */

type Mode = 'through' | 'top' | 'sticky';
interface Entry {
  el: HTMLElement;
  mode: Mode;
  range: [number, number];
}

/** Posisi scroll halaman (px), dibagi semua animasi scroll-linked */
const scrollY = motionValue(0);
const entries = new Set<Entry>();
let started = false;
let raf = 0;
let resizeObserver: ResizeObserver | undefined;

function measureAll() {
  raf = 0;
  if (entries.size === 0) return;
  const byEl = new Map([...entries].map((e) => [e.el, e]));
  // Callback pertama IntersectionObserver selalu berisi posisi terkini, tanpa getBoundingClientRect paksa
  const io = new IntersectionObserver((list) => {
    io.disconnect();
    const y = window.scrollY;
    const vh = window.innerHeight;
    for (const { target, boundingClientRect: rect } of list) {
      const e = byEl.get(target as HTMLElement);
      if (!e) continue;
      const top = rect.top + y;
      e.range =
        e.mode === 'through' ? [top - vh, top + rect.height] : e.mode === 'top' ? [top, top + rect.height] : [top, top + rect.height - vh];
    }
    // Paksa useTransform menghitung ulang dengan posisi baru
    scrollY.set(y + 0.0001);
    scrollY.set(y);
  });
  byEl.forEach((_, el) => io.observe(el));
}

function scheduleMeasure() {
  if (!raf) raf = requestAnimationFrame(measureAll);
}

function start() {
  if (started) return;
  started = true;
  scrollY.set(window.scrollY);
  window.addEventListener('scroll', () => scrollY.set(window.scrollY), { passive: true });
  window.addEventListener('resize', scheduleMeasure);
  // Section yang dimuat belakangan, gambar, dll. menggeser posisi elemen → ukur ulang
  resizeObserver = new ResizeObserver(scheduleMeasure);
  resizeObserver.observe(document.body);
}

/**
 * mode:
 * - through: elemen masuk dari bawah layar (0) → keluar di atas (1)
 * - top: tepi atas elemen di atas layar (0) → tepi bawah elemen di atas layar (1), untuk hero
 * - sticky: tepi atas elemen di atas layar (0) → tepi bawah elemen di bawah layar (1), untuk section sticky
 */
export function useScrollProgress(ref: RefObject<HTMLElement | null>, mode: Mode): MotionValue<number> {
  const entry = useRef<Entry | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    start();
    const e: Entry = { el, mode, range: [0, 1] };
    entry.current = e;
    entries.add(e);
    scheduleMeasure();
    return () => {
      entries.delete(e);
      entry.current = null;
    };
  }, [ref, mode]);

  return useTransform(scrollY, (y) => {
    const range = entry.current?.range;
    if (!range) return 0;
    const [from, to] = range;
    return to > from ? Math.min(1, Math.max(0, (y - from) / (to - from))) : 0;
  });
}

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { DISTANCE, DURATION, stagger } from '@/styles/motion';
import styles from './motion.module.css';

export interface RevealProps {
  as?: 'div' | 'li' | 'ul' | 'figure' | 'p' | 'section' | 'span' | 'article';
  className?: string;
  /** Jeda tambahan (detik) */
  delay?: number;
  /** Urutan dalam grup: jeda otomatis index × STAGGER.item (dibatasi STAGGER.max) */
  index?: number;
  /** Jarak geser dari bawah (px). 0 = fade saja */
  y?: number;
  children: ReactNode;
}

/*
 * Satu IntersectionObserver untuk SEMUA elemen Reveal + transisi CSS (opacity & transform).
 *
 * - Muncul begitu tepi atas elemen melewati garis 10% dari bawah layar (threshold 0, bukan persentase
 *   tinggi elemen), jadi elemen yang lebih tinggi dari layar tetap muncul.
 * - Area pengamatan diperluas jauh ke ATAS layar: elemen yang sudah terlewati (scroll cepat, lompat lewat
 *   menu/anchor, atau halaman dibuka di tengah) langsung dianggap terlihat dan tampil TANPA animasi.
 * - Setelah klik link #section / menu, semua yang muncul dalam ±1,5 detik tampil tanpa animasi
 *   (tidak ada area kosong saat mendarat di section tujuan).
 * - Elemen baru disembunyikan setelah observer aktif (html[data-reveal-ready]); bila skrip gagal, isi tetap terlihat.
 */
const INSTANT_MS = 1500;
let observer: IntersectionObserver | null = null;
let instantUntil = 0;

function markInstant() {
  instantUntil = performance.now() + INSTANT_MS;
}

function getObserver(): IntersectionObserver | null {
  if (observer) return observer;
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return null;
  observer = new IntersectionObserver(
    (entries) => {
      const instantWindow = performance.now() < instantUntil;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        // Sudah di atas layar saat terdeteksi, atau baru lompat lewat anchor → tampil langsung
        if (instantWindow || entry.boundingClientRect.bottom <= 0) el.dataset.revealInstant = '';
        el.dataset.reveal = 'in';
        observer?.unobserve(el);
      }
    },
    { rootMargin: '100000px 0px -10% 0px', threshold: 0 },
  );
  // Dibuka langsung ke /#section, atau berpindah lewat link #section / menu
  if (window.location.hash) markInstant();
  window.addEventListener('hashchange', markInstant);
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.('a[href*="#"]') as HTMLAnchorElement | null;
      if (a && new URL(a.href, window.location.href).pathname === window.location.pathname) markInstant();
    },
    true,
  );
  document.documentElement.dataset.revealReady = '';
  return observer;
}

/**
 * Muncul halus (fade + geser naik) saat masuk viewport, sekali saja (once).
 * Dipakai hanya untuk judul section, paragraf editorial, dan kartu galeri.
 * "Kurangi gerakan" → fade saja (CSS di motion.module.css).
 */
export function Reveal({ as = 'div', className, delay = 0, index, y = DISTANCE.reveal, children }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const Tag = as as ElementType;

  useEffect(() => {
    const el = ref.current;
    const io = getObserver();
    if (!el) return;
    if (!io) {
      el.dataset.reveal = 'in';
      return;
    }
    io.observe(el);
    return () => io.unobserve(el);
  }, []);

  const style = {
    '--reveal-delay': `${delay + (index !== undefined ? stagger(index) : 0)}s`,
    '--reveal-y': `${y}px`,
    '--reveal-dur': `${DURATION.reveal}s`,
  } as CSSProperties;

  return (
    <Tag ref={ref} className={[styles.reveal, className].filter(Boolean).join(' ')} style={style} data-reveal="out">
      {children}
    </Tag>
  );
}

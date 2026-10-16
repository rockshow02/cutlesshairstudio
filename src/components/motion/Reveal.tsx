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
 * Satu IntersectionObserver untuk SEMUA elemen Reveal (bukan satu per elemen) + transisi CSS
 * (opacity & transform). Jauh lebih ringan daripada komponen motion per elemen saat halaman berisi
 * puluhan kartu. Elemen baru disembunyikan setelah observer aktif (html[data-reveal-ready]), jadi bila
 * skrip ini gagal, isi tetap terlihat.
 */
let observer: IntersectionObserver | null = null;
function getObserver(): IntersectionObserver | null {
  if (observer) return observer;
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return null;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.reveal = 'in';
        observer?.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  document.documentElement.dataset.revealReady = '';
  return observer;
}

/**
 * Muncul halus (fade + geser naik) saat masuk viewport, sekali saja (once).
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
    '--reveal-dur': `${DURATION.slow}s`,
  } as CSSProperties;

  return (
    <Tag ref={ref} className={[styles.reveal, className].filter(Boolean).join(' ')} style={style} data-reveal="out">
      {children}
    </Tag>
  );
}

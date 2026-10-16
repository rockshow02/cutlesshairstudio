import { useRef, type ReactNode } from 'react';
import { useReducedMotion, useTransform } from 'motion/react';
import * as m from 'motion/react-m';
import { MOBILE_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import { useScrollProgress } from './useScrollProgress';

interface ParallaxProps {
  /** Fraksi pergeseran terhadap tinggi elemen (lihat PARALLAX di styles/motion.ts). Negatif = lebih cepat dari scroll. */
  speed: { desktop: number; mobile: number };
  /**
   * through: bergerak selama elemen melintasi viewport (masuk dari bawah → keluar di atas)
   * top: mulai saat elemen di puncak viewport (untuk hero)
   */
  range?: 'through' | 'top';
  className?: string;
  innerClassName?: string;
  children: ReactNode;
}

/**
 * Isi bergerak dengan kecepatan berbeda dari scroll (transform translateY saja).
 * Pembungkus luar tidak bergerak (dipakai mengukur posisi), isi di dalamnya yang digeser.
 * Mobile memakai intensitas lebih kecil; "kurangi gerakan" → diam.
 */
export function Parallax({ speed, range = 'through', className, innerClassName, children }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const amount = (mobile ? speed.mobile : speed.desktop) * 100;
  const scrollYProgress = useScrollProgress(ref, range);
  const y = useTransform(scrollYProgress, [0, 1], range === 'top' ? ['0%', `${amount}%`] : [`${-amount / 2}%`, `${amount / 2}%`]);

  return (
    <div ref={ref} className={className}>
      <m.div className={innerClassName} style={reduce ? undefined : { y }}>
        {children}
      </m.div>
    </div>
  );
}

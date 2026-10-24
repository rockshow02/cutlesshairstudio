import { useRef, type CSSProperties, type ReactNode } from 'react';
import { usePauseOffscreen } from '@/lib/usePauseOffscreen';
import styles from './motion.module.css';

interface MarqueeProps {
  /** Satu salinan isi; diduplikasi otomatis agar putaran mulus */
  children: ReactNode;
  direction: 'up' | 'down' | 'left' | 'right';
  /** Detik per putaran */
  duration: number;
  /** Dijeda dari luar (mis. tombol jeda) */
  paused?: boolean;
  className?: string;
}

/**
 * Pita berjalan tanpa henti dengan CSS transform (tanpa JavaScript per frame).
 * Berhenti saat di-hover / fokus di dalamnya, saat `paused`, dan saat di luar layar. "Kurangi gerakan" → diam.
 * Salinan kedua disembunyikan dari screen reader & keyboard (aria-hidden + inert).
 */
export function Marquee({ children, direction, duration, paused, className }: MarqueeProps) {
  const vertical = direction === 'up' || direction === 'down';
  const reverse = direction === 'down' || direction === 'right';
  const ref = useRef<HTMLDivElement>(null);
  usePauseOffscreen(ref);
  return (
    <div
      ref={ref}
      className={[styles.marquee, className].filter(Boolean).join(' ')}
      data-axis={vertical ? 'y' : 'x'}
      data-reverse={reverse || undefined}
      data-paused={paused || undefined}
      style={{ '--marquee-duration': `${duration}s` } as CSSProperties}
    >
      <div className={styles.marqueeTrack}>
        <div className={styles.marqueeGroup}>{children}</div>
        <div className={styles.marqueeGroup} aria-hidden="true" {...{ inert: '' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

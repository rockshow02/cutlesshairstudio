import * as m from 'motion/react-m';
import { DURATION, EASE, STAGGER } from '@/styles/motion';
import styles from './motion.module.css';

interface TextRevealProps {
  /** Tiap item = satu baris */
  lines: string[];
  as?: 'h1' | 'h2' | 'p';
  id?: string;
  className?: string;
  /** false = tahan di posisi awal (mis. menunggu preloader selesai) */
  play?: boolean;
  delay?: number;
}

/**
 * Teks naik per baris dari balik garis (mask). Teks lengkap tetap ada di DOM untuk screen reader & SEO.
 * "Kurangi gerakan" → hanya fade.
 */
export function TextReveal({ lines, as: Tag = 'h1', id, className, play = true, delay = 0 }: TextRevealProps) {
  return (
    <Tag id={id} className={className}>
      {lines.map((line, i) => (
        <span key={`${i}-${line}`} className={styles.lineMask}>
          <m.span
            className={styles.lineInner}
            initial={{ y: '105%', opacity: 0 }}
            animate={play ? { y: '0%', opacity: 1 } : undefined}
            transition={{
              y: { duration: DURATION.textLine, ease: EASE.expo, delay: delay + i * STAGGER.line },
              opacity: { duration: DURATION.base, ease: EASE.out, delay: delay + i * STAGGER.line },
            }}
          >
            {line}
          </m.span>
        </span>
      ))}
    </Tag>
  );
}

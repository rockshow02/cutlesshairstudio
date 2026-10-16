import type { ReactNode } from 'react';
import type { SectionHeading } from '@/types';
import { Reveal } from '@/components/motion/Reveal';
import styles from './SectionTitle.module.css';

interface SectionTitleProps {
  heading: SectionHeading;
  /** id untuk aria-labelledby section */
  id?: string;
  tone?: 'dark' | 'light';
  /** Elemen di sisi kanan (desktop), mis. rating atau link Instagram */
  aside?: ReactNode;
}

export function SectionTitle({ heading, id, tone = 'dark', aside }: SectionTitleProps) {
  return (
    <div className={styles.head}>
      <Reveal className={styles.text}>
        <p className={`${styles.kicker} ${tone === 'light' ? styles.kickerLight : ''}`}>{heading.kicker}</p>
        <h2 id={id} className={styles.title}>
          {heading.title}
        </h2>
      </Reveal>
      {(heading.intro || aside) && (
        <Reveal className={styles.aside} delay={0.08}>
          {heading.intro && <p className={`${styles.intro} ${tone === 'light' ? styles.introLight : ''}`}>{heading.intro}</p>}
          {aside}
        </Reveal>
      )}
    </div>
  );
}

/** Kicker berdiri sendiri (dipakai di luar SectionTitle) */
export function Kicker({ children, tone = 'dark', center }: { children: ReactNode; tone?: 'dark' | 'light'; center?: boolean }) {
  return (
    <p className={[styles.kicker, tone === 'light' && styles.kickerLight, center && styles.center].filter(Boolean).join(' ')}>{children}</p>
  );
}

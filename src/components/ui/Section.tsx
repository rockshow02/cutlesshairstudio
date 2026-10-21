import { forwardRef, type ReactNode } from 'react';
import { ToneShift } from '@/components/motion/ToneShift';
import { Container } from './Container';
import styles from './Section.module.css';

interface SectionProps {
  id: string;
  tone?: 'dark' | 'light';
  labelledBy?: string;
  /** warm = terang hangat (--c-paper-3), agar section terang bersebelahan tidak menyatu */
  surface?: 'warm';
  className?: string;
  children: ReactNode;
}

/**
 * Wrapper section: id anchor, scroll-margin navbar, padding vertikal dari skala spacing.
 * data-tone dipakai navbar (warna menyesuaikan latar di bawahnya) & ToneShift (perpindahan warna latar halus).
 */
export const Section = forwardRef<HTMLElement, SectionProps>(function Section(
  { id, tone = 'dark', labelledBy, surface, className, children },
  ref,
) {
  return (
    <section
      ref={ref}
      id={id}
      aria-labelledby={labelledBy}
      className={[styles.section, styles[tone], surface && styles[surface], className].filter(Boolean).join(' ')}
      data-tone={tone}
      data-surface={surface}
    >
      <ToneShift />
      <Container>{children}</Container>
    </section>
  );
});

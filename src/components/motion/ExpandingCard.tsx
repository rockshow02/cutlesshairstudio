import { useRef } from 'react';
import { useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import * as m from 'motion/react-m';
import type { ImageAsset } from '@/types';
import { MOBILE_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import { EXPAND } from '@/styles/motion';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { useSnap } from './smoothScroll';
import { useScrollProgress } from './useScrollProgress';
import styles from './motion.module.css';

interface ExpandingCardProps {
  id: string;
  /** Judul section untuk screen reader */
  heading: string;
  image: ImageAsset;
  taglines: string[];
}

/** Bagian progress scroll tempat kartu membesar penuh (sisanya untuk tagline) */
const GROW_END = 0.45;

/**
 * Kartu foto berujung bulat yang membesar menjadi lebar penuh (radius 0) seiring scroll,
 * sementara tagline berganti dengan crossfade. Scroll-linked, hanya transform & opacity:
 * - kartu: scale
 * - sudut bulat: "bingkai" sewarna latar di atas foto yang memudar saat kartu penuh
 * "Kurangi gerakan" → kartu statis lebar penuh, semua tagline tampil.
 */
export function ExpandingCard({ id, heading, image, taglines }: ExpandingCardProps) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const start = mobile ? EXPAND.startScale.mobile : EXPAND.startScale.desktop;
  const scrollYProgress = useScrollProgress(ref, 'sticky');
  const scale = useTransform(scrollYProgress, [0, GROW_END], [start, 1]);
  const corners = useTransform(scrollYProgress, [GROW_END - 0.08, GROW_END], [1, 0]);
  useSnap(ref, !reduce);

  if (reduce) {
    return (
      <section id={id} ref={ref} className={`${styles.expand} ${styles.expandStatic}`} data-tone="dark" aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`} className="visually-hidden">
          {heading}
        </h2>
        <div className={styles.expandCard}>
          <ResponsiveImage image={image} className={styles.expandImg} />
          <div className={styles.expandShade} aria-hidden="true" />
          <ul className={styles.taglinesStatic}>
            {taglines.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section id={id} ref={ref} className={styles.expand} data-tone="dark" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="visually-hidden">
        {heading}
      </h2>
      <div className={styles.expandSticky}>
        <m.div className={styles.expandCard} style={{ scale }}>
          <ResponsiveImage image={image} className={styles.expandImg} />
          <div className={styles.expandShade} aria-hidden="true" />
          <m.div className={styles.expandCorners} style={{ opacity: corners }} aria-hidden="true" />
          <ul className={styles.taglines}>
            {taglines.map((t, i) => (
              <Tagline key={t} text={t} index={i} count={taglines.length} progress={scrollYProgress} />
            ))}
          </ul>
        </m.div>
      </div>
    </section>
  );
}

/** Tiap tagline punya rentang scroll sendiri; tumpang tindih 0,05 → crossfade */
function Tagline({ text, index, count, progress }: { text: string; index: number; count: number; progress: MotionValue<number> }) {
  const from = 0.12;
  const span = (1 - from) / count;
  const a = from + index * span;
  const b = a + span;
  const fade = 0.05;
  const first = index === 0;
  const last = index === count - 1;
  const input = first ? [0, b - fade, b] : last ? [a - fade, a, 1] : [a - fade, a, b - fade, b];
  const output = first ? [1, 1, 0] : last ? [0, 1, 1] : [0, 1, 1, 0];
  const opacity = useTransform(progress, input, output);
  const y = useTransform(opacity, [0, 1], [16, 0]);
  return (
    <m.li className={styles.tagline} style={{ opacity, y }}>
      {text}
    </m.li>
  );
}

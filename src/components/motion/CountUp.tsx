import { useEffect, useRef } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { tween } from '@/lib/tween';
import { COUNT_UP, EASE } from '@/styles/motion';
import styles from './motion.module.css';

interface CountUpProps {
  value: number;
  /** Jumlah desimal (mis. 1 untuk rating 4,9) */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Teks final apa adanya (mis. "2021"); default: angka diformat id-ID */
  display?: string;
  /** false = langsung tampilkan nilai final */
  animateValue?: boolean;
  className?: string;
}

const format = (n: number, decimals: number) =>
  n.toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/**
 * Angka menghitung naik sekali saat terlihat.
 * Nilai final selalu ada SATU kali di DOM (visually-hidden) untuk screen reader; angka yang bergerak
 * digambar lewat CSS (::before + data-value) dan aria-hidden, jadi tidak terbaca dua kali.
 */
export function CountUp({ value, decimals = 0, prefix = '', suffix = '', display, animateValue = true, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const final = `${prefix}${display ?? format(value, decimals)}${suffix}`;
  const run = animateValue && !reduce;

  useEffect(() => {
    const el = ref.current;
    if (!el || !run || !inView) return;
    return tween({
      from: 0,
      to: value,
      duration: COUNT_UP.duration,
      ease: EASE.out,
      onUpdate: (v) => {
        el.dataset.value = `${prefix}${format(v, decimals)}${suffix}`;
      },
      onComplete: () => {
        el.dataset.value = final;
      },
    });
  }, [inView, run, value, decimals, prefix, suffix, final]);

  return (
    <span className={className}>
      <span className="visually-hidden">{final}</span>
      <span
        ref={ref}
        aria-hidden="true"
        className={styles.countValue}
        // Saat animasi aktif, nilai awal tetap (React tidak menimpa angka yang sedang berjalan)
        data-value={run ? `${prefix}${format(0, decimals)}${suffix}` : final}
      />
    </span>
  );
}

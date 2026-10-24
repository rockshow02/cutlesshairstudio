import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { EASE, PAGE_TRANSITION } from '@/styles/motion';
import styles from './motion.module.css';

type Phase = 'idle' | 'enter' | 'leave';

const readFlag = () => {
  try {
    return sessionStorage.getItem(PAGE_TRANSITION.sessionKey) === '1';
  } catch {
    return false;
  }
};
const writeFlag = (on: boolean) => {
  try {
    if (on) sessionStorage.setItem(PAGE_TRANSITION.sessionKey, '1');
    else sessionStorage.removeItem(PAGE_TRANSITION.sessionKey);
  } catch {
    /* penyimpanan diblokir: transisi masuk dilewati, navigasi tetap jalan */
  }
};

/**
 * Tirai singkat antarhalaman (beranda ↔ /cabang/… ↔ /produk/): menutup 200 ms → pindah halaman →
 * membuka 200 ms di halaman baru (total ≤ 400 ms). Situs ini multi-halaman, jadi link tetap <a href>
 * biasa: tanpa JavaScript navigasi tetap berjalan normal. Link ke luar situs, tab baru, tombol pengubah
 * (Ctrl/⌘/Shift), dan link #section di halaman yang sama tidak disentuh. "Kurangi gerakan" → tanpa tirai.
 */
export function PageTransition() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(() => (readFlag() ? 'enter' : 'idle'));
  const target = useRef<string | null>(null);

  useEffect(() => {
    writeFlag(false);
    // Kembali lewat tombol Back (bfcache): pastikan tirai tidak tertinggal menutup halaman
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setPhase('idle');
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  useEffect(() => {
    if (reduce) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || !a.href || a.hasAttribute('download') || (a.target && a.target !== '_self')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      target.current = url.href;
      writeFlag(true);
      setPhase('leave');
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [reduce]);

  if (phase === 'idle' || reduce) return null;

  return (
    <m.div
      aria-hidden="true"
      className={styles.curtain}
      style={{ originY: phase === 'leave' ? 1 : 0 }}
      initial={{ scaleY: phase === 'leave' ? 0 : 1 }}
      animate={{ scaleY: phase === 'leave' ? 1 : 0 }}
      transition={{ duration: phase === 'leave' ? PAGE_TRANSITION.cover : PAGE_TRANSITION.reveal, ease: EASE.inOut }}
      onAnimationComplete={() => {
        if (phase === 'leave' && target.current) window.location.assign(target.current);
        else setPhase('idle');
      }}
    />
  );
}

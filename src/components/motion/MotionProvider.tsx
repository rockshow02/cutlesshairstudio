import { useEffect, type ReactNode } from 'react';
import { domAnimation, LazyMotion, MotionConfig } from 'motion/react';
import { startSmoothScroll } from './smoothScroll';

/**
 * Motion for React versi ringan: LazyMotion + domAnimation (dimuat bersama bundle utama, bukan terpisah,
 * sehingga elemen tidak pernah "tersangkut" tak terlihat bila sebuah chunk gagal dimuat).
 * reducedMotion="user": bila pengunjung memilih "kurangi gerakan", animasi transform dimatikan
 * otomatis dan hanya fade (opacity) yang tersisa.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    startSmoothScroll()
      .then((fn) => {
        if (cancelled) fn();
        else stop = fn;
      })
      .catch(() => {
        /* Lenis gagal dimuat → scroll native, tidak masalah */
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

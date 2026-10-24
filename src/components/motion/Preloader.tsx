import { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as m from 'motion/react-m';
import type { ImageAsset } from '@/types';
import { asset } from '@/lib/asset';
import { tween } from '@/lib/tween';
import { matches, REDUCED_MOTION_QUERY } from '@/lib/useMediaQuery';
import { DURATION, EASE, PRELOADER } from '@/styles/motion';
import styles from './motion.module.css';

/** true setelah preloader selesai / dilewati → animasi masuk hero boleh dimulai */
const IntroContext = createContext(true);
export const IntroProvider = IntroContext.Provider;
export const useIntroDone = () => useContext(IntroContext);

interface PreloaderProps {
  /** Pengaturan Situs → Tampilkan animasi pembuka */
  enabled: boolean;
  /** Logo (mark) untuk animasi mask reveal */
  mark?: ImageAsset;
  /** Opsional: video pendek pengganti animasi logo */
  video?: string;
  /** Dipanggil saat tirai mulai membuka (atau langsung bila preloader dilewati) */
  onDone: () => void;
}

/** Sudah tampil di sesi ini? (sessionStorage bisa diblokir → anggap belum, tetap aman) */
function alreadyShown(): boolean {
  try {
    return sessionStorage.getItem(PRELOADER.sessionKey) === '1';
  } catch {
    return false;
  }
}
function markShown() {
  try {
    sessionStorage.setItem(PRELOADER.sessionKey, '1');
  } catch {
    /* abaikan */
  }
}

/**
 * Preloader: logo muncul dari balik garis (mask) + penghitung 0–100%, lalu tirai membuka ke hero.
 * - Maks. 1,5 detik (batas keras PRELOADER.maxMs), sekali per sesi, dilewati bila "kurangi gerakan".
 * - TIDAK menahan render: halaman (hero + gambarnya yang sudah dipreload) dirender di belakang sejak awal.
 */
export function Preloader({ enabled, mark, video, onDone }: PreloaderProps) {
  const [show] = useState(() => enabled && !alreadyShown() && !matches(REDUCED_MOTION_QUERY));
  const [phase, setPhase] = useState<'count' | 'exit' | 'gone'>(show ? 'count' : 'gone');
  const counter = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    if (!show) {
      finish();
      return;
    }
    markShown();
    const stop = tween({
      from: 0,
      to: 100,
      duration: PRELOADER.count,
      ease: EASE.inOut,
      onUpdate: (v) => {
        if (counter.current) counter.current.textContent = `${Math.round(v)}%`;
        if (bar.current) bar.current.style.transform = `scaleX(${v / 100})`;
      },
      onComplete: () => setPhase('exit'),
    });
    // Batas keras: apa pun yang terjadi, halaman terbuka paling lambat 1,5 detik
    const hard = window.setTimeout(() => {
      finish();
      setPhase('gone');
    }, PRELOADER.maxMs);
    return () => {
      stop();
      window.clearTimeout(hard);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === 'exit') finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div className={styles.preloader} aria-hidden="true">
      {/* Tirai dua bagian: membuka ke atas & ke bawah */}
      <m.div
        className={`${styles.preloaderPanel} ${styles.preloaderTop}`}
        animate={phase === 'exit' ? { y: '-100%' } : undefined}
        transition={{ duration: PRELOADER.exit, ease: EASE.inOut }}
        onAnimationComplete={() => phase === 'exit' && setPhase('gone')}
      />
      <m.div
        className={`${styles.preloaderPanel} ${styles.preloaderBottom}`}
        animate={phase === 'exit' ? { y: '100%' } : undefined}
        transition={{ duration: PRELOADER.exit, ease: EASE.inOut }}
      />
      <m.div
        className={styles.preloaderInner}
        animate={phase === 'exit' ? { opacity: 0, y: -12 } : undefined}
        transition={{ duration: DURATION.fast, ease: EASE.out }}
      >
        {video ? (
          <video className={styles.preloaderVideo} src={asset(video)} autoPlay muted playsInline preload="auto" />
        ) : (
          mark && (
            <span className={styles.lineMask}>
              <m.img
                className={styles.preloaderMark}
                src={asset(mark.src)}
                width={mark.width}
                height={mark.height}
                alt=""
                initial={{ y: '105%' }}
                animate={{ y: '0%' }}
                transition={{ duration: DURATION.slow, ease: EASE.expo, delay: 0.05 }}
              />
            </span>
          )
        )}
        <span className={styles.preloaderBar}>
          <span ref={bar} className={styles.preloaderBarFill} />
        </span>
        <span ref={counter} className={styles.preloaderCount}>
          0%
        </span>
      </m.div>
    </div>
  );
}

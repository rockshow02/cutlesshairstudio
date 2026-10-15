import type { ImageAsset } from '@/types';
import { asset } from '@/lib/asset';
import styles from './Preloader.module.css';

interface PreloaderProps {
  done: boolean;
  mark?: ImageAsset;
}

/** Logo + garis tipis, maks. 1,5 detik (dikontrol App + failsafe CSS). */
export function Preloader({ done, mark }: PreloaderProps) {
  return (
    <div className={styles.preloader} data-done={done || undefined} aria-hidden="true">
      <div className={styles.inner}>
        {mark && <img className={styles.mark} src={asset(mark.src)} width={mark.width} height={mark.height} alt="" />}
        <span className={styles.line} />
      </div>
    </div>
  );
}

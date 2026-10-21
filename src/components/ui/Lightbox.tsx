import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { ImageAsset } from '@/types';
import { asset, assetSrcSet } from '@/lib/asset';
import { Icon } from './Icon';
import styles from './Lightbox.module.css';

interface LightboxProps {
  images: ImageAsset[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  labels: { close: string; prev: string; next: string };
}

/**
 * Lightbox sederhana: dialog modal, fokus ke tombol Tutup, Esc menutup, ←/→ berganti foto, Tab berputar di dalam
 * dialog, fokus kembali ke pemicu saat ditutup. Klik latar menutup.
 */
export function Lightbox({ images, index, onIndex, onClose, labels }: LightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const image = images[index];
  const many = images.length > 1;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
      opener?.focus?.();
    };
  }, []);

  const go = (step: number) => onIndex((index + step + images.length) % images.length);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (many && e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    } else if (many && e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'Tab') {
      // Fokus tetap di dalam dialog
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button') ?? [])];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };

  if (!image) return null;
  return (
    <div
      ref={dialogRef}
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={image.alt}
      onKeyDown={onKeyDown}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <figure className={styles.figure}>
        <img className={styles.img} src={asset(image.src)} srcSet={assetSrcSet(image.srcSet)} sizes="100vw" alt={image.alt} width={image.width} height={image.height} />
        <figcaption className={styles.caption}>
          {image.alt}
          {many && (
            <span className={styles.count}>
              {index + 1}/{images.length}
            </span>
          )}
        </figcaption>
      </figure>
      <button ref={closeRef} type="button" className={`${styles.btn} ${styles.close}`} onClick={onClose} aria-label={labels.close}>
        <Icon name="close" size={22} />
      </button>
      {many && (
        <>
          <button type="button" className={`${styles.btn} ${styles.prev}`} onClick={() => go(-1)} aria-label={labels.prev}>
            <Icon name="chevron-left" size={22} />
          </button>
          <button type="button" className={`${styles.btn} ${styles.next}`} onClick={() => go(1)} aria-label={labels.next}>
            <Icon name="chevron-right" size={22} />
          </button>
        </>
      )}
    </div>
  );
}

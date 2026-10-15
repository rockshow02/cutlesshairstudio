import { useEffect, useRef, useState } from 'react';
import { useSite } from '@/lib/SiteContext';
import { useFabSuppressed } from '@/lib/fabZones';
import { useBooking } from '@/lib/useBooking';
import { Icon } from '@/components/ui/Icon';
import styles from './FloatingWhatsApp.module.css';

const INTERACTIVE = 'a, button, input, select, textarea, iframe, [role="tab"]';

/**
 * Tombol WhatsApp melayang. Disembunyikan bila:
 * 1. hero / CTA penutup / footer terlihat (area itu sudah punya tombol booking sendiri),
 * 2. ada tombol/link lain tepat di bawah posisinya (deteksi tabrakan saat scroll/resize),
 * 3. menu mobile terbuka (CSS html[data-menu-open]).
 * Dengan begitu FAB tidak pernah menutupi CTA, footer, maupun menu.
 */
export function FloatingWhatsApp() {
  const { site } = useSite();
  const inZone = useFabSuppressed();
  // Ke WA cabang terpilih; belum memilih → pemilih cabang dulu
  const booking = useBooking()();
  const [overlapping, setOverlapping] = useState(false);
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const fab = ref.current;
      if (!fab) return;
      const r = fab.getBoundingClientRect();
      const pad = 8;
      // Grid 3x3 di area FAB (+ margin) untuk mendeteksi tombol di bawahnya
      const xs = [r.left - pad, r.left + r.width / 2, r.right + pad];
      const ys = [r.top - pad, r.top + r.height / 2, r.bottom + pad];
      const points = xs.flatMap((x) => ys.map((y) => [x, y] as const));
      const hit = points.some(([x, y]) =>
        document
          .elementsFromPoint(Math.max(0, x), Math.max(0, y))
          .some((el) => !fab.contains(el) && el.closest(INTERACTIVE) && !el.closest('header')),
      );
      setOverlapping(hit);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  const hidden = inZone || overlapping;

  return (
    <a
      ref={ref}
      className={styles.fab}
      href={booking.href}
      onClick={booking.onClick}
      {...(booking.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      aria-label={site.ui.floatingWhatsApp}
      data-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      aria-hidden={hidden || undefined}
    >
      <Icon name="whatsapp" size={28} />
      <span className={styles.label}>{site.ui.floatingWhatsAppLabel}</span>
    </a>
  );
}

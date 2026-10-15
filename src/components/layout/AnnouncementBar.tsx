import { useLayoutEffect, useRef, useState } from 'react';
import { getAnnouncements } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useSite } from '@/lib/SiteContext';
import { useBranch } from '@/lib/BranchContext';
import { joinIndonesian } from '@/lib/contentTransforms';
import type { Announcement, AnnouncementType, IconName } from '@/types';
import { Icon } from '@/components/ui/Icon';
import styles from './AnnouncementBar.module.css';

const ICON: Record<AnnouncementType, IconName> = { Info: 'info', Tutup: 'alert', 'Jam Khusus': 'clock' };
const STORAGE_PREFIX = 'cutless:announcement-dismissed:';

/** Kunci "sudah ditutup": berubah bila pengumuman diedit, sehingga versi baru tampil lagi. */
const dismissKey = (a: Announcement) => `${STORAGE_PREFIX}${a.id}:${a.updatedAt ?? ''}`;

function isDismissed(a: Announcement): boolean {
  try {
    return window.localStorage.getItem(dismissKey(a)) === '1';
  } catch {
    return false;
  }
}

/**
 * Bar tipis di atas navbar (fixed, lapisan z-index navbar).
 * Tingginya ditulis ke CSS var --announce-h sehingga navbar, hero, dan offset anchor
 * otomatis bergeser: tidak ada konten yang tertutup.
 */
export function AnnouncementBar() {
  const { effective } = useBranch();
  // Cabang dipilih → pengumuman semua cabang + cabang itu; belum memilih → semua (diberi nama cabang)
  const state = useContent(() => getAnnouncements(effective?.slug), [effective?.slug]);
  const { site } = useSite();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const current =
    state.status === 'success'
      ? state.data.find((a) => !dismissed.includes(a.id) && !isDismissed(a))
      : undefined;

  // Sinkronkan tinggi bar ke CSS variable (sebelum paint agar tidak ada lompatan layout)
  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!current || !el) {
      root.style.removeProperty('--announce-h');
      root.style.removeProperty('--nav-safe-top');
      return;
    }
    const apply = () => root.style.setProperty('--announce-h', `${el.offsetHeight}px`);
    root.style.setProperty('--nav-safe-top', '0px');
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--announce-h');
      root.style.removeProperty('--nav-safe-top');
    };
  }, [current]);

  if (!current) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(dismissKey(current), '1');
    } catch {
      /* storage diblokir: tetap tutup untuk sesi ini */
    }
    setDismissed((d) => [...d, current.id]);
  };

  return (
    <div ref={ref} className={styles.bar} data-type={current.type} role="region" aria-label={site.ui.announcementRegion}>
      <p className={styles.message}>
        <Icon name={ICON[current.type]} size={16} strokeWidth={1.8} />
        <span>
          {current.branchNames.length > 0 && !effective && <strong>{joinIndonesian(current.branchNames)}: </strong>}
          {current.message}
        </span>
      </p>
      <button type="button" className={styles.close} onClick={dismiss} aria-label={site.ui.dismissAnnouncement}>
        <Icon name="close" size={16} strokeWidth={1.8} />
      </button>
    </div>
  );
}

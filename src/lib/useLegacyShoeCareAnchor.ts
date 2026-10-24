import { useEffect } from 'react';
import { getShoeCare } from './content';
import { pageUrl } from './navigation';

/**
 * Anchor lama #cuci-sepatu (section di beranda/halaman cabang sebelum ada halaman sendiri) → /cuci-sepatu/.
 * Hanya bila halaman aktif; bila mati, hash diabaikan.
 */
export function useLegacyShoeCareAnchor(ready: boolean) {
  useEffect(() => {
    if (!ready || window.location.hash !== '#cuci-sepatu') return;
    let cancelled = false;
    void getShoeCare().then((data) => {
      if (!cancelled && data) window.location.replace(pageUrl(data.pageUrl));
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);
}

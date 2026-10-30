import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { getAnnouncements, getBranchCopy, getBranches, getSite, getSocials, FATAL_ERROR_MESSAGE } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { SiteProvider } from '@/lib/SiteContext';
import { BranchProvider } from '@/lib/BranchContext';
import { useScrollToHash } from '@/lib/useScrollToHash';
import { useLegacyShoeCareAnchor } from '@/lib/useLegacyShoeCareAnchor';
import { MotionProvider } from '@/components/motion/MotionProvider';
import { IntroProvider, Preloader } from '@/components/motion/Preloader';
import { PageTransition } from '@/components/motion/PageTransition';
import { AnnouncementBar } from './AnnouncementBar';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { FloatingWhatsApp } from './FloatingWhatsApp';
import { Deferred } from '@/components/ui/Deferred';
import { installWaClickTracking } from '@/lib/waClickTracking';

/** Badge DEV/STAGING: syarat ini diganti konstanta saat build, jadi kodenya tidak ikut ke bundle produksi. */
const EnvBadge = import.meta.env.VITE_APP_ENV !== 'production' ? lazy(() => import('./EnvBadge')) : null;

interface SiteShellProps {
  /** Isi <main> halaman */
  children: ReactNode;
  /** Halaman cabang (/cabang/:slug/): section memakai cabang ini, bukan pilihan pengunjung */
  pageBranchSlug?: string;
}

/**
 * Kerangka bersama semua halaman: preloader, transisi halaman, pengumuman, navbar, footer,
 * tombol WA melayang, dan pemilih cabang. Halaman cukup mengisi `children`.
 * Konten dirender sejak awal di belakang preloader (preloader tidak menahan render/LCP).
 */
export function SiteShell({ children, pageBranchSlug }: SiteShellProps) {
  const siteState = useContent(getSite);
  const socialsState = useContent(getSocials);
  const branchesState = useContent(getBranches);
  const branchCopyState = useContent(getBranchCopy);
  // Semua pengumuman aktif (dipakai menghitung status buka "Tutup"/"Jam Khusus" per cabang)
  const announcementsState = useContent(() => getAnnouncements());
  const [introDone, setIntroDone] = useState(false);
  const onIntroDone = useCallback(() => setIntroDone(true), []);
  const states = [siteState, socialsState, branchesState, branchCopyState, announcementsState];
  const ready = states.every((st) => st.status === 'success');
  const failed = states.some((st) => st.status === 'error');

  // Title/meta/canonical tiap halaman ditulis statis saat build dari data CMS (scripts/vite-content-plugin.ts)
  // Link dari halaman lain ke section (mis. /produk/ → /#harga)
  useScrollToHash(introDone && ready);
  // #cuci-sepatu (anchor section lama) → halaman /cuci-sepatu/
  useLegacyShoeCareAnchor(ready);
  // Hitungan klik tombol WhatsApp (tanpa cookie/data pribadi; tidak menunda pembukaan WhatsApp)
  useEffect(installWaClickTracking, []);

  return (
    <MotionProvider>
      {siteState.data && (
        <Preloader
          enabled={siteState.data.intro.enabled}
          mark={siteState.data.logo.mark}
          video={siteState.data.intro.video}
          onDone={onIntroDone}
        />
      )}
      {ready && siteState.data && socialsState.data && branchesState.data && branchCopyState.data && announcementsState.data ? (
        <SiteProvider value={{ site: siteState.data, socials: socialsState.data }}>
          <BranchProvider
            branches={branchesState.data}
            copy={branchCopyState.data}
            announcements={announcementsState.data}
            pageBranchSlug={pageBranchSlug}
          >
            <IntroProvider value={introDone}>
              <AnnouncementBar />
              <Navbar />
              <main id="main" tabIndex={-1}>
                {children}
              </main>
              <Deferred>
                <Footer />
                <FloatingWhatsApp />
              </Deferred>
            </IntroProvider>
            <PageTransition />
          </BranchProvider>
        </SiteProvider>
      ) : failed ? (
        <main id="main" style={{ padding: '6rem 1.25rem', textAlign: 'center' }}>
          <p role="alert">{FATAL_ERROR_MESSAGE}</p>
        </main>
      ) : (
        <main id="main" aria-busy="true" />
      )}
      {EnvBadge && (
        <Suspense fallback={null}>
          <EnvBadge />
        </Suspense>
      )}
    </MotionProvider>
  );
}

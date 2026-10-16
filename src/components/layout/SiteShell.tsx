import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { getAnnouncements, getBranchCopy, getBranches, getSite, getSocials, FATAL_ERROR_MESSAGE } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { SiteProvider } from '@/lib/SiteContext';
import { BranchProvider } from '@/lib/BranchContext';
import { useScrollToHash } from '@/lib/useScrollToHash';
import { Preloader } from './Preloader';
import { AnnouncementBar } from './AnnouncementBar';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { FloatingWhatsApp } from './FloatingWhatsApp';

/** Badge DEV/STAGING: syarat ini diganti konstanta saat build, jadi kodenya tidak ikut ke bundle produksi. */
const EnvBadge = import.meta.env.VITE_APP_ENV !== 'production' ? lazy(() => import('./EnvBadge')) : null;

/** Preloader tampil min. 700 ms (agar animasi logo terlihat) dan maks. 1,5 detik. */
const PRELOADER_MIN = 700;
const PRELOADER_MAX = 1500;

interface SiteShellProps {
  /** Isi <main> halaman */
  children: ReactNode;
  /** Halaman cabang (/cabang/:slug/): section memakai cabang ini, bukan pilihan pengunjung */
  pageBranchSlug?: string;
}

/**
 * Kerangka bersama semua halaman: preloader, pengumuman, navbar, footer, tombol WA melayang,
 * dan pemilih cabang. Halaman cukup mengisi `children`.
 */
export function SiteShell({ children, pageBranchSlug }: SiteShellProps) {
  const siteState = useContent(getSite);
  const socialsState = useContent(getSocials);
  const branchesState = useContent(getBranches);
  const branchCopyState = useContent(getBranchCopy);
  // Semua pengumuman aktif (dipakai menghitung status buka "Tutup"/"Jam Khusus" per cabang)
  const announcementsState = useContent(() => getAnnouncements());
  const [preloaderDone, setPreloaderDone] = useState(false);
  const states = [siteState, socialsState, branchesState, branchCopyState, announcementsState];
  const ready = states.every((st) => st.status === 'success');
  const failed = states.some((st) => st.status === 'error');

  useEffect(() => {
    const t = window.setTimeout(() => setPreloaderDone(true), PRELOADER_MAX);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setPreloaderDone(true), Math.max(0, PRELOADER_MIN - performance.now()));
    return () => window.clearTimeout(t);
  }, [ready]);

  // Memicu animasi masuk hero setelah preloader selesai
  useEffect(() => {
    if (preloaderDone) document.documentElement.dataset.ready = 'true';
  }, [preloaderDone]);

  // Title/meta/canonical tiap halaman ditulis statis saat build dari data CMS (scripts/vite-content-plugin.ts)
  // Link dari halaman lain ke section (mis. /produk/ → /#harga)
  useScrollToHash(preloaderDone && ready);

  return (
    <>
      <Preloader done={preloaderDone} mark={siteState.data?.logo.mark} />
      {ready && siteState.data && socialsState.data && branchesState.data && branchCopyState.data && announcementsState.data ? (
        <SiteProvider value={{ site: siteState.data, socials: socialsState.data }}>
          <BranchProvider
            branches={branchesState.data}
            copy={branchCopyState.data}
            announcements={announcementsState.data}
            pageBranchSlug={pageBranchSlug}
          >
            <AnnouncementBar />
            <Navbar />
            <main id="main" tabIndex={-1}>
              {children}
            </main>
            <Footer />
            <FloatingWhatsApp />
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
    </>
  );
}

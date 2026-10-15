import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getSite, getSocials, FATAL_ERROR_MESSAGE } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { SiteProvider } from '@/lib/SiteContext';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { useScrollToHash } from '@/lib/useScrollToHash';
import type { SeoConfig } from '@/types';
import { Preloader } from './Preloader';
import { AnnouncementBar } from './AnnouncementBar';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { FloatingWhatsApp } from './FloatingWhatsApp';
import { StructuredData } from './StructuredData';

/** Preloader tampil min. 700 ms (agar animasi logo terlihat) dan maks. 1,5 detik. */
const PRELOADER_MIN = 700;
const PRELOADER_MAX = 1500;

interface SiteShellProps {
  /** Isi <main> halaman */
  children: ReactNode;
  /** Override SEO per halaman (mis. judul halaman Produk) */
  seo?: Partial<SeoConfig>;
}

/**
 * Kerangka bersama semua halaman: preloader, pengumuman, navbar, footer, tombol WA melayang,
 * data terstruktur, dan meta SEO. Halaman cukup mengisi `children`.
 */
export function SiteShell({ children, seo }: SiteShellProps) {
  const siteState = useContent(getSite);
  const socialsState = useContent(getSocials);
  const [preloaderDone, setPreloaderDone] = useState(false);
  const ready = siteState.status === 'success' && socialsState.status === 'success';

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

  const pageSeo = useMemo(
    () => (siteState.data ? { ...siteState.data.seo, ...seo } : undefined),
    [siteState.data, seo?.title, seo?.description, seo?.url],
  );
  useDocumentMeta(pageSeo);
  // Link dari halaman lain ke section (mis. /produk/ → /#harga)
  useScrollToHash(preloaderDone && ready);

  return (
    <>
      <Preloader done={preloaderDone} mark={siteState.data?.logo.mark} />
      {ready ? (
        <SiteProvider value={{ site: siteState.data, socials: socialsState.data }}>
          <AnnouncementBar />
          <Navbar />
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <Footer />
          <FloatingWhatsApp />
          <StructuredData />
        </SiteProvider>
      ) : siteState.status === 'error' || socialsState.status === 'error' ? (
        <main id="main" style={{ padding: '6rem 1.25rem', textAlign: 'center' }}>
          <p role="alert">{FATAL_ERROR_MESSAGE}</p>
        </main>
      ) : (
        <main id="main" aria-busy="true" />
      )}
    </>
  );
}

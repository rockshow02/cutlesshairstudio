import { useEffect, useState } from 'react';
import { getSite, getSocials, FATAL_ERROR_MESSAGE } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { SiteProvider } from '@/lib/SiteContext';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { Preloader } from '@/components/layout/Preloader';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { FloatingWhatsApp } from '@/components/layout/FloatingWhatsApp';
import { StructuredData } from '@/components/layout/StructuredData';
import { Hero } from '@/components/sections/Hero';
import { Promo } from '@/components/sections/Promo';
import { About } from '@/components/sections/About';
import { Services } from '@/components/sections/Services';
import { Pricing } from '@/components/sections/Pricing';
import { Barbers } from '@/components/sections/Barbers';
import { Gallery } from '@/components/sections/Gallery';
import { Testimonials } from '@/components/sections/Testimonials';
import { Location } from '@/components/sections/Location';
import { CtaBanner } from '@/components/sections/CtaBanner';

/** Preloader tampil min. 700 ms (agar animasi logo terlihat) dan maks. 1,5 detik. */
const PRELOADER_MIN = 700;
const PRELOADER_MAX = 1500;

export default function App() {
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

  useDocumentMeta(siteState.data?.seo);

  return (
    <>
      <Preloader done={preloaderDone} mark={siteState.data?.logo.mark} />
      {ready ? (
        <SiteProvider value={{ site: siteState.data, socials: socialsState.data }}>
          <AnnouncementBar />
          <Navbar />
          <main id="main" tabIndex={-1}>
            <Hero />
            <Promo />
            <About />
            <Services />
            <Pricing />
            <Barbers />
            <Gallery />
            <Testimonials />
            <Location />
            <CtaBanner />
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

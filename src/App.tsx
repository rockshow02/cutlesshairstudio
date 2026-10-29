import { lazy, Suspense } from 'react';
import { SiteShell } from '@/components/layout/SiteShell';
import { Hero } from '@/components/sections/Hero';
import { Promo } from '@/components/sections/Promo';
import { About } from '@/components/sections/About';
import { Showcase } from '@/components/sections/Showcase';
import { Services } from '@/components/sections/Services';
import { Pricing } from '@/components/sections/Pricing';
import { ShoeCareTeaser } from '@/components/sections/ShoeCareTeaser';
import { Barbers } from '@/components/sections/Barbers';
import { Gallery } from '@/components/sections/Gallery';
import { Videos } from '@/components/sections/Videos';
import { Products } from '@/components/sections/Products';
import { TipsLatest } from '@/components/sections/TipsLatest';
import { Faq } from '@/components/sections/Faq';
import { Location } from '@/components/sections/Location';
import { PartnerLogos } from '@/components/sections/PartnerLogos';
import { CtaBanner } from '@/components/sections/CtaBanner';
import { useSite } from '@/lib/SiteContext';
import { Deferred } from '@/components/ui/Deferred';

// Testimoni memakai Swiper (±60 KB): dimuat terpisah & hanya bila section-nya aktif di Pengaturan Situs
const Testimonials = lazy(() => import('@/components/sections/Testimonials').then((mod) => ({ default: mod.Testimonials })));

function LazyTestimonials() {
  const { site } = useSite();
  if (!site.features.testimonials) return null;
  return (
    <Suspense fallback={null}>
      <Testimonials />
    </Suspense>
  );
}

/** Halaman utama (/) */
export default function App() {
  return (
    <SiteShell>
      <Hero />
      {/* Section di bawah layar dirender setelah hero tampil (tidak memblokir tampilan pertama) */}
      <Deferred>
        <Promo />
        <About />
        <Showcase />
        <Services />
        <Pricing />
        {/* Teaser Cuci Sepatu → /cuci-sepatu/ (tidak dirender bila halaman / teaser dimatikan) */}
        <ShoeCareTeaser />
        <Barbers />
        <Gallery />
        {/* Video Instagram (facade): tidak dirender bila dimatikan / belum ada video aktif */}
        <Videos />
        <Products variant="teaser" />
        {/* Tips Terbaru (3 artikel): tidak dirender bila Tips & Trik dimatikan / belum ada artikel terbit */}
        <TipsLatest />
        <LazyTestimonials />
        <Faq />
        <Location />
        {/* Pita logo partner: tidak dirender bila dimatikan / belum ada logo aktif */}
        <PartnerLogos />
        <CtaBanner />
      </Deferred>
    </SiteShell>
  );
}

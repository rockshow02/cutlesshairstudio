import { SiteShell } from '@/components/layout/SiteShell';
import { Hero } from '@/components/sections/Hero';
import { Promo } from '@/components/sections/Promo';
import { About } from '@/components/sections/About';
import { Services } from '@/components/sections/Services';
import { Pricing } from '@/components/sections/Pricing';
import { Barbers } from '@/components/sections/Barbers';
import { Gallery } from '@/components/sections/Gallery';
import { Products } from '@/components/sections/Products';
import { Testimonials } from '@/components/sections/Testimonials';
import { Location } from '@/components/sections/Location';
import { CtaBanner } from '@/components/sections/CtaBanner';

/** Halaman utama (/) */
export default function App() {
  return (
    <SiteShell>
      <Hero />
      <Promo />
      <About />
      <Services />
      <Pricing />
      <Barbers />
      <Gallery />
      <Products variant="teaser" />
      <Testimonials />
      <Location />
      <CtaBanner />
    </SiteShell>
  );
}

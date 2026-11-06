import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { fontsReady } from '@/lib/fontsReady';
import { parseServicesPath } from '@/content/servicePages';
import { SiteShell } from '@/components/layout/SiteShell';
import { ServicePageView, ServicesIndex } from '@/components/pages/ServicePages';
import { CtaBanner } from '@/components/sections/CtaBanner';

/**
 * /layanan/          → daftar halaman layanan (dikelompokkan per kategori Daftar Harga)
 * /layanan/<slug>/   → satu halaman layanan (isi di <script id="service-page">)
 * Semua diprerender per halaman saat build (title/meta/JSON-LD unik, terbaca tanpa JavaScript).
 */
const route = parseServicesPath(window.location.pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ''), ''));

// Teks pertama tergambar dengan font situs (tanpa layout shift karena ganti font): src/lib/fontsReady.ts
void fontsReady().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <SiteShell>
        {route?.kind === 'page' ? (
          <ServicePageView />
        ) : (
          <>
            <ServicesIndex />
            <CtaBanner />
          </>
        )}
      </SiteShell>
    </StrictMode>,
  ),
);

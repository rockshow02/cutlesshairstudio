import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { SiteShell } from '@/components/layout/SiteShell';
import { Products } from '@/components/sections/Products';
import { CtaBanner } from '@/components/sections/CtaBanner';

/** Halaman /produk/ (title & meta ditulis statis di produk/index.html, diisi saat build) */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteShell>
      <Products variant="page" />
      <CtaBanner />
    </SiteShell>
  </StrictMode>,
);

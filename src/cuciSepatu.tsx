import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { SiteShell } from '@/components/layout/SiteShell';
import { ShoeCarePage } from '@/components/pages/ShoeCarePage';

/** Halaman /cuci-sepatu/ (title, meta, Open Graph & ringkasan diprerender saat build dari Partner Cuci Sepatu) */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteShell>
      <ShoeCarePage />
    </SiteShell>
  </StrictMode>,
);

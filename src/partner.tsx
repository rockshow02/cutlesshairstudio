import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { SiteShell } from '@/components/layout/SiteShell';
import { PartnerPage } from '@/components/sections/Partner';

/** Halaman /partner/ (title & meta ditulis statis di partner/index.html, diisi saat build) */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteShell>
      <PartnerPage />
    </SiteShell>
  </StrictMode>,
);

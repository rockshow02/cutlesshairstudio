import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { SiteShell } from '@/components/layout/SiteShell';
import { BookingApp } from './BookingApp';

/** /booking, /booking/saya, /booking/sukses, /masuk, /profil, /profil/lengkapi, /kebijakan-privasi */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteShell>
      <BookingApp />
    </SiteShell>
  </StrictMode>,
);

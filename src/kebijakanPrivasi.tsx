import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { fontsReady } from '@/lib/fontsReady';
import { SiteShell } from '@/components/layout/SiteShell';
import { PrivacyPage } from '@/components/pages/PrivacyPage';

/** Halaman /kebijakan-privasi/ (title, meta & isi diprerender saat build dari src/content/privacyPolicy.ts) */
void fontsReady().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <SiteShell>
        <PrivacyPage />
      </SiteShell>
    </StrictMode>,
  ),
);

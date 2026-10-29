import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { fontsReady } from '@/lib/fontsReady';
import { SiteShell } from '@/components/layout/SiteShell';
import { ShoeCarePage } from '@/components/pages/ShoeCarePage';

/** Halaman /cuci-sepatu/ (title, meta, Open Graph & ringkasan diprerender saat build dari Partner Cuci Sepatu) */
// Teks pertama tergambar dengan font situs (tanpa layout shift karena ganti font): src/lib/fontsReady.ts
void fontsReady().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <SiteShell>
        <ShoeCarePage />
      </SiteShell>
    </StrictMode>,
  ),
);

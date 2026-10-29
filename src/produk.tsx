import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { fontsReady } from '@/lib/fontsReady';
import { SiteShell } from '@/components/layout/SiteShell';
import { Products } from '@/components/sections/Products';
import { CtaBanner } from '@/components/sections/CtaBanner';

/** Halaman /produk/ (title & meta ditulis statis di produk/index.html, diisi saat build) */
// Teks pertama tergambar dengan font situs (tanpa layout shift karena ganti font): src/lib/fontsReady.ts
void fontsReady().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <SiteShell>
        <Products variant="page" />
        <CtaBanner />
      </SiteShell>
    </StrictMode>,
  ),
);

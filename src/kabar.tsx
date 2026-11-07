import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { fontsReady } from '@/lib/fontsReady';
import { getCurrentKabar } from '@/lib/kabar';
import { parseKabarPath } from '@/content/kabarSeo';
import { SiteShell } from '@/components/layout/SiteShell';
import { KabarDetail, KabarIndex } from '@/components/pages/KabarPages';
import { CtaBanner } from '@/components/sections/CtaBanner';

/**
 * /kabar/         → daftar Kabar, Promo & Acara (saringan cabang & jenis di klien)
 * /kabar/<slug>/  → satu item (isi di <script id="kabar-item">)
 * Semua diprerender saat build (title/meta/JSON-LD unik, terbaca tanpa JavaScript).
 */
const route = parseKabarPath(window.location.pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ''), ''));
const item = route?.kind === 'item' ? getCurrentKabar() : undefined;

// Teks pertama tergambar dengan font situs (tanpa layout shift karena ganti font): src/lib/fontsReady.ts
void fontsReady().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <SiteShell>
        {item ? (
          <KabarDetail item={item} />
        ) : (
          <>
            <KabarIndex />
            <CtaBanner />
          </>
        )}
      </SiteShell>
    </StrictMode>,
  ),
);

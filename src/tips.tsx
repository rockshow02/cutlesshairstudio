import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { fontsReady } from '@/lib/fontsReady';
import { tipSlugFromPath } from '@/lib/tips';
import { SiteShell } from '@/components/layout/SiteShell';
import { TipArticlePage, TipsIndex } from '@/components/pages/TipsPages';
import { CtaBanner } from '@/components/sections/CtaBanner';

/**
 * /tips/, /tips/halaman/<n>/ → daftar artikel Tips & Trik
 * /tips/<slug>/              → satu artikel (HTML-nya diprerender per artikel saat build: title/meta/JSON-LD unik,
 *                              isi artikel di <script id="tip-article">)
 */
const slug = tipSlugFromPath(window.location.pathname);

// Teks pertama tergambar dengan font situs (tanpa layout shift karena ganti font): src/lib/fontsReady.ts
void fontsReady().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <SiteShell>
        {slug ? (
          <TipArticlePage />
        ) : (
          <>
            <TipsIndex />
            <CtaBanner />
          </>
        )}
      </SiteShell>
    </StrictMode>,
  ),
);

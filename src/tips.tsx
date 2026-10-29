import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { fontsReady } from '@/lib/fontsReady';
import { pageUrl } from '@/lib/navigation';
import { categoryFromSlug, parseTipsPath, tipsPagePath } from '@/content/tipsSeo';
import { SiteShell } from '@/components/layout/SiteShell';
import { TipArticlePage, TipsIndex } from '@/components/pages/TipsPages';
import { CtaBanner } from '@/components/sections/CtaBanner';

/**
 * /tips/, /tips/halaman/<n>/                  → daftar semua artikel Tips & Trik
 * /tips/kategori/<slug>/(halaman/<n>/)        → daftar satu kategori
 * /tips/<slug>/                               → satu artikel (isi di <script id="tip-article">)
 * Semua diprerender per halaman saat build (title/meta/JSON-LD unik, terbaca tanpa JavaScript).
 */
const route = parseTipsPath(window.location.pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ''), ''));

// Link filter lama (?kategori=hair-care) → halaman kategori statis
const legacy = categoryFromSlug(new URLSearchParams(window.location.search).get('kategori'));
if (legacy && route?.kind === 'index' && !route.category) window.location.replace(pageUrl(tipsPagePath(1, legacy)));

// Teks pertama tergambar dengan font situs (tanpa layout shift karena ganti font): src/lib/fontsReady.ts
void fontsReady().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <SiteShell>
        {route?.kind === 'article' ? (
          <TipArticlePage />
        ) : (
          <>
            <TipsIndex category={route?.category} page={route?.page ?? 1} />
            <CtaBanner />
          </>
        )}
      </SiteShell>
    </StrictMode>,
  ),
);

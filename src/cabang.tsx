import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { SiteShell } from '@/components/layout/SiteShell';
import { BranchPage, BranchesIndex } from '@/components/pages/BranchPages';

/**
 * /cabang/          → daftar semua cabang
 * /cabang/<slug>/   → halaman satu cabang (HTML-nya diprerender per cabang saat build,
 *                     sehingga title/meta/JSON-LD unik & URL bisa dibuka langsung / di-refresh)
 */
const slug = window.location.pathname.match(/\/cabang\/([a-z0-9-]+)\/?/)?.[1];

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteShell pageBranchSlug={slug}>{slug ? <BranchPage /> : <BranchesIndex />}</SiteShell>
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import App from './App';
import { prefetchContent } from '@/lib/content';

// Ambil semua konten paralel sejak awal (CMS lambat → total tunggu maks. ±5 detik)
prefetchContent();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

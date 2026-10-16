import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { AdminApp } from './AdminApp';

/** /admin: dashboard admin (dilindungi Cloudflare Access) */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);

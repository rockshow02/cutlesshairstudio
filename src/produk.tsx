import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { SiteShell } from '@/components/layout/SiteShell';
import { Products } from '@/components/sections/Products';
import { CtaBanner } from '@/components/sections/CtaBanner';

/** SEO halaman /produk/ (judul & deskripsi juga ditulis statis di produk/index.html) */
const PRODUCTS_SEO = {
  title: 'Produk Perawatan Rambut | Cutless Hair Studio Bogor',
  description:
    'Pomade, hair clay, hair powder, hair tonic, dan perawatan jenggot pilihan hairstylist Cutless Hair Studio Bogor. Pesan via WhatsApp, ambil di studio atau dikirim.',
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteShell seo={PRODUCTS_SEO}>
      <Products variant="page" />
      <CtaBanner />
    </SiteShell>
  </StrictMode>,
);

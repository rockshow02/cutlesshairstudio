import type { CtaBannerCopy } from '@/types';

/**
 * Bagian CTA penutup yang tidak diedit admin. Kicker, judul, deskripsi, label tombol, dan foto latar ada di
 * src/content/cta.json (Pages CMS → CTA Penutup). Tombol selalu membuka WhatsApp cabang terpilih.
 */
export const ctaBannerCopy: CtaBannerCopy = {
  // Dipakai bila foto latar di CMS dikosongkan
  fallbackImage: { src: '/images/cta/studio.jpg', alt: 'Suasana studio Cutless Hair Studio saat hairstylist melayani pelanggan', width: 750, height: 423 },
};

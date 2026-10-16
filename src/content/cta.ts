import type { CtaBannerContent } from '@/types';

export const ctaBanner: CtaBannerContent = {
  kicker: 'On Point Always. We Got You.',
  title: 'Kursimu sudah siap.',
  description: 'Chat sekarang, pilih jam yang pas, datang tinggal duduk. Slot weekend cepat penuh, amankan dari sekarang.',
  cta: { label: import.meta.env.VITE_BOOKING_ENABLED === 'true' ? 'Booking Online' : 'Booking via WhatsApp', action: { type: 'whatsapp' } },
  // TODO: ganti dengan foto suasana studio (gelap/moody lebih bagus)
  backgroundImage: { src: '/images/cta/studio.jpg', alt: 'Suasana studio Cutless Hair Studio saat hairstylist melayani pelanggan', width: 750, height: 423 },
};

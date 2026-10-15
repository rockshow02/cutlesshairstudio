import type { CtaBannerContent } from '@/types';

export const ctaBanner: CtaBannerContent = {
  kicker: 'On Point Always. We Got You.',
  title: 'Kursimu sudah siap.',
  description: 'Chat sekarang, pilih jam yang pas, datang tinggal duduk. Slot weekend cepat penuh, amankan dari sekarang.',
  cta: { label: 'Booking via WhatsApp', action: { type: 'whatsapp' } },
  // TODO: ganti dengan foto suasana studio (gelap/moody lebih bagus)
  backgroundImage: { src: '/images/gallery/gallery-03.jpg', alt: '', width: 750, height: 423 },
};

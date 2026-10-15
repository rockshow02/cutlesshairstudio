import type { HeroContent } from '@/types';

export const hero: HeroContent = {
  kicker: 'Hair Studio · Kota Bogor',
  titleLines: ['Good Style.', 'Good Mood.'],
  subtitle:
    'Potongan on point, dikerjain hairstylist yang ngerti bentuk wajahmu. Fade, pompadour, sampai coloring, semuanya tanpa ribet.',
  // TODO: ganti dengan foto studio Cutless (landscape min. 1920px + versi portrait untuk mobile)
  image: {
    src: '/images/hero/hero-1280.jpg',
    srcSet: '/images/hero/hero-1280.jpg 1280w, /images/hero/hero-1920.jpg 1920w',
    sizes: '100vw',
    mobileSrc: '/images/hero/hero-mobile.jpg',
    alt: 'Hairstylist merapikan pompadour pelanggan di kursi barber',
    width: 1920,
    height: 1000,
  },
  // TODO (opsional): isi video latar, mis. { src: '/videos/hero.mp4', type: 'video/mp4' }
  video: undefined,
  primaryCta: { label: 'Booking via WhatsApp', action: { type: 'whatsapp' } },
  secondaryCta: { label: 'Lihat Layanan', action: { type: 'link', href: '#layanan' } },
  highlights: [
    // TODO: sesuaikan rating Google & jam buka
    { icon: 'star', text: '4,9 · Google Reviews' },
    { icon: 'clock', text: 'Buka tiap hari 10.00 – 21.00' },
  ],
  marquee: ['On Point Always', 'We Got You', 'Goodstyle Goodmood'],
};

import type { TestimonialsContent } from '@/types';

export const testimonials: TestimonialsContent = {
  heading: { kicker: 'Testimoni', title: 'Kata mereka yang udah duduk di kursi kami.' },
  // TODO: isi rating & jumlah ulasan Google asli, lalu set isPlaceholder: false
  summary: {
    rating: 4.9,
    ratingDisplay: '4,9',
    reviewCountLabel: 'dari 300+ ulasan Google',
    source: 'google',
    // TODO: ganti dengan link profil Google Maps / link ulasan bisnis
    url: 'https://www.google.com/maps/search/?api=1&query=Cutless+Hair+Studio+Bogor',
    ctaLabel: 'Lihat semua ulasan',
    isPlaceholder: true,
  },
  // TODO: WAJIB ganti dengan ulasan asli dari Google Maps lalu set isPlaceholder: false.
  // Ulasan di bawah hanya contoh tampilan dan TIDAK boleh tayang di website live.
  items: [
    { id: 't1', author: 'Aditya R.', avatarColor: '#7a6756', badge: 'Local Guide', relativeTime: '2 minggu lalu', rating: 5, source: 'google', isPlaceholder: true, text: 'Mid fade-nya rapi banget, blending halus. Hairstylist-nya nanya dulu gaya yang aku mau, nggak asal potong. Tempatnya bersih dan adem.' },
    { id: 't2', author: 'Fikri H.', avatarColor: '#5b554f', relativeTime: '1 bulan lalu', rating: 5, source: 'google', isPlaceholder: true, text: 'Booking via WA gampang, datang langsung dikerjain. Hasil pompadour tahan sampai sore. Bakal balik lagi.' },
    { id: 't3', author: 'Rizky P.', avatarColor: '#8a7a6b', badge: 'Local Guide', relativeTime: '3 minggu lalu', rating: 5, source: 'google', isPlaceholder: true, text: 'Coloring ash grey hasilnya sesuai referensi. Dijelasin juga cara rawatnya biar warnanya awet.' },
    { id: 't4', author: 'Dewi S.', avatarColor: '#44403a', relativeTime: '2 bulan lalu', rating: 5, source: 'google', isPlaceholder: true, text: 'Anak saya biasanya rewel kalau potong rambut, di sini hairstylist-nya sabar banget. Hasilnya juga keren.' },
    { id: 't5', author: 'Bima A.', avatarColor: '#63626a', badge: 'Local Guide', relativeTime: '1 bulan lalu', rating: 5, source: 'google', isPlaceholder: true, text: 'Hot towel shave-nya juara, kulit nggak iritasi sama sekali. Suasananya santai, musiknya enak.' },
  ],
};

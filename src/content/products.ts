import type { ProductsCopy } from '@/types';

/**
 * Teks halaman & section Produk (statis). Daftar produk dikelola lewat Pages CMS → src/content/products.json.
 */
export const productsCopy: ProductsCopy = {
  heading: {
    kicker: 'Produk',
    title: 'Rawat gayamu di rumah.',
    intro: 'Produk styling & perawatan yang dipakai hairstylist kami. Pesan via WhatsApp, ambil di studio atau kami kirim.',
  },
  teaserHeading: {
    kicker: 'Produk',
    title: 'Biar tetap on point sampai rumah.',
    intro: 'Pomade, clay, powder, sampai hair tonic pilihan hairstylist kami.',
  },
  labels: {
    filterLabel: 'Filter kategori produk',
    filterAll: 'Semua',
    order: 'Pesan via WhatsApp',
    orderShort: 'Pesan',
    askRestock: 'Tanya stok',
    outOfStock: 'Stok habis',
    normalPrice: 'Harga normal',
    alsoAt: 'Juga di',
    viewAll: 'Lihat semua produk',
    empty: 'Belum ada produk di kategori ini.',
  },
  // TODO: sesuaikan cara pemesanan (ongkir, area kirim, pembayaran)
  howToOrder: {
    title: 'Cara pesan',
    steps: [
      { title: 'Pilih produk', description: 'Klik "Pesan via WhatsApp" pada produk yang kamu mau.' },
      { title: 'Konfirmasi via chat', description: 'Kami cek stok, total harga, dan ongkir (bila dikirim).' },
      { title: 'Ambil atau dikirim', description: 'Ambil di studio saat potong rambut, atau kami kirim ke alamatmu.' },
    ],
  },
};

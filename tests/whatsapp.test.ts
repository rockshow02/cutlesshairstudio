/** Pesan WhatsApp otomatis: semua booking & pesanan menyebut cabang; produk menyebut nama, ukuran, dan ambil di studio. */
import { describe, expect, it } from 'vitest';
import { site } from '../src/content/site';
import { bookingMessage, buildWhatsAppLink } from '../src/lib/whatsapp';

const s = { ...site, brandName: 'Cutless Hair Studio' };

describe('pesan WhatsApp', () => {
  it('produk: nama + ukuran + cabang + ambil di studio', () => {
    const text = bookingMessage(s, 'product', { product: 'Water Based Pomade (100 gr)', branch: 'Cibubur' });
    expect(text).toBe('Halo Cutless Hair Studio cabang Cibubur, saya mau pesan Water Based Pomade (100 gr) untuk diambil di studio. Masih ada stoknya?');
    const restock = bookingMessage(s, 'productRestock', { product: 'Beard Oil (30 ml)', branch: 'Bogor Bantarjati' });
    expect(restock).toContain('cabang Bogor Bantarjati');
    expect(restock).toContain('Beard Oil (30 ml)');
  });

  it('layanan, hairstylist, paket menyebut cabang & pilihan', () => {
    expect(bookingMessage(s, 'service', { service: 'Skin Fade / Taper', branch: 'Cibubur' })).toContain('cabang Cibubur, saya mau booking Skin Fade / Taper');
    expect(bookingMessage(s, 'barber', { barber: 'Dimas', branch: 'Cibubur' })).toContain('dengan Dimas');
    expect(bookingMessage(s, 'package', { package: 'Groom Package', branch: 'Cibubur' })).toContain('paket Groom Package');
  });

  it('link wa.me: nomor dinormalisasi (08… → 628…) & pesan ter-encode', () => {
    expect(buildWhatsAppLink('0812-3456-7890', 'Halo & salam')).toBe('https://wa.me/6281234567890?text=Halo%20%26%20salam');
  });
});

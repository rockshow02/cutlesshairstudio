/**
 * Halaman /produk/ (katalog produk, pesan lewat WhatsApp) mengikuti Pengaturan Situs → Tampilkan Produk saat build,
 * sama seperti halaman Cuci Sepatu: mati → HTML /produk/ tidak ikut di-build, /produk & /produk/ dialihkan 301 ke
 * beranda, dan tidak masuk sitemap; aktif → tampil normal & masuk sitemap. Tanpa import runtime (dipakai plugin build).
 */
export const PRODUCTS_PATH = '/produk/';

export const productsVisible = (settings: { showProducts?: boolean | null }): boolean => settings.showProducts === true;

/** Aturan _redirects (Cloudflare Workers static assets) saat halaman produk mati */
export function productsRedirects(visible: boolean): string[] {
  return visible ? [] : ['/produk    /   301', '/produk/*  /   301'];
}

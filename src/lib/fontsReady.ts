/**
 * Render pertama React menunggu font situs (src/styles/fonts.css) termuat, maksimal `timeoutMs`. File latin sudah
 * di-preload di <head> dan biasanya tiba lebih dulu dari bundle JS, jadi umumnya tidak ada penundaan. Tanpa ini, teks
 * tergambar dulu dengan font cadangan (lebar berbeda per sistem: Arial di Windows, DejaVu/Liberation di Linux, Roboto
 * di Android) lalu bergeser saat font asli tiba (layout shift). Lewat batas waktu → render dengan font cadangan.
 */
const CRITICAL_FONTS = [
  // Judul: Archivo expanded (font-stretch 125%) tebal
  '800 expanded 16px Archivo',
  // Teks isi (font variabel: satu file untuk semua ketebalan)
  '400 16px "Plus Jakarta Sans"',
];

export function fontsReady(timeoutMs = 1500): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve();
  const loaded = Promise.all(CRITICAL_FONTS.map((font) => document.fonts.load(font))).then(
    () => undefined,
    () => undefined,
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([loaded, timeout]);
}

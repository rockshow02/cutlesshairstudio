/**
 * Skrip embed Instagram (https://www.instagram.com/embed.js) dimuat sekali, baru saat pengunjung menekan kartu video
 * pertama (facade): tidak ada request ke Instagram di muat awal halaman. Gratis, tanpa API/token.
 */
export const INSTAGRAM_EMBED_SRC = 'https://www.instagram.com/embed.js';

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

let loading: Promise<void> | undefined;

function load(): Promise<void> {
  if (window.instgrm) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = INSTAGRAM_EMBED_SRC;
    script.async = true;
    script.onload = () => (window.instgrm ? resolve() : reject(new Error('embed Instagram tidak tersedia')));
    script.onerror = () => {
      // Diblokir (adblock/jaringan): boleh dicoba lagi pada klik berikutnya
      loading = undefined;
      script.remove();
      reject(new Error('skrip embed Instagram gagal dimuat'));
    };
    document.body.appendChild(script);
  });
  return loading;
}

/** Muat skrip (sekali) lalu ubah <blockquote class="instagram-media"> yang belum diproses menjadi embed */
export async function processInstagramEmbeds(): Promise<void> {
  await load();
  window.instgrm!.Embeds.process();
}

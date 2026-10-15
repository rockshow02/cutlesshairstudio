import { useEffect } from 'react';

/**
 * Datang dari halaman lain ke "/#harga": saat halaman dimuat, section belum dirender React,
 * sehingga lompatan anchor bawaan browser gagal. Hook ini menunggu elemen tujuan muncul,
 * lalu menggulir ke sana (dan mengoreksi posisi bila konten di atasnya masih bertambah tinggi).
 */
export function useScrollToHash(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;

    const timers: number[] = [];
    const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
    const scrollAndSettle = () => {
      scroll();
      // Koreksi setelah gambar/section async di atasnya selesai dimuat
      [150, 500, 1200].forEach((ms) => timers.push(window.setTimeout(scroll, ms)));
    };

    let observer: MutationObserver | undefined;
    if (document.getElementById(id)) {
      scrollAndSettle();
    } else {
      observer = new MutationObserver(() => {
        if (!document.getElementById(id)) return;
        observer?.disconnect();
        scrollAndSettle();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      timers.push(window.setTimeout(() => observer?.disconnect(), 5000));
    }

    // Pengunjung menggulir sendiri → hentikan koreksi otomatis
    const stop = () => timers.forEach((t) => window.clearTimeout(t));
    window.addEventListener('wheel', stop, { once: true, passive: true });
    window.addEventListener('touchstart', stop, { once: true, passive: true });

    return () => {
      observer?.disconnect();
      stop();
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
    };
  }, [enabled]);
}

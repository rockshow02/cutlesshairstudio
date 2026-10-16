import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        o: { sitekey: string; callback: (t: string) => void; 'expired-callback'?: () => void; 'error-callback'?: () => void; language?: string; theme?: string },
      ) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

let loader: Promise<void> | null = null;
function loadScript(): Promise<void> {
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Turnstile gagal dimuat'));
    document.head.appendChild(s);
  });
  return loader;
}

/**
 * Cloudflare Turnstile (anti-bot gratis, tanpa teka-teki gambar). Token diverifikasi ulang di server.
 * siteKey null → tidak dirender (mis. pengembangan lokal tanpa konfigurasi).
 * resetKey berubah → widget dibuat ulang (token sekali pakai, mis. setelah submit gagal).
 */
export function Turnstile({ siteKey, onToken, resetKey }: { siteKey: string | null; onToken: (token: string) => void; resetKey?: number }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!siteKey) {
      onToken('');
      return;
    }
    let id: string | undefined;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        id = window.turnstile.render(box.current, {
          sitekey: siteKey,
          language: 'id',
          theme: 'light',
          callback: onToken,
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        });
      })
      .catch(() => onToken(''));
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, resetKey]);
  return <div ref={box} style={{ minHeight: siteKey ? 65 : 0, marginBottom: 16 }} />;
}

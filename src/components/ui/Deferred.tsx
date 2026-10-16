import { Children, startTransition, useEffect, useState, type ReactNode } from 'react';

/**
 * Render isi SETELAH frame pertama (hero) tampil, SATU anak per tugas (section demi section).
 * Tiap section = render + commit + layout kecil sendiri, bukan satu tugas besar untuk seluruh halaman,
 * sehingga thread utama HP tidak terblokir lama (TBT/LCP lebih baik). Semua section tetap dirender
 * dalam hitungan milidetik; link #section dari halaman lain menunggu elemennya muncul (useScrollToHash).
 */
export function Deferred({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const [count, setCount] = useState(0);
  const total = items.length;

  useEffect(() => {
    if (count >= total) return;
    let timer = 0;
    // Pertama: tunggu frame hero tampil; berikutnya: tugas baru setelah commit sebelumnya
    const raf = requestAnimationFrame(() => {
      timer = window.setTimeout(() => startTransition(() => setCount((c) => c + 1)), 0);
    });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [count, total]);

  return <>{items.slice(0, count)}</>;
}

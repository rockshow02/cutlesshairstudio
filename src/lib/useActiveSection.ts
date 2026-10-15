import { useEffect, useState } from 'react';

/** Scroll-spy: id section yang sedang berada di tengah viewport. */
export function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join('|');

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );

    // Section bisa muncul belakangan (setelah data dimuat), jadi pantau DOM sampai semua ketemu.
    const observed = new Set<string>();
    const attach = () => {
      ids.forEach((id) => {
        if (observed.has(id)) return;
        const el = document.getElementById(id);
        if (el) {
          io.observe(el);
          observed.add(id);
        }
      });
      return observed.size === ids.length;
    };
    let mo: MutationObserver | undefined;
    if (!attach()) {
      mo = new MutationObserver(() => {
        if (attach()) mo?.disconnect();
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
    return () => {
      io.disconnect();
      mo?.disconnect();
    };
  }, [key]);

  return active;
}

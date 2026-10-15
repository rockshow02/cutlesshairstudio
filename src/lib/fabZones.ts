import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * "Zona tanpa FAB": area yang sudah punya tombol booking sendiri (hero, CTA penutup, footer).
 * Selama salah satu zona terlihat, tombol WhatsApp melayang disembunyikan agar tidak
 * menumpuk/menutupi tombol CTA lain.
 */
const visibleZones = new Set<symbol>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return visibleZones.size > 0;
}

/** Dipakai FloatingWhatsApp: true bila ada zona yang sedang terlihat. */
export function useFabSuppressed(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * Tandai elemen sebagai zona tanpa FAB. Mengembalikan callback ref, sehingga tetap bekerja
 * walau elemen baru dirender setelah data dimuat.
 */
export function useFabZone<T extends HTMLElement>(threshold = 0.15): (node: T | null) => void {
  const [el, setEl] = useState<T | null>(null);

  useEffect(() => {
    if (!el || !('IntersectionObserver' in window)) return;
    const id = Symbol('fab-zone');
    const io = new IntersectionObserver(
      ([entry]) => {
        const had = visibleZones.has(id);
        if (entry.isIntersecting) visibleZones.add(id);
        else visibleZones.delete(id);
        if (had !== visibleZones.has(id)) emit();
      },
      { threshold },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (visibleZones.delete(id)) emit();
    };
  }, [el, threshold]);

  return setEl;
}

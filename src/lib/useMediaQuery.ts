import { useEffect, useState } from 'react';

export const MOBILE_QUERY = '(max-width: 767px)';
/** Desktop dengan mouse/trackpad: satu-satunya tempat smooth scroll (Lenis) dinyalakan */
export const SMOOTH_SCROLL_QUERY = '(hover: hover) and (pointer: fine) and (min-width: 1024px)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export const matches = (query: string) => typeof window !== 'undefined' && window.matchMedia(query).matches;

/** true/false sesuai media query, ikut berubah saat layar diputar/di-resize */
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => matches(query));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatch(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return match;
}

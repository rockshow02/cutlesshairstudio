/**
 * Tween angka ringan berbasis requestAnimationFrame (pengganti `animate()` Motion untuk angka,
 * yang ikut membawa mesin sequence ±5 KB gzip). Dipakai penghitung preloader & CountUp.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const sample = (a: number, b: number, t: number) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
  return (x: number) => {
    if (x <= 0 || x >= 1) return Math.min(1, Math.max(0, x));
    // Cari t untuk x (bagi dua), lalu kembalikan y
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 20; i++) {
      const cx = sample(x1, x2, t);
      if (Math.abs(cx - x) < 1e-4) break;
      if (cx < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sample(y1, y2, t);
  };
}

interface TweenOptions {
  from: number;
  to: number;
  /** detik */
  duration: number;
  ease: readonly [number, number, number, number];
  onUpdate: (value: number) => void;
  onComplete?: () => void;
}

/** Mulai tween; kembalikan fungsi untuk menghentikan */
export function tween({ from, to, duration, ease, onUpdate, onComplete }: TweenOptions): () => void {
  const easing = cubicBezier(...ease);
  const start = performance.now();
  let raf = requestAnimationFrame(function frame(now) {
    const p = Math.min(1, (now - start) / (duration * 1000));
    onUpdate(from + (to - from) * easing(p));
    if (p < 1) raf = requestAnimationFrame(frame);
    else onComplete?.();
  });
  return () => cancelAnimationFrame(raf);
}

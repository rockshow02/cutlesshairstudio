import { Icon } from './Icon';

/** Bintang rating gaya Google Maps. `label` dibaca screen reader. */
export function Stars({ rating, label, size = 16 }: { rating: number; label: string; size?: number }) {
  const full = Math.round(rating);
  return (
    <span role="img" aria-label={label} style={{ display: 'inline-flex', gap: 2, color: 'var(--c-star)' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Icon key={i} name="star" size={size} style={{ opacity: i < full ? 1 : 0.25 }} />
      ))}
    </span>
  );
}

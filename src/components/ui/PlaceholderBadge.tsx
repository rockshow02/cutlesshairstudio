import { useSite } from '@/lib/SiteContext';

/** Badge "Contoh" untuk konten placeholder. Tampil dalam alur (bukan absolute) agar tidak menimpa teks. */
export function PlaceholderBadge() {
  const { site } = useSite();
  return (
    <span
      style={{
        display: 'inline-block',
        alignSelf: 'flex-start',
        padding: '2px 8px',
        borderRadius: 2,
        background: 'var(--c-sand)',
        color: 'var(--c-ink)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        lineHeight: 1.6,
      }}
    >
      {site.ui.placeholderBadge}
    </span>
  );
}

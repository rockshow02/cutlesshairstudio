import { getShoeCare } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useBranch } from '@/lib/BranchContext';
import { pageUrl } from '@/lib/navigation';
import { shoeCarePlacement } from '@/lib/contentTransforms';
import type { ShoeCareContent } from '@/types';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { DemoBadge } from '@/components/ui/DemoBadge';
import styles from './ShoeCareTeaser.module.css';

/**
 * Kartu teaser Cuci Sepatu setelah Daftar Harga (beranda & halaman cabang partner) → halaman /cuci-sepatu/.
 * Tidak dirender bila halaman mati, "Tampilkan teaser di beranda" mati, atau di halaman cabang lain.
 * Warna latar mengikuti aturan pemisah Section (terang setelah terang → terang hangat + garis).
 */
export function ShoeCareTeaser() {
  const state = useContent(getShoeCare);
  const { pageBranch } = useBranch();
  if (state.status !== 'success') return null;
  const data = state.data;
  if (!data || !data.showTeaser) return null;
  if (shoeCarePlacement(data.branch.slug, { pageSlug: pageBranch?.slug }) === 'hidden') return null;
  return <ShoeCareTeaserView data={data} href={pageUrl(data.pageUrl)} />;
}

export function ShoeCareTeaserView({ data, href }: { data: ShoeCareContent; href: string }) {
  const { copy } = data;
  return (
    <Section id="cuci-sepatu-teaser" tone="light" labelledBy="cuci-sepatu-teaser-title" className={styles.section}>
      <p className={styles.ribbon}>
        <Icon name="star" size={12} />
        {copy.ribbon}
      </p>
      <div className={styles.card}>
        {data.logo && <ResponsiveImage image={data.logo} className={styles.logo} />}
        <div className={styles.text}>
          <p className={styles.kicker}>
            {copy.kicker}
            <DemoBadge show={data.isDemo} />
          </p>
          <h2 id="cuci-sepatu-teaser-title" className={styles.name}>
            {data.name}
          </h2>
          {data.tagline && <p className={styles.tagline}>{data.tagline}</p>}
        </div>
        <Button href={href} variant="dark" iconEnd="arrow" className={styles.cta}>
          {copy.teaserCta}
          <span className="visually-hidden"> {copy.kicker}</span>
        </Button>
      </div>
    </Section>
  );
}

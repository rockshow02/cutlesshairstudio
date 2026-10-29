import { useSite } from '@/lib/SiteContext';
import { pageUrl } from '@/lib/navigation';
import { getTips } from '@/lib/tips';
import { TIPS_PATH } from '@/content/tipsSeo';
import { tipsCopy } from '@/content/tipsCopy';
import { Section } from '@/components/ui/Section';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Button } from '@/components/ui/Button';
import { TipGrid } from '@/components/pages/TipsPages';

const LATEST = 3;

/** Beranda: 3 artikel terbaru + tombol ke /tips/. Tidak dirender bila Tips & Trik mati / belum ada artikel terbit. */
export function TipsLatest() {
  const { site } = useSite();
  const tips = getTips().slice(0, LATEST);
  if (!site.features.tips || tips.length === 0) return null;
  return (
    <Section id="tips-terbaru" tone="dark" labelledBy="tips-terbaru-title">
      <SectionTitle
        heading={tipsCopy.latest}
        id="tips-terbaru-title"
        aside={
          <Button href={pageUrl(TIPS_PATH)} variant="ghost" iconEnd="arrow">
            {tipsCopy.latest.viewAll}
          </Button>
        }
      />
      <TipGrid tips={tips} heading="h3" />
    </Section>
  );
}

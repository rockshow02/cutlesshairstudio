import { useSite } from '@/lib/SiteContext';
import { getKabar, useNow } from '@/lib/kabar';
import { branchBoxItems } from '@/content/kabarSeo';
import { kabarCopy } from '@/content/kabarCopy';
import { Section } from '@/components/ui/Section';
import { KabarCard } from '@/components/pages/KabarCard';
import tips from '@/components/pages/TipsPages.module.css';
import styles from './KabarBranchBox.module.css';

/**
 * Kotak "Promo & acara" di halaman cabang (tepat sesudah kepala cabang, posisi sama dengan ringkasan statis
 * branchBoxBody di scripts/kabar.ts; teks kartu sama). Promo/acara aktif (termasuk akan datang) untuk cabang ini atau
 * semua cabang, dihitung dari jam pengunjung: yang berakhir sesudah build terakhir tidak tampil (sama dengan saringan
 * pra-paint). Tidak dirender bila Tampilkan Kabar mati atau tidak ada item.
 */
export function KabarBranchBox({ branchSlug }: { branchSlug: string }) {
  const { site } = useSite();
  const now = useNow();
  const items = site.features.kabar ? branchBoxItems(getKabar(), branchSlug, now) : [];
  if (!items.length) return null;

  return (
    <Section id="promo-acara" tone="dark" labelledBy="promo-acara-title">
      <h2 id="promo-acara-title" className={`${tips.sectionTitle} ${styles.title}`}>
        {kabarCopy.box.title}
      </h2>
      <ul className={tips.grid}>
        {items.map((k) => (
          <KabarCard key={k.slug} item={k} now={now} />
        ))}
      </ul>
    </Section>
  );
}

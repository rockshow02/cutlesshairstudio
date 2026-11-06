import { useSite } from '@/lib/SiteContext';
import { getKabar, useNow } from '@/lib/kabar';
import { pageUrl } from '@/lib/navigation';
import { bannerItem, kabarPath } from '@/content/kabarSeo';
import { kabarCopy, kabarStatusLabel } from '@/content/kabarCopy';
import { Container } from '@/components/ui/Container';
import { Icon } from '@/components/ui/Icon';
import styles from './KabarBanner.module.css';

/**
 * Banner beranda: satu promo/acara aktif (acara terdekat dulu, lalu promo; tanpa saringan cabang) menaut ke detailnya.
 * Teks sama dengan ringkasan statis kabarBannerBody (scripts/kabar.ts), dihitung dari jam pengunjung (item yang
 * berakhir sesudah build tidak tampil, sama dengan saringan pra-paint). Tidak dirender bila Tampilkan Kabar atau
 * Tampilkan banner mati, atau tidak ada item aktif.
 */
export function KabarBanner() {
  const { site } = useSite();
  const now = useNow();
  const item = site.features.kabar && site.features.kabarBanner ? bannerItem(getKabar(), now) : undefined;
  if (!item) return null;
  const status = kabarStatusLabel(item, now);

  return (
    <aside className={styles.banner} aria-label={kabarCopy.heading.title}>
      <Container>
        <a className={styles.link} href={pageUrl(kabarPath(item.slug))}>
          <span className={styles.kind}>{item.kind}</span>
          <span className={styles.title}>{item.title}</span>
          {status && <span className={styles.status}>{status}</span>}
          <Icon name="arrow" size={18} className={styles.arrow} />
        </a>
      </Container>
    </aside>
  );
}

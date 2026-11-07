import { pageUrl } from '@/lib/navigation';
import { kabarImage } from '@/lib/kabar';
import { formatKabarDate, kabarPath, type KabarSummary } from '@/content/kabarSeo';
import { kabarPeriodLabel, kabarStatusLabel } from '@/content/kabarCopy';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
// Modul kecil sendiri agar kotak halaman cabang tidak menarik TipsPages & data Tips; kartu sama dengan Tips & Trik
import tips from './TipsPages.module.css';
import styles from './KabarPages.module.css';

/** Kartu (teks sama dengan cardHtml di scripts/kabar.ts) */

export function KabarCard({ item, now, hidden = false }: { item: KabarSummary; now: number; hidden?: boolean }) {
  const image = kabarImage(item, '(min-width: 1024px) 24rem, (min-width: 601px) 50vw, 96px');
  const period = kabarPeriodLabel(item);
  const status = kabarStatusLabel(item, now);
  return (
    <li className={tips.card} hidden={hidden}>
      <a className={tips.cardLink} href={pageUrl(kabarPath(item.slug))}>
        {image && <ResponsiveImage className={tips.cardImage} image={image} />}
        <div className={tips.cardBody}>
          <p className={tips.category}>{item.kind}</p>
          <h3 className={tips.cardTitle}>{item.title}</h3>
          <p className={tips.cardSummary}>{item.summary}</p>
          {period && <p className={styles.period}>{period}</p>}
          {status && <p className={styles.status}>{status}</p>}
          <p className={tips.cardMeta}>
            <time dateTime={item.publishedAt}>{formatKabarDate(item.publishedAt)}</time>
          </p>
        </div>
      </a>
    </li>
  );
}

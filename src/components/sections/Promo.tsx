import { getPromos } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useBranch } from '@/lib/BranchContext';
import { useBooking } from '@/lib/useBooking';
import { joinIndonesian } from '@/lib/contentTransforms';
import { formatDateTimeWIB } from '@/lib/format';
import { fillTemplate } from '@/lib/whatsapp';
import type { Promo as PromoItem, PromoContent } from '@/types';
import { Section } from '@/components/ui/Section';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import styles from './Promo.module.css';

/**
 * Banner promo dari CMS. Section ini opsional: tidak dirender saat loading, gagal,
 * atau tidak ada promo aktif (sehingga tidak ada ruang kosong / lompatan layout).
 */
export function Promo() {
  const { effective } = useBranch();
  // Cabang dipilih → hanya promo yang berlaku di cabang itu (promo tanpa cabang = semua cabang)
  const state = useContent(() => getPromos(effective?.slug), [effective?.slug]);
  if (state.status !== 'success' || state.data.items.length === 0) return null;
  const data = state.data;

  return (
    <Section id="promo" tone="dark" labelledBy="promo-title" className={styles.section}>
      <SectionTitle heading={data.heading} id="promo-title" />
      <ul className={styles.list} data-count={Math.min(data.items.length, 2)}>
        {data.items.map((item) => (
          <li key={item.id}>
            <PromoCard item={item} labels={data.labels} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function PromoCard({ item, labels }: { item: PromoItem; labels: PromoContent['labels'] }) {
  const { copy } = useBranch();
  const book = useBooking();
  // Promo khusus cabang → pemilih cabang hanya menawarkan cabang yang berlaku
  const target = item.waMessage
    ? book({ message: item.waMessage, vars: { promo: item.title }, allowedSlugs: item.branchSlugs, source: 'promo' })
    : book({ kind: 'service', vars: { service: `promo "${item.title}"` }, allowedSlugs: item.branchSlugs, source: 'promo' });

  return (
    <article className={styles.card} data-has-image={item.image ? true : undefined}>
      {item.image && (
        <div className={styles.media}>
          <ResponsiveImage image={item.image} className={styles.img} />
        </div>
      )}
      <div className={styles.body}>
        <p className={styles.tag}>
          <Icon name="tag" size={14} />
          {labels.badge}
        </p>
        <h3 className={styles.title}>{item.title}</h3>
        {item.description && <p className={styles.desc}>{item.description}</p>}
        <p className={styles.valid}>
          <Icon name="clock" size={14} />
          {fillTemplate(labels.validUntil, { date: formatDateTimeWIB(item.endDate) })}
        </p>
        {item.branchNames.length > 0 && (
          <p className={styles.valid}>
            <Icon name="pin" size={14} />
            {fillTemplate(copy.labels.promoFor, { branches: joinIndonesian(item.branchNames) })}
          </p>
        )}
        <div className={styles.cta}>
          <Button href={target.href} external={target.external} onClick={target.onClick} variant="light" icon="whatsapp">
            {item.ctaLabel}
          </Button>
        </div>
      </div>
    </article>
  );
}

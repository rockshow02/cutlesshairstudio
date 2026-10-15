import { getPromos } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useSite } from '@/lib/SiteContext';
import { formatDateTimeWIB } from '@/lib/format';
import { bookingMessage, buildWhatsAppLink, fillTemplate } from '@/lib/whatsapp';
import type { Promo as PromoItem, PromoContent } from '@/types';
import { Section } from '@/components/ui/Section';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import styles from './Promo.module.css';

/**
 * Banner promo dari CMS. Section ini opsional: tidak dirender saat loading, gagal,
 * atau tidak ada promo aktif (sehingga tidak ada ruang kosong / lompatan layout).
 */
export function Promo() {
  const state = useContent(getPromos);
  if (state.status !== 'success' || state.data.items.length === 0) return null;
  const data = state.data;

  return (
    <Section id="promo" tone="dark" labelledBy="promo-title" className={styles.section}>
      <SectionTitle heading={data.heading} id="promo-title" />
      <ul className={styles.list} data-count={Math.min(data.items.length, 2)}>
        {data.items.map((item, i) => (
          <Reveal as="li" key={item.id} delay={i * 0.06}>
            <PromoCard item={item} labels={data.labels} />
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}

function PromoCard({ item, labels }: { item: PromoItem; labels: PromoContent['labels'] }) {
  const { site } = useSite();
  const message = item.waMessage
    ? fillTemplate(item.waMessage, { brand: site.brandName, promo: item.title })
    : bookingMessage(site, 'service', { service: `promo "${item.title}"` });

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
        <div className={styles.cta}>
          <Button href={buildWhatsAppLink(site.whatsapp.number, message)} external variant="light" icon="whatsapp">
            {item.ctaLabel}
          </Button>
        </div>
      </div>
    </article>
  );
}

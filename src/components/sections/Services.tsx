import { getServices } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useSite } from '@/lib/SiteContext';
import { useBranch } from '@/lib/BranchContext';
import { useBooking } from '@/lib/useBooking';
import { formatPrice } from '@/lib/format';
import type { Service } from '@/types';
import { Section } from '@/components/ui/Section';
import { SectionState } from '@/components/ui/SectionState';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Card, CardFooter } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/motion/Reveal';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import styles from './Services.module.css';

export function Services() {
  const { effective } = useBranch();
  // "mulai Rp..." dihitung untuk cabang terpilih (atau terendah semua cabang)
  const state = useContent(() => getServices(effective?.slug), [effective?.slug]);

  return (
    <Section id="layanan" tone="dark" labelledBy="layanan-title">
      <SectionState state={state} isEmpty={(d) => d.items.length === 0} skeletonCount={4}>
        {(data) => (
          <>
            <SectionTitle heading={data.heading} id="layanan-title" />
            <ul className={styles.grid}>
              {data.items.map((service, i) => (
                <Reveal as="li" key={service.id} delay={(i % 4) * 0.05}>
                  <ServiceCard service={service} index={i} />
                </Reveal>
              ))}
            </ul>
          </>
        )}
      </SectionState>
    </Section>
  );
}

function ServiceCard({ service, index }: { service: Service; index: number }) {
  const { site } = useSite();
  const book = useBooking();
  const hasPrice = service.startingPrice !== undefined;
  // Kategori tanpa harga aktif → "Tanya harga" ke WhatsApp cabang
  const target = hasPrice
    ? book({ kind: 'service', vars: { service: service.name } })
    : book({ kind: 'priceQuestion', vars: { service: service.name } });

  return (
    <Card className={styles.card}>
      {service.image && <ResponsiveImage image={service.image} className={styles.photo} />}
      <div className={styles.top}>
        <Icon name={service.icon} size={40} strokeWidth={1.4} className={styles.icon} />
        <span className={styles.no} aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <h3 className={styles.name}>{service.name}</h3>
      <p className={styles.desc}>{service.description}</p>
      <CardFooter className={styles.foot}>
        {hasPrice && <span className={styles.price}>{formatPrice(service.startingPrice as number, true, site.ui.priceFrom)}</span>}
        <a
          className={styles.link}
          href={target.href}
          onClick={target.onClick}
          {...(target.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {hasPrice ? site.ui.book : site.ui.askPrice}
          <span className="visually-hidden"> {service.name}</span>
          <Icon name="arrow" size={16} />
        </a>
      </CardFooter>
    </Card>
  );
}

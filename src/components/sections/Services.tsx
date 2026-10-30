import type { MouseEvent } from 'react';
import { getServices } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useSite } from '@/lib/SiteContext';
import { useBranch } from '@/lib/BranchContext';
import { useBooking } from '@/lib/useBooking';
import { selectPriceCategory } from '@/lib/priceCategoryEvent';
import { pageUrl } from '@/lib/navigation';
import { servicePageForCard } from '@/lib/servicePages';
import { servicePagesCopy } from '@/content/servicePagesCopy';
import type { Service } from '@/types';
import { Section } from '@/components/ui/Section';
import { SectionState } from '@/components/ui/SectionState';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Card, CardFooter } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
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
                <li key={service.id}>
                  <ServiceCard service={service} index={i} />
                </li>
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
  const target = book({ kind: 'service', vars: { service: service.name } });
  const more = servicePageForCard(service.name);
  return (
    <ServiceCardView
      service={service}
      index={index}
      moreHref={more ? pageUrl(more) : undefined}
      bookHref={target.href}
      bookExternal={target.external}
      onBook={target.onClick}
      viewPriceLabel={site.ui.viewPrice}
      bookLabel={site.ui.book}
    />
  );
}

interface ServiceCardViewProps {
  service: Service;
  index: number;
  bookHref: string;
  bookExternal?: boolean;
  onBook?: (event: MouseEvent<HTMLElement>) => void;
  viewPriceLabel: string;
  bookLabel: string;
  /** Halaman layanan terbit untuk kartu ini (link "Selengkapnya") */
  moreHref?: string;
}

/** Kartu deskriptif tanpa harga; harga ada di Daftar Harga (tautan "Lihat harga" bila kategori diatur & aktif) */
export function ServiceCardView({ service, index, bookHref, bookExternal = true, onBook, viewPriceLabel, bookLabel, moreHref }: ServiceCardViewProps) {
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
        {moreHref && (
          <a className={styles.priceLink} href={moreHref}>
            {servicePagesCopy.labels.readMore}
            <span className="visually-hidden"> {service.name}</span>
          </a>
        )}
        {service.priceHref && service.pricingCategory && (
          <a className={styles.priceLink} href={service.priceHref} onClick={() => selectPriceCategory(service.pricingCategory!)}>
            {viewPriceLabel}
            <span className="visually-hidden"> {service.name}</span>
          </a>
        )}
        <a className={styles.link} href={bookHref} onClick={onBook} {...(bookExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {bookLabel}
          <span className="visually-hidden"> {service.name}</span>
          <Icon name="arrow" size={16} />
        </a>
      </CardFooter>
    </Card>
  );
}

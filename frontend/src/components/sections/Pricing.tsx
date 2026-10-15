import { getPricing } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useSite } from '@/lib/SiteContext';
import { formatPrice, formatRupiah } from '@/lib/format';
import { bookingLink } from '@/lib/whatsapp';
import { Section } from '@/components/ui/Section';
import { SectionState } from '@/components/ui/SectionState';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Card, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import styles from './Pricing.module.css';

export function Pricing() {
  const state = useContent(getPricing);
  const { site } = useSite();

  return (
    <Section id="harga" tone="light" labelledBy="harga-title">
      <SectionState
        state={state}
        tone="light"
        isEmpty={(d) => d.categories.every((c) => c.items.length === 0) && d.packages.length === 0}
        skeletonCount={2}
      >
        {(data) => (
          <>
            <SectionTitle heading={data.heading} id="harga-title" tone="light" />

            <div className={styles.categories}>
              {data.categories
                .filter((c) => c.items.length > 0)
                .map((category, i) => (
                  <Reveal key={category.id} className={styles.category} delay={(i % 2) * 0.06}>
                    <h3 className={styles.categoryName}>{category.name}</h3>
                    <ul>
                      {category.items.map((item) => (
                        <li key={item.id} className={styles.row}>
                          <span className={styles.itemName}>
                            {item.name}
                            {item.badge && <span className={styles.badge}>{item.badge}</span>}
                            {item.description && <small>{item.description}</small>}
                          </span>
                          <span className={styles.itemPrice}>{formatPrice(item.price, item.priceFrom, site.ui.priceFrom)}</span>
                        </li>
                      ))}
                    </ul>
                  </Reveal>
                ))}
            </div>

            {data.packages.length > 0 && (
              <>
                <h3 className={styles.packagesTitle}>{data.packagesTitle}</h3>
                <ul className={styles.packages}>
                  {data.packages.map((pkg, i) => (
                    <Reveal as="li" key={pkg.id} delay={i * 0.06}>
                      <Card tone={pkg.featured ? 'featured' : 'light'} className={pkg.featured ? styles.featured : undefined}>
                        <p className={styles.tag}>{pkg.tag}</p>
                        <h4 className={styles.pkgName}>{pkg.name}</h4>
                        <p className={styles.pkgPrice}>
                          {formatRupiah(pkg.price)}
                          {pkg.unit && <small>{pkg.unit}</small>}
                        </p>
                        <ul className={styles.features}>
                          {pkg.features.map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                        <CardFooter>
                          <Button
                            href={bookingLink(site, 'package', { package: pkg.name })}
                            external
                            block
                            variant={pkg.featured ? 'light' : 'outline-dark'}
                          >
                            {pkg.ctaLabel}
                            <span className="visually-hidden"> {pkg.name}</span>
                          </Button>
                        </CardFooter>
                      </Card>
                    </Reveal>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </SectionState>
    </Section>
  );
}

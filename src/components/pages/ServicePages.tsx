import { useBranch } from '@/lib/BranchContext';
import { useBooking } from '@/lib/useBooking';
import { pageUrl } from '@/lib/navigation';
import { responsiveImage } from '@/lib/contentTransforms';
import { formatThousandsK } from '@/lib/format';
import { branchEntries, getCurrentServicePage, getServicePages, pricingEntries } from '@/lib/servicePages';
import {
  SERVICES_PATH,
  groupServicePages,
  relatedServicePages,
  serviceBranches,
  servicePagePath,
  servicePrices,
  type ServicePage,
  type ServicePageSummary,
} from '@/content/servicePages';
import { serviceBookLabel, servicePagesCopy } from '@/content/servicePagesCopy';
import { PRICE_CATEGORIES } from '@/content/priceCategories';
import { pricingCopy } from '@/content/pricing';
import { Section } from '@/components/ui/Section';
import { Kicker } from '@/components/ui/SectionTitle';
import { Button } from '@/components/ui/Button';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import tips from './TipsPages.module.css';
import styles from './ServicePages.module.css';

const l = servicePagesCopy.labels;
/** "mulai 100K" (format "K" seperti Daftar Harga) */
const priceText = (from: number) => `${l.priceFrom} ${formatThousandsK(from)}`;
const categoryName = (c?: string) =>
  c ? (pricingCopy.categoryLabels as Record<string, string>)[c] ?? c : servicePagesCopy.otherCategory;

/* ---------- Kartu halaman layanan (/layanan/ & layanan terkait) ---------- */

function ServiceCard({ page }: { page: ServicePageSummary }) {
  const prices = servicePrices(page, pricingEntries, branchEntries);
  return (
    <li className={styles.card}>
      <h3 className={styles.cardTitle}>
        <a href={pageUrl(servicePagePath(page.slug))}>{page.title}</a>
      </h3>
      <p className={styles.cardSummary}>{page.summary}</p>
      {prices.length > 0 ? (
        <ul className={styles.cardPrices}>
          {prices.map((b) => (
            <li key={b.slug}>
              <span>{b.name}</span> <span className={styles.cardPrice}>{priceText(b.from)}</span>
            </li>
          ))}
        </ul>
      ) : (
        page.priceNote && <p className={styles.cardNote}>{page.priceNote}</p>
      )}
    </li>
  );
}

/* ---------- /layanan/ ---------- */

export function ServicesIndex() {
  const groups = groupServicePages(getServicePages(), pricingEntries, PRICE_CATEGORIES);
  const h = servicePagesCopy.heading;
  return (
    <Section id="layanan" tone="dark" labelledBy="layanan-title" className={tips.page}>
      <div className={tips.pageHead}>
        <Kicker>{h.kicker}</Kicker>
        <h1 id="layanan-title" className={tips.pageTitle}>
          {h.title}
        </h1>
        <p className={tips.pageIntro}>{h.intro}</p>
      </div>
      {groups.map((g) => {
        const id = `layanan-${(g.category ?? 'lainnya').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        return (
          <section key={id} className={styles.group} aria-labelledby={id}>
            <h2 id={id} className={tips.sectionTitle}>
              {categoryName(g.category)}
            </h2>
            <ul className={styles.grid}>
              {g.pages.map((p) => (
                <ServiceCard key={p.slug} page={p} />
              ))}
            </ul>
          </section>
        );
      })}
    </Section>
  );
}

/* ---------- /layanan/<slug>/ ---------- */

export function ServicePageView() {
  const page = getCurrentServicePage();
  if (!page) {
    return (
      <Section id="layanan" tone="dark" labelledBy="layanan-title" className={tips.page}>
        <Kicker>{servicePagesCopy.heading.kicker}</Kicker>
        <h1 id="layanan-title" className={tips.pageTitle}>
          {l.notFoundTitle}
        </h1>
        <p className={tips.pageIntro}>{l.notFoundText}</p>
        <Button href={pageUrl(SERVICES_PATH)} variant="light" iconEnd="arrow">
          {l.backToServices}
        </Button>
      </Section>
    );
  }
  return <ServiceDetail page={page} />;
}

function ServiceDetail({ page }: { page: ServicePage }) {
  const { branches } = useBranch();
  const book = useBooking();
  const prices = servicePrices(page, pricingEntries, branchEntries);
  const available = serviceBranches(page, pricingEntries, branchEntries);
  const related = relatedServicePages(getServicePages(), page, pricingEntries);
  // Pesan menyebut nama layanan; cabang dipilih pengunjung (pemilih cabang), hanya cabang tempat layanan tersedia
  const target = book({ kind: 'service', vars: { service: page.title }, allowedSlugs: available.map((b) => b.slug), source: 'layanan' });
  const bookable = available.some((a) => branches.find((b) => b.slug === a.slug)?.bookable);

  return (
    <Section id="layanan" tone="dark" labelledBy="layanan-title" className={tips.page}>
      <article className={tips.article}>
        <nav className={tips.breadcrumb} aria-label={l.breadcrumb}>
          <ol>
            <li>
              <a href={pageUrl('/')}>{l.home}</a>
            </li>
            <li>
              <a href={pageUrl(SERVICES_PATH)}>{servicePagesCopy.heading.kicker}</a>
            </li>
            <li aria-current="page" title={page.title}>
              {page.title}
            </li>
          </ol>
        </nav>

        <header className={tips.articleHead}>
          <h1 id="layanan-title" className={tips.articleTitle}>
            {page.title}
          </h1>
          <p className={tips.lead}>{page.summary}</p>
        </header>

        {(prices.length > 0 || page.priceNote) && (
          <section className={styles.block} aria-labelledby="layanan-harga">
            <h2 id="layanan-harga" className={tips.sectionTitle}>
              {l.priceTitle}
            </h2>
            {prices.length > 0 && (
              <ul className={styles.prices}>
                {prices.map((b) => (
                  <li key={b.slug} className={styles.priceCard}>
                    <h3 className={styles.priceBranch}>{b.name}</h3>
                    <p className={styles.priceFrom}>{priceText(b.from)}</p>
                    <ul className={styles.priceRows}>
                      {b.items.map((i) => (
                        <li key={i.name}>
                          <span className={styles.priceName}>
                            {i.name}
                            {i.description && <small>{i.description}</small>}
                          </span>
                          <span className={styles.priceValue}>
                            {i.priceFrom && <small>{pricingCopy.priceFromLabel}</small>}
                            {formatThousandsK(i.price)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            {page.priceNote && <p className={styles.note}>{page.priceNote}</p>}
          </section>
        )}

        {available.length > 0 && (
          <section className={styles.block} aria-labelledby="layanan-cabang">
            <h2 id="layanan-cabang" className={tips.sectionTitle}>
              {l.availableAt}
            </h2>
            <ul className={styles.branches}>
              {available.map((b) => (
                <li key={b.slug}>
                  <a className={styles.branchLink} href={pageUrl(`/cabang/${b.slug}/`)}>
                    {b.name}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {page.suitableFor.length > 0 && (
          <section className={styles.block} aria-labelledby="layanan-cocok">
            <h2 id="layanan-cocok" className={tips.sectionTitle}>
              {l.suitableFor}
            </h2>
            <ul className={styles.checks}>
              {page.suitableFor.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        )}

        {page.steps.length > 0 && (
          <section className={styles.block} aria-labelledby="layanan-proses">
            <h2 id="layanan-proses" className={tips.sectionTitle}>
              {l.steps}
            </h2>
            <ol className={styles.steps}>
              {page.steps.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
          </section>
        )}

        {page.duration && (
          <p className={styles.duration}>
            <span>{l.duration}</span> <span>{page.duration}</span>
          </p>
        )}

        {page.photos.length > 0 && (
          <ul className={styles.photos} aria-label={l.photos}>
            {page.photos.map((ph) => (
              <li key={ph.src}>
                <ResponsiveImage className={styles.photo} image={responsiveImage(ph.src, ph.alt, '(min-width: 768px) 24rem, 50vw', { width: 1200, height: 900 })} />
              </li>
            ))}
          </ul>
        )}

        {/* HTML hasil render Markdown saat build (scripts/layanan.ts): HTML mentah dari CMS sudah di-escape */}
        {page.html && <div className={`${tips.prose} ${styles.block}`} dangerouslySetInnerHTML={{ __html: page.html }} />}

        {page.faq.length > 0 && (
          <section className={tips.faq} aria-labelledby="layanan-faq">
            <h2 id="layanan-faq" className={tips.sectionTitle}>
              {l.faqTitle}
            </h2>
            <div className={tips.faqList}>
              {page.faq.map((q) => (
                <details key={q.question} className={tips.faqItem}>
                  <summary>{q.question}</summary>
                  <p>{q.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <aside className={tips.cta} aria-labelledby="layanan-cta">
          <h2 id="layanan-cta" className={tips.ctaTitle}>
            {servicePagesCopy.cta.title}
          </h2>
          <p>{servicePagesCopy.cta.text}</p>
          {bookable && (
            <Button href={target.href} external={target.external} onClick={target.onClick} variant="light" icon="whatsapp">
              {serviceBookLabel(page.title)}
            </Button>
          )}
        </aside>
      </article>

      {related.length > 0 && (
        <section className={tips.related} aria-labelledby="layanan-terkait">
          <h2 id="layanan-terkait" className={tips.sectionTitle}>
            {l.relatedTitle}
          </h2>
          <ul className={styles.grid}>
            {related.map((p) => (
              <ServiceCard key={p.slug} page={p} />
            ))}
          </ul>
        </section>
      )}
    </Section>
  );
}

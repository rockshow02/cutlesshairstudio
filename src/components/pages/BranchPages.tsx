import { useBranch } from '@/lib/BranchContext';
import { useSite } from '@/lib/SiteContext';
import { useBooking } from '@/lib/useBooking';
import { getOpenStatus } from '@/lib/branchHours';
import { pageUrl } from '@/lib/navigation';
import { formatThousandsK } from '@/lib/format';
import { branchEntries, getServicePages, pricingEntries } from '@/lib/servicePages';
import { dailyHours, serviceBranches, servicePagePath, servicePrices } from '@/content/servicePages';
import { FACILITY_ICONS, branchDetailsCopy, servicePagesCopy } from '@/content/servicePagesCopy';
import type { Branch } from '@/types';
import { Section } from '@/components/ui/Section';
import { Kicker } from '@/components/ui/SectionTitle';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { BranchPanel } from '@/components/sections/Location';
import { Promo } from '@/components/sections/Promo';
import { Pricing } from '@/components/sections/Pricing';
import { ShoeCareTeaser } from '@/components/sections/ShoeCareTeaser';
import { Barbers } from '@/components/sections/Barbers';
import { CtaBanner } from '@/components/sections/CtaBanner';
import { Deferred } from '@/components/ui/Deferred';
import styles from './BranchPages.module.css';
import tips from './TipsPages.module.css';

/** /cabang/:slug/ : semua info satu cabang (dipakai SiteShell dengan pageBranchSlug) */
export function BranchPage() {
  const { pageBranch, copy } = useBranch();
  const { site } = useSite();

  if (!pageBranch) {
    return (
      <Section id="cabang" tone="dark" className={styles.page} labelledBy="cabang-title">
        <Kicker>{copy.indexHeading.kicker}</Kicker>
        <h1 id="cabang-title" className={styles.title}>
          {copy.labels.notFoundTitle}
        </h1>
        <p className={styles.intro}>{copy.labels.notFoundText}</p>
        <Button href={pageUrl('/cabang/')} variant="light" iconEnd="arrow">
          {copy.labels.backToBranches}
        </Button>
      </Section>
    );
  }

  const b = pageBranch;
  return (
    <>
      <BranchHero branch={b} brand={site.brandName} />
      <Deferred>
        <BranchDetails branch={b} />
        <Section id="lokasi" tone="light" labelledBy="lokasi-detail">
          <h2 id="lokasi-detail" className="visually-hidden">
            {copy.heading.title}
          </h2>
          <BranchPanel branch={b} labels={copy.labels} headingLevel={2} />
        </Section>
        <Promo />
        <Pricing />
        {/* Teaser Cuci Sepatu: hanya di halaman cabang partner */}
        <ShoeCareTeaser />
        <Barbers />
        <BranchFaq branch={b} />
        {b.bookable && <CtaBanner />}
      </Deferred>
    </>
  );
}

function BranchHero({ branch, brand }: { branch: Branch; brand: string }) {
  const { copy, announcements } = useBranch();
  const book = useBooking();
  const status = getOpenStatus(branch, copy.labels, announcements);
  const target = book({ kind: 'general', branchSlug: branch.slug });
  // Semua hari buka dengan jam sama → "Buka sampai 21.00" + "Setiap hari 09.00–21.00"
  const daily = dailyHours(branch.hours);

  return (
    <Section id="top" tone="dark" className={styles.page} labelledBy="cabang-title">
      <div className={styles.heroGrid}>
        <div className={styles.heroText}>
          <p className={styles.crumbs}>
            <a href={pageUrl('/cabang/')}>{copy.labels.allBranches}</a>
            <Icon name="chevron-right" size={14} />
            <span>{branch.city}</span>
          </p>
          <h1 id="cabang-title" className={styles.title}>
            {brand} <span>{branch.name}</span>
          </h1>
          <p className={styles.intro}>{branch.address ?? `${branch.city}, ${branch.province}`}</p>
          <p className={styles.status} data-state={status.state}>
            <span className={styles.badge} data-status={branch.status}>
              {copy.labels.statusBadge[branch.status]}
            </span>
            {status.label}
          </p>
          {daily && (
            <p className={styles.hoursNote}>
              <strong>{branchDetailsCopy.openUntil.replace('{close}', daily.close)}</strong>
              <span>{branchDetailsCopy.everyDay.replace('{open}', daily.open).replace('{close}', daily.close)}</span>
            </p>
          )}
          <div className={styles.ctas}>
            {branch.bookable && (
              <Button href={target.href} external={target.external} onClick={target.onClick} variant="light" icon="whatsapp">
                {copy.labels.book}
              </Button>
            )}
            <Button href={branch.directionsUrl} external variant="ghost" icon="navigate">
              {copy.labels.directions}
            </Button>
          </div>
        </div>
        {branch.photo && (
          <div className={styles.heroPhoto}>
            <ResponsiveImage image={branch.photo} className={styles.photo} priority />
          </div>
        )}
      </div>
    </Section>
  );
}

/**
 * Tentang cabang (Pages CMS → Cabang, opsional): deskripsi, area yang dilayani, patokan, fasilitas & pembayaran, dan
 * layanan yang tersedia (halaman layanan terbit, hanya bila Tampilkan halaman layanan aktif). Kosong = tidak tampil.
 */
function BranchDetails({ branch }: { branch: Branch }) {
  const c = branchDetailsCopy;
  const services = getServicePages()
    .filter((p) => serviceBranches(p, pricingEntries, branchEntries).some((x) => x.slug === branch.slug))
    .map((p) => ({ page: p, from: servicePrices(p, pricingEntries, branchEntries).find((x) => x.slug === branch.slug)?.from }));
  if (!branch.description && !branch.serviceAreas.length && !branch.landmark && !branch.facilities.length && !services.length) return null;

  return (
    <Section id="tentang-cabang" tone="dark" labelledBy="tentang-cabang-title">
      <h2 id="tentang-cabang-title" className="visually-hidden">
        {c.kicker}
      </h2>
      <div className={styles.details}>
        {branch.description && <p className={styles.description}>{branch.description}</p>}
        {branch.serviceAreas.length > 0 && (
          <div className={styles.detailBlock}>
            <h3 className={styles.detailTitle}>{c.areasTitle}</h3>
            <ul className={styles.areas}>
              {branch.serviceAreas.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}
        {branch.landmark && (
          <div className={styles.detailBlock}>
            <h3 className={styles.detailTitle}>{c.directionsTitle}</h3>
            <p className={styles.detailText}>{branch.landmark}</p>
          </div>
        )}
        {branch.facilities.length > 0 && (
          <div className={styles.detailBlock}>
            <h3 className={styles.detailTitle}>{c.facilitiesTitle}</h3>
            <ul className={styles.facilities}>
              {branch.facilities.map((f) => (
                <li key={f}>
                  <Icon name={FACILITY_ICONS[f]} size={20} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {services.length > 0 && (
          <div className={styles.detailBlock}>
            <h3 className={styles.detailTitle}>{c.servicesTitle}</h3>
            <ul className={styles.services}>
              {services.map((s) => (
                <li key={s.page.slug}>
                  <a href={pageUrl(servicePagePath(s.page.slug))}>{s.page.title}</a>
                  {s.from !== undefined && (
                    <span>
                      {servicePagesCopy.labels.priceFrom} {formatThousandsK(s.from)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}

/** FAQ cabang: akordeon <details> (bisa dibuka tanpa JavaScript) + JSON-LD FAQPage di head halaman cabang */
function BranchFaq({ branch }: { branch: Branch }) {
  if (!branch.faq.length) return null;
  return (
    <Section id="faq-cabang" tone="dark" labelledBy="faq-cabang-title">
      <div className={tips.faq}>
        <h2 id="faq-cabang-title" className={tips.sectionTitle}>
          {branchDetailsCopy.faqTitle}
        </h2>
        <div className={tips.faqList}>
          {branch.faq.map((q) => (
            <details key={q.question} className={tips.faqItem}>
              <summary>{q.question}</summary>
              <p>{q.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

/** /cabang/ : daftar semua cabang */
export function BranchesIndex() {
  const { branches, copy, announcements } = useBranch();
  const book = useBooking();

  return (
    <Section id="cabang" tone="dark" className={styles.page} labelledBy="cabang-title">
      <div className={styles.indexHead}>
        <Kicker>{copy.indexHeading.kicker}</Kicker>
        <h1 id="cabang-title" className={styles.title}>
          {copy.indexHeading.title}
        </h1>
        {copy.indexHeading.intro && <p className={styles.intro}>{copy.indexHeading.intro}</p>}
      </div>
      <ul className={styles.cards}>
        {branches.map((b) => {
          const status = getOpenStatus(b, copy.labels, announcements);
          const target = book({ kind: 'general', branchSlug: b.slug });
          return (
            <li key={b.slug}>
              <article className={styles.card}>
                <div className={styles.cardHead}>
                  <p className={styles.city}>
                    {b.city}, {b.province}
                  </p>
                  <span className={styles.badge} data-status={b.status}>
                    {copy.labels.statusBadge[b.status]}
                  </span>
                </div>
                <h2 className={styles.cardTitle}>
                  <a href={pageUrl(b.pageUrl)}>{b.name}</a>
                </h2>
                {b.address && <p className={styles.address}>{b.address}</p>}
                {status.label && (
                  <p className={styles.cardStatus}>
                    <Icon name="clock" size={14} />
                    {status.label}
                  </p>
                )}
                <div className={styles.cardActions}>
                  <Button href={pageUrl(b.pageUrl)} variant="ghost" size="sm" iconEnd="arrow">
                    {copy.labels.viewPage}
                  </Button>
                  {b.bookable && (
                    <Button href={target.href} external={target.external} onClick={target.onClick} variant="light" size="sm" icon="whatsapp">
                      {copy.labels.book}
                    </Button>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

import { useBranch } from '@/lib/BranchContext';
import { useSite } from '@/lib/SiteContext';
import { useBooking } from '@/lib/useBooking';
import { getOpenStatus } from '@/lib/branchHours';
import { pageUrl } from '@/lib/navigation';
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

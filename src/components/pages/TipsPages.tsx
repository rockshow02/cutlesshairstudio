import { useState } from 'react';
import { getServices } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useBooking } from '@/lib/useBooking';
import { pageUrl } from '@/lib/navigation';
import { selectPriceCategory } from '@/lib/priceCategoryEvent';
import { categoryFromQuery, getCurrentTip, getTips, tipCover, tipsPageFromPath } from '@/lib/tips';
import {
  TIPS_PATH,
  TIPS_PER_PAGE,
  TIP_CATEGORIES,
  TOC_MIN_HEADINGS,
  categorySlug,
  formatTipDate,
  relatedTips,
  tipPath,
  tipsPageCount,
  tipsPagePath,
  type TipCategory,
  type TipSummary,
} from '@/content/tipsSeo';
import { readingLabel, tipsCopy } from '@/content/tipsCopy';
import { Section } from '@/components/ui/Section';
import { Kicker } from '@/components/ui/SectionTitle';
import { Button } from '@/components/ui/Button';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import styles from './TipsPages.module.css';

const l = tipsCopy.labels;

/* ---------- Kartu artikel (daftar, artikel terkait, Tips Terbaru di beranda) ---------- */

export function TipCard({ tip, heading: Heading = 'h2' }: { tip: TipSummary; heading?: 'h2' | 'h3' }) {
  return (
    <li className={styles.card}>
      <a className={styles.cardLink} href={pageUrl(tipPath(tip.slug))}>
        <ResponsiveImage className={styles.cardImage} image={tipCover(tip, '(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw')} />
        <div className={styles.cardBody}>
          <p className={styles.category}>{tip.category}</p>
          <Heading className={styles.cardTitle}>{tip.title}</Heading>
          <p className={styles.cardSummary}>{tip.summary}</p>
          <p className={styles.cardMeta}>
            <time dateTime={tip.publishedAt}>{formatTipDate(tip.publishedAt)}</time>
            <span aria-hidden="true"> · </span>
            <span>{readingLabel(tip.readingMinutes)}</span>
          </p>
        </div>
      </a>
    </li>
  );
}

export function TipGrid({ tips, heading }: { tips: TipSummary[]; heading?: 'h2' | 'h3' }) {
  return (
    <ul className={styles.grid}>
      {tips.map((t) => (
        <TipCard key={t.slug} tip={t} heading={heading} />
      ))}
    </ul>
  );
}

/* ---------- /tips/ & /tips/halaman/<n>/ ---------- */

export function TipsIndex() {
  const all = getTips();
  const [category, setCategory] = useState<TipCategory | undefined>(() => categoryFromQuery(window.location.search));
  const categories = TIP_CATEGORIES.filter((c) => all.some((t) => t.category === c));
  const list = category ? all.filter((t) => t.category === category) : all;
  const pages = tipsPageCount(list.length);
  // Tanpa filter: halaman dari URL statis (/tips/halaman/2/); dengan filter: ?kategori=…&halaman=2
  const requested = category ? Number(new URLSearchParams(window.location.search).get('halaman') ?? 1) : tipsPageFromPath(window.location.pathname);
  const page = Math.min(Math.max(1, requested || 1), pages);
  const items = list.slice((page - 1) * TIPS_PER_PAGE, page * TIPS_PER_PAGE);
  const href = (p: number) => (category ? `${TIPS_PATH}?kategori=${categorySlug(category)}${p > 1 ? `&halaman=${p}` : ''}` : tipsPagePath(p));

  const choose = (c: TipCategory | undefined) => {
    setCategory(c);
    window.history.replaceState(null, '', pageUrl(c ? `${TIPS_PATH}?kategori=${categorySlug(c)}` : TIPS_PATH));
  };

  return (
    <Section id="tips" tone="dark" labelledBy="tips-title" className={styles.page}>
      <div className={styles.pageHead}>
        <Kicker>{tipsCopy.heading.kicker}</Kicker>
        <h1 id="tips-title" className={styles.pageTitle}>
          {tipsCopy.heading.title}
        </h1>
        <p className={styles.pageIntro}>{tipsCopy.heading.intro}</p>
      </div>

      {categories.length > 1 && (
        <div className={styles.filters} role="group" aria-label={l.filterLabel}>
          {([undefined, ...categories] as const).map((c) => (
            <button key={c ?? 'all'} type="button" className={styles.chip} aria-pressed={category === c} onClick={() => choose(c)}>
              {c ?? l.filterAll}
            </button>
          ))}
        </div>
      )}

      {items.length > 0 ? <TipGrid tips={items} /> : <p className={styles.empty}>{l.empty}</p>}

      {pages > 1 && (
        <nav className={styles.pagination} aria-label={l.pagination}>
          <p>{l.pageOf.replace('{page}', String(page)).replace('{pages}', String(pages))}</p>
          <div className={styles.pageLinks}>
            {page > 1 && (
              <Button href={pageUrl(href(page - 1))} variant="ghost" icon="chevron-left" size="sm">
                {l.previous}
              </Button>
            )}
            {page < pages && (
              <Button href={pageUrl(href(page + 1))} variant="ghost" iconEnd="chevron-right" size="sm">
                {l.next}
              </Button>
            )}
          </div>
        </nav>
      )}
    </Section>
  );
}

/* ---------- /tips/<slug>/ ---------- */

export function TipArticlePage() {
  const tip = getCurrentTip();
  const book = useBooking();
  const services = useContent(() => getServices());

  if (!tip) {
    return (
      <Section id="tips" tone="dark" labelledBy="tips-title" className={styles.page}>
        <Kicker>{tipsCopy.heading.kicker}</Kicker>
        <h1 id="tips-title" className={styles.pageTitle}>
          {l.notFoundTitle}
        </h1>
        <p className={styles.pageIntro}>{l.notFoundText}</p>
        <Button href={pageUrl(TIPS_PATH)} variant="light" iconEnd="arrow">
          {l.backToTips}
        </Button>
      </Section>
    );
  }

  const target = book({ kind: 'general' });
  const related = relatedTips(getTips(), tip);
  const toc = tip.headings.length >= TOC_MIN_HEADINGS ? tip.headings : [];
  const serviceLinks = tip.services.map((name) => {
    const s = services.status === 'success' ? services.data.items.find((i) => i.name === name) : undefined;
    return { name, href: s?.priceHref ? (s.priceHref.startsWith('#') ? `${pageUrl('/')}${s.priceHref}` : s.priceHref) : undefined, category: s?.pricingCategory };
  });

  return (
    <Section id="tips" tone="dark" labelledBy="tips-title" className={styles.page}>
      <article className={styles.article}>
        <nav className={styles.breadcrumb} aria-label={l.breadcrumb}>
          <ol>
            <li>
              <a href={pageUrl('/')}>{l.home}</a>
            </li>
            <li>
              <a href={pageUrl(TIPS_PATH)}>{tipsCopy.heading.title}</a>
            </li>
            <li aria-current="page">{tip.title}</li>
          </ol>
        </nav>

        <header className={styles.articleHead}>
          <p className={styles.category}>{tip.category}</p>
          <h1 id="tips-title" className={styles.articleTitle}>
            {tip.title}
          </h1>
          <p className={styles.lead}>{tip.summary}</p>
          <div className={styles.meta}>
            <p>
              <span>{l.published}</span> <time dateTime={tip.publishedAt}>{formatTipDate(tip.publishedAt)}</time>
            </p>
            {tip.updatedAt && tip.updatedAt > tip.publishedAt && (
              <p>
                <span>{l.updated}</span> <time dateTime={tip.updatedAt}>{formatTipDate(tip.updatedAt)}</time>
              </p>
            )}
            <p>{readingLabel(tip.readingMinutes)}</p>
            {tip.author && (
              <p>
                <span>{l.author}</span> <a href={`${pageUrl('/')}#hairstylist`}>{tip.author}</a>
              </p>
            )}
          </div>
        </header>

        <ResponsiveImage className={styles.cover} image={tipCover(tip, '(min-width: 768px) 48rem, 100vw')} priority />

        {toc.length > 0 && (
          <nav className={styles.toc} aria-labelledby="tips-toc">
            <p id="tips-toc" className={styles.tocTitle}>
              {l.toc}
            </p>
            <ol>
              {toc.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`}>{h.text}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* HTML hasil render Markdown saat build (scripts/tips.ts): HTML mentah dari CMS sudah di-escape */}
        <div className={styles.prose} dangerouslySetInnerHTML={{ __html: tip.html }} />

        <aside className={styles.cta} aria-labelledby="tips-cta">
          <h2 id="tips-cta" className={styles.ctaTitle}>
            {tipsCopy.cta.title}
          </h2>
          <p>{tipsCopy.cta.text}</p>
          <Button href={target.href} external={target.external} onClick={target.onClick} variant="light" icon="whatsapp">
            {tipsCopy.cta.button}
          </Button>
        </aside>

        {serviceLinks.length > 0 && (
          <section className={styles.services} aria-labelledby="tips-services">
            <h2 id="tips-services" className={styles.sectionTitle}>
              {l.servicesTitle}
            </h2>
            <ul>
              {serviceLinks.map((s) => (
                <li key={s.name}>
                  <span>{s.name}</span>
                  {s.href && (
                    <a href={s.href} onClick={() => s.category && selectPriceCategory(s.category)}>
                      {l.seePrice}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      {related.length > 0 && (
        <section className={styles.related} aria-labelledby="tips-related">
          <h2 id="tips-related" className={styles.sectionTitle}>
            {l.relatedTitle}
          </h2>
          <TipGrid tips={related} heading="h3" />
        </section>
      )}
    </Section>
  );
}

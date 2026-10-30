import { useState } from 'react';
import { getBarbers, getServices } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useBooking } from '@/lib/useBooking';
import { useSite } from '@/lib/SiteContext';
import { useBranch } from '@/lib/BranchContext';
import { pageUrl } from '@/lib/navigation';
import { selectPriceCategory } from '@/lib/priceCategoryEvent';
import { fillTemplate } from '@/lib/whatsapp';
import { copyText, getCurrentTip, getTips, tipCover, whatsappShareUrl } from '@/lib/tips';
import {
  TIPS_PATH,
  TIPS_PER_PAGE,
  TIP_CATEGORIES,
  TOC_MIN_HEADINGS,
  formatTipDate,
  relatedTips,
  tipPath,
  tipsPageCount,
  tipsPagePath,
  type TipArticle,
  type TipCategory,
  type TipSummary,
} from '@/content/tipsSeo';
import { readingLabel, tipCtaMessage, tipsCopy } from '@/content/tipsCopy';
import type { Barber } from '@/types';
import { Section } from '@/components/ui/Section';
import { Kicker } from '@/components/ui/SectionTitle';
import { Button } from '@/components/ui/Button';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import styles from './TipsPages.module.css';

const l = tipsCopy.labels;

/* ---------- Kartu artikel (daftar, artikel terkait, Tips Terbaru di beranda); HP ≤ 600 px: versi ringkas ---------- */

export function TipCard({ tip, heading: Heading = 'h2' }: { tip: TipSummary; heading?: 'h2' | 'h3' }) {
  return (
    <li className={styles.card}>
      <a className={styles.cardLink} href={pageUrl(tipPath(tip.slug))}>
        <ResponsiveImage className={styles.cardImage} image={tipCover(tip, '(min-width: 1024px) 24rem, (min-width: 601px) 50vw, 96px')} />
        <div className={styles.cardBody}>
          <p className={styles.category}>{tip.category}</p>
          <Heading className={styles.cardTitle}>{tip.title}</Heading>
          <p className={styles.cardSummary}>{tip.summary}</p>
          <p className={styles.cardMeta}>
            <time dateTime={tip.publishedAt}>{formatTipDate(tip.publishedAt)}</time>
            <span className={styles.cardReading}>
              <span aria-hidden="true"> · </span>
              {readingLabel(tip.readingMinutes)}
            </span>
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

/* ---------- /tips/, /tips/halaman/<n>/, /tips/kategori/<slug>/(halaman/<n>/) ---------- */

/** Chip kategori = link ke halaman kategori statis (jalan tanpa JavaScript); HP: satu baris, digeser horizontal */
function CategoryChips({ current, categories }: { current?: TipCategory; categories: TipCategory[] }) {
  if (categories.length < 2) return null;
  return (
    <nav className={styles.filters} aria-label={l.filterLabel}>
      <ul>
        {([undefined, ...categories] as const).map((c) => (
          <li key={c ?? 'all'}>
            <a className={styles.chip} href={pageUrl(tipsPagePath(1, c))} aria-current={c === current ? 'page' : undefined}>
              {c ?? l.filterAll}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function TipsIndex({ category, page: requested }: { category?: TipCategory; page: number }) {
  const all = getTips();
  const categories = TIP_CATEGORIES.filter((c) => all.some((t) => t.category === c));
  const list = category ? all.filter((t) => t.category === category) : all;
  const pages = tipsPageCount(list.length);
  const page = Math.min(Math.max(1, requested), pages);
  const items = list.slice((page - 1) * TIPS_PER_PAGE, page * TIPS_PER_PAGE);
  const heading = category
    ? { kicker: tipsCopy.categoryKicker, title: category, intro: tipsCopy.categoryIntro[category] }
    : tipsCopy.heading;

  return (
    <Section id="tips" tone="dark" labelledBy="tips-title" className={styles.page}>
      <div className={styles.pageHead}>
        <Kicker>{heading.kicker}</Kicker>
        <h1 id="tips-title" className={styles.pageTitle}>
          {heading.title}
        </h1>
        <p className={styles.pageIntro}>{heading.intro}</p>
      </div>

      <CategoryChips current={category} categories={categories} />

      {items.length > 0 ? <TipGrid tips={items} /> : <p className={styles.empty}>{l.empty}</p>}

      {pages > 1 && (
        <nav className={styles.pagination} aria-label={l.pagination}>
          <p>{l.pageOf.replace('{page}', String(page)).replace('{pages}', String(pages))}</p>
          <div className={styles.pageLinks}>
            {page > 1 && (
              <Button href={pageUrl(tipsPagePath(page - 1, category))} variant="ghost" icon="chevron-left" size="sm">
                {l.previous}
              </Button>
            )}
            {page < pages && (
              <Button href={pageUrl(tipsPagePath(page + 1, category))} variant="ghost" iconEnd="chevron-right" size="sm">
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
  const barbers = useContent(() => getBarbers());

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

  // Pesan menyebut judul artikel; cabang tetap dipilih pengunjung (pemilih cabang)
  const target = book({ message: tipCtaMessage(tip.title), source: 'tips' });
  const related = relatedTips(getTips(), tip);
  const toc = tip.headings.length >= TOC_MIN_HEADINGS ? tip.headings : [];
  const author = tip.author && barbers.status === 'success' ? barbers.data.items.find((b) => b.name === tip.author) : undefined;
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
            <li aria-current="page" title={tip.title}>
              {tip.title}
            </li>
          </ol>
        </nav>

        <header className={styles.articleHead}>
          <p className={styles.category}>
            <a href={pageUrl(tipsPagePath(1, tip.category))}>{tip.category}</a>
          </p>
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

        {tip.keyPoints.length > 0 && (
          <section className={styles.keyPoints} aria-labelledby="tips-key-points">
            <h2 id="tips-key-points" className={styles.boxTitle}>
              {l.keyPoints}
            </h2>
            <ul>
              {tip.keyPoints.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </section>
        )}

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

        {tip.faq.length > 0 && <TipFaq faq={tip.faq} />}

        {tip.author && <AuthorBox name={tip.author} barber={author} />}

        <ShareButtons tip={tip} />

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

/** FAQ artikel: akordeon <details> bawaan browser (bisa dibuka tanpa JavaScript, terbaca keyboard & screen reader) */
function TipFaq({ faq }: { faq: TipArticle['faq'] }) {
  return (
    <section className={styles.faq} aria-labelledby="tips-faq">
      <h2 id="tips-faq" className={styles.sectionTitle}>
        {l.faqTitle}
      </h2>
      <div className={styles.faqList}>
        {faq.map((q) => (
          <details key={q.question} className={styles.faqItem}>
            <summary>{q.question}</summary>
            <p>{q.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Kotak penulis: foto, nama (→ kartu kapster), jabatan, pengalaman, keahlian, bio, tombol booking kapster itu */
function AuthorBox({ name, barber }: { name: string; barber?: Barber }) {
  const { branches } = useBranch();
  const book = useBooking();
  const a = tipsCopy.authorBox;
  const branch = barber && branches.find((b) => b.slug === barber.branchSlug);
  // Sama dengan tombol "Booking [nama]" di kartu kapster: template pesan kapster, cabang & nomor kapster itu
  const target = barber ? book({ kind: 'barber', vars: { barber: barber.name }, branchSlug: barber.branchSlug, number: barber.whatsappNumber }) : undefined;

  return (
    <section className={styles.author} aria-labelledby="tips-author">
      <h2 id="tips-author" className={styles.boxTitle}>
        {a.title}
      </h2>
      <div className={styles.authorBody}>
        {barber && <ResponsiveImage className={styles.authorPhoto} image={{ ...barber.photo, sizes: '96px' }} />}
        <div className={styles.authorText}>
          {barber?.role && <p className={styles.category}>{barber.role}</p>}
          <p className={styles.authorName}>
            <a href={`${pageUrl('/')}#hairstylist`}>{name}</a>
          </p>
          {barber?.experience && (
            <p className={styles.authorMeta}>
              <span>{a.experience}</span> <span>{barber.experience}</span>
            </p>
          )}
          {barber && barber.specialties.length > 0 && (
            <div className={styles.authorMeta}>
              <p>{a.specialties}</p>
              <ul className={styles.tags}>
                {barber.specialties.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {barber?.bio && <p className={styles.authorBio}>{barber.bio}</p>}
          {target && branch?.bookable && (
            <Button href={target.href} external={target.external} onClick={target.onClick} variant="ghost" size="sm" icon="whatsapp">
              {fillTemplate(a.book, { name: barber!.name })}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

/** Bagikan: WhatsApp (wa.me/?text=judul+link) & salin link (fallback: link ditampilkan untuk disalin manual) */
function ShareButtons({ tip }: { tip: TipArticle }) {
  const { site } = useSite();
  const s = tipsCopy.share;
  const url = `${site.siteUrl}${tipPath(tip.slug)}`;
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle');

  return (
    <div className={styles.share} role="group" aria-label={s.label}>
      <Button href={whatsappShareUrl(tip.title, url)} external variant="ghost" size="sm" icon="whatsapp">
        {s.whatsapp}
      </Button>
      <Button variant="ghost" size="sm" onClick={async () => setStatus((await copyText(url)) ? 'copied' : 'manual')}>
        {s.copy}
      </Button>
      <p className={styles.shareStatus} role="status">
        {status === 'copied' && s.copied}
      </p>
      {status === 'manual' && (
        <label className={styles.shareManual}>
          <span>{s.manual}</span>
          <input type="text" readOnly value={url} onFocus={(e) => e.currentTarget.select()} autoFocus />
        </label>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useBooking } from '@/lib/useBooking';
import { useBranch } from '@/lib/BranchContext';
import { pageUrl } from '@/lib/navigation';
import { getKabar, kabarImage, useNow } from '@/lib/kabar';
import {
  KABAR_ALL_BRANCHES,
  KABAR_KINDS,
  KABAR_PATH,
  filterKabar,
  formatKabarDate,
  groupKabar,
  kabarPath,
  mapsUrl,
  type KabarArticle,
  type KabarKind,
  type KabarSummary,
} from '@/content/kabarSeo';
import { kabarCopy, kabarCtaMessage, kabarPeriodLabel, kabarStatusLabel, kabarWaButtons } from '@/content/kabarCopy';
import { Section } from '@/components/ui/Section';
import { Kicker } from '@/components/ui/SectionTitle';
import { Button } from '@/components/ui/Button';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { Breadcrumb } from './TipsPages';
// Kartu, judul halaman, chip, artikel & prosa sama dengan Tips & Trik; KabarPages.module.css hanya tambahan
import tips from './TipsPages.module.css';
import styles from './KabarPages.module.css';

const l = kabarCopy.labels;

/* ---------- Kartu (teks sama dengan cardHtml di scripts/kabar.ts) ---------- */

export function KabarCard({ item, now, hidden = false }: { item: KabarSummary; now: number; hidden?: boolean }) {
  const image = kabarImage(item, '(min-width: 1024px) 24rem, (min-width: 601px) 50vw, 96px');
  const period = kabarPeriodLabel(item);
  const status = kabarStatusLabel(item, now);
  return (
    <li className={tips.card} hidden={hidden}>
      <a className={tips.cardLink} href={pageUrl(kabarPath(item.slug))}>
        {image && <ResponsiveImage className={tips.cardImage} image={image} />}
        <div className={tips.cardBody}>
          <p className={tips.category}>{item.kind}</p>
          <h3 className={tips.cardTitle}>{item.title}</h3>
          <p className={tips.cardSummary}>{item.summary}</p>
          {period && <p className={styles.period}>{period}</p>}
          {status && <p className={styles.status}>{status}</p>}
          <p className={tips.cardMeta}>
            <time dateTime={item.publishedAt}>{formatKabarDate(item.publishedAt)}</time>
          </p>
        </div>
      </a>
    </li>
  );
}

/* ---------- /kabar/ ---------- */

/** Semua item tetap di DOM (sama dengan HTML statis); saringan cabang & jenis hanya menyembunyikan lewat `hidden` */
export function KabarIndex() {
  const list = getKabar();
  const now = useNow();
  const { branches } = useBranch();
  const [branch, setBranch] = useState('');
  const [kind, setKind] = useState<KabarKind | undefined>();

  const { active, news, ended } = groupKabar(list, now);
  const visible = new Set(filterKabar(list, { branch: branch || undefined, kind }).map((k) => k.slug));
  const kinds = KABAR_KINDS.filter((k) => list.some((i) => i.kind === k));
  const groups = (
    [
      ['active', kabarCopy.groups.active, active],
      ['news', kabarCopy.groups.news, news],
      ['ended', kabarCopy.groups.ended, ended],
    ] as const
  ).filter(([, , items]) => items.length > 0);

  return (
    <Section id="kabar" tone="dark" labelledBy="kabar-title" className={tips.page}>
      <div className={tips.pageHead}>
        <Kicker>{kabarCopy.heading.kicker}</Kicker>
        <h1 id="kabar-title" className={tips.pageTitle}>
          {kabarCopy.heading.title}
        </h1>
        <p className={tips.pageIntro}>{kabarCopy.heading.intro}</p>
      </div>

      {list.length === 0 ? (
        <p className={tips.empty}>{l.empty}</p>
      ) : (
        <>
          <div className={styles.filters} role="group" aria-label={l.filterLabel}>
            {branches.length > 1 && (
              <label className={styles.select}>
                <span>{l.filterBranch}</span>
                <select value={branch} onChange={(e) => setBranch(e.target.value)}>
                  <option value="">{l.allBranches}</option>
                  {branches.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {kinds.length > 1 && (
              <div className={styles.kinds} role="group" aria-label={l.filterKind}>
                {([undefined, ...kinds] as const).map((k) => (
                  <button key={k ?? 'all'} type="button" className={tips.chip} aria-pressed={kind === k} onClick={() => setKind(k)}>
                    {k ?? l.filterAllKinds}
                  </button>
                ))}
              </div>
            )}
          </div>

          {groups.map(([id, title, items]) => (
            <section key={id} className={styles.group} aria-labelledby={`kabar-${id}`} hidden={!items.some((k) => visible.has(k.slug))}>
              <h2 id={`kabar-${id}`} className={tips.sectionTitle}>
                {title}
              </h2>
              <ul className={tips.grid}>
                {items.map((k) => (
                  <KabarCard key={k.slug} item={k} now={now} hidden={!visible.has(k.slug)} />
                ))}
              </ul>
            </section>
          ))}

          {visible.size === 0 && <p className={tips.empty}>{l.noMatch}</p>}
        </>
      )}
    </Section>
  );
}

/* ---------- /kabar/<slug>/ (teks sama dengan kabarBody di scripts/kabar.ts) ---------- */

export function KabarDetail({ item }: { item: KabarArticle }) {
  const now = useNow();
  const { branches } = useBranch();
  const book = useBooking();
  const all = item.branches.includes(KABAR_ALL_BRANCHES);
  const names = all ? [l.allBranches] : item.branches.map((s) => branches.find((b) => b.slug === s)?.name ?? s);
  const status = kabarStatusLabel(item, now);
  const period = kabarPeriodLabel(item);
  const image = kabarImage(item, '(min-width: 768px) 48rem, 100vw');
  // Acara "Di cabang": alamat cabang terpilih (semua cabang = yang beroperasi, sama dengan JSON-LD)
  const places =
    item.kind === 'Acara' && item.locationType !== 'Tempat lain'
      ? branches.filter((b) => b.address && (all ? b.status !== 'Segera Dibuka' : item.branches.includes(b.slug)))
      : [];
  const message = kabarCtaMessage(item.title);
  const buttons = kabarWaButtons(item, branches, now).map((btn) => ({
    ...btn,
    target: book({ message, branchSlug: btn.branchSlug, source: 'promo' }),
  }));

  return (
    <Section id="kabar" tone="dark" labelledBy="kabar-title" className={tips.page}>
      <article className={tips.article}>
        <Breadcrumb label={l.breadcrumb} home={l.home} parent={{ href: pageUrl(KABAR_PATH), label: kabarCopy.heading.title }} current={item.title} />

        <header className={tips.articleHead}>
          <p className={tips.category}>{item.kind}</p>
          <h1 id="kabar-title" className={tips.articleTitle}>
            {item.title}
          </h1>
          <p className={tips.lead}>{item.summary}</p>
          {status && <p className={styles.status}>{status}</p>}
          <div className={styles.facts}>
            {period && (
              <p>
                <span>{item.kind === 'Acara' ? l.time : l.period}</span> {period}
              </p>
            )}
            {item.kind === 'Acara' &&
              (item.locationType === 'Tempat lain' && item.venueName && item.venueAddress ? (
                <p>
                  <span>{l.location}</span> {item.venueName}, {item.venueAddress}{' '}
                  <a href={mapsUrl(item.venueName, item.venueAddress)} target="_blank" rel="noopener noreferrer">
                    {l.openMap}
                  </a>
                </p>
              ) : (
                <div>
                  <p>
                    <span>{l.location}</span> {names.join(', ')}
                  </p>
                  {places.length > 0 && (
                    <ul className={styles.places}>
                      {places.map((b) => (
                        <li key={b.slug}>
                          <a href={pageUrl(b.pageUrl)}>{b.name}</a>: {b.address}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            <p>
              <span>{l.branches}</span> {names.join(', ')}
            </p>
            <p>
              <span>{l.published}</span> <time dateTime={item.publishedAt}>{formatKabarDate(item.publishedAt)}</time>
            </p>
          </div>
        </header>

        {image && <ResponsiveImage className={tips.cover} image={image} priority />}

        {/* HTML hasil render Markdown saat build (scripts/kabar.ts): HTML mentah dari CMS sudah di-escape */}
        <div className={tips.prose} dangerouslySetInnerHTML={{ __html: item.html }} />

        {(buttons.length > 0 || (item.kind === 'Acara' && item.linkUrl)) && (
          <div className={styles.actions}>
            {buttons.map(({ label, branchSlug, target }) => (
              <Button key={branchSlug ?? 'semua'} href={target.href} external={target.external} onClick={target.onClick} variant="light" icon="whatsapp">
                {label}
              </Button>
            ))}
            {item.kind === 'Acara' && item.linkUrl && (
              <Button href={item.linkUrl} external variant="ghost" iconEnd="arrow">
                {l.eventLink}
              </Button>
            )}
          </div>
        )}
      </article>
    </Section>
  );
}

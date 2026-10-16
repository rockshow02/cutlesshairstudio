import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { getBarbers, getLocations, getServices } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useSite } from '@/lib/SiteContext';
import { useBranch } from '@/lib/BranchContext';
import { useBooking } from '@/lib/useBooking';
import { getOpenStatus, todayIndex } from '@/lib/branchHours';
import { formatPrice, formatTime } from '@/lib/format';
import { pageUrl } from '@/lib/navigation';
import { MOBILE_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import { fillTemplate } from '@/lib/whatsapp';
import type { Barber, Branch, LocationsContent } from '@/types';
import { DISTANCE, DURATION, EASE, MARQUEE } from '@/styles/motion';
import { Section } from '@/components/ui/Section';
import { SectionState } from '@/components/ui/SectionState';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { Marquee } from '@/components/motion/Marquee';
import { Reveal } from '@/components/motion/Reveal';
import styles from './Location.module.css';

type Labels = LocationsContent['labels'];

/** Section Lokasi: chip cabang → info cabang berganti (fade + geser) + foto hairstylist cabang itu berjalan di samping. */
export function Location() {
  const state = useContent(getLocations);

  return (
    <Section id="lokasi" tone="light" labelledBy="lokasi-title">
      <SectionState state={state} tone="light" isEmpty={(d) => d.items.length === 0} skeletonCount={2}>
        {(data) => (
          <>
            <SectionTitle heading={data.heading} id="lokasi-title" tone="light" />
            <Branches data={data} />
          </>
        )}
      </SectionState>
    </Section>
  );
}

/** Chip cabang (pola tablist ARIA + navigasi panah). Satu cabang → tanpa chip. */
function Branches({ data }: { data: LocationsContent }) {
  const { effective } = useBranch();
  const preferred = Math.max(0, data.items.findIndex((b) => b.slug === effective?.slug));
  const [active, setActive] = useState(preferred);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const multi = data.items.length > 1;
  const branch = data.items[active] ?? data.items[0];

  // Pengunjung ganti cabang → buka cabang itu
  useEffect(() => setActive(preferred), [preferred]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = data.items.length - 1;
    const next = e.key === 'ArrowRight' ? active + 1 : e.key === 'ArrowLeft' ? active - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (next === null) return;
    e.preventDefault();
    const idx = (next + data.items.length) % data.items.length;
    setActive(idx);
    tabRefs.current[idx]?.focus();
  };

  return (
    <>
      {multi && (
        <div className={styles.chips} role="tablist" aria-label={data.labels.branchTabs} onKeyDown={onKeyDown}>
          {data.items.map((b, i) => (
            <button
              key={b.slug}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${b.slug}`}
              aria-selected={i === active}
              aria-controls={i === active ? `panel-${b.slug}` : undefined}
              tabIndex={i === active ? 0 : -1}
              className={styles.chip}
              onClick={() => setActive(i)}
            >
              {b.name}
              {b.status !== 'Aktif' && <span className={styles.chipBadge}>{data.labels.statusBadge[b.status]}</span>}
            </button>
          ))}
        </div>
      )}
      <div className={styles.stage}>
        <div className={styles.stagePanel}>
          <AnimatePresence mode="popLayout" initial={false}>
            <m.div
              key={branch.slug}
              id={`panel-${branch.slug}`}
              role={multi ? 'tabpanel' : undefined}
              aria-labelledby={multi ? `tab-${branch.slug}` : undefined}
              className={styles.swap}
              initial={{ opacity: 0, x: DISTANCE.swap }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -DISTANCE.swap }}
              transition={{ duration: DURATION.swap, ease: EASE.out }}
            >
              <BranchPanel branch={branch} labels={data.labels} layout="stacked" showServices />
            </m.div>
          </AnimatePresence>
        </div>
        <BranchBarbers branch={branch} labels={data.labels} />
      </div>
    </>
  );
}

/** Layanan + harga "mulai" di cabang ini (dari Daftar Harga) */
function BranchServices({ branch, title }: { branch: Branch; title: string }) {
  const { site } = useSite();
  const state = useContent(() => getServices(branch.slug), [branch.slug]);
  if (state.status !== 'success' || state.data.items.length === 0) return null;
  return (
    <div className={styles.services}>
      <p className={styles.servicesTitle}>{title}</p>
      <ul>
        {state.data.items.map((s) => (
          <li key={s.id}>
            <span>{s.name}</span>
            {s.startingPrice !== undefined && <span className={styles.servicePrice}>{formatPrice(s.startingPrice, true, site.ui.priceFrom)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Foto hairstylist cabang terpilih: 2–3 kolom berjalan vertikal berlawanan arah (desktop),
 * satu baris horizontal (mobile). Berhenti saat di-hover/fokus, di-tap, atau lewat tombol jeda.
 */
function BranchBarbers({ branch, labels }: { branch: Branch; labels: Labels }) {
  const state = useContent(() => getBarbers(branch.slug), [branch.slug]);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [paused, setPaused] = useState(false);
  const barbers = state.status === 'success' ? state.data.items : [];
  if (barbers.length === 0) return null;

  const columns = mobile ? [fill(barbers, 5)] : splitColumns(barbers, barbers.length >= 6 ? 3 : 2);
  const label = fillTemplate(labels.barbersMarquee, { branch: branch.name });

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={branch.slug}
        className={styles.barbers}
        role="group"
        aria-label={label}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: DURATION.swap, ease: EASE.out }}
        onPointerUp={(e) => e.pointerType === 'touch' && setPaused((p) => !p)}
      >
        <div className={styles.columns} data-count={columns.length}>
          {columns.map((col, i) => (
            <Marquee
              key={i}
              className={styles.column}
              direction={mobile ? 'left' : i % 2 === 0 ? 'up' : 'down'}
              duration={mobile ? MARQUEE.horizontal : MARQUEE.vertical + i * 4}
              paused={paused}
            >
              {col.map((b, j) => (
                <BarberPhoto key={`${b.id}-${j}`} barber={b} />
              ))}
            </Marquee>
          ))}
        </div>
        <button type="button" className={styles.pause} onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
          <Icon name={paused ? 'play' : 'pause'} size={14} />
          {paused ? labels.playMotion : labels.pauseMotion}
        </button>
      </m.div>
    </AnimatePresence>
  );
}

function BarberPhoto({ barber }: { barber: Barber }) {
  return (
    <figure className={styles.photo}>
      <ResponsiveImage image={barber.photo} className={styles.photoImg} />
      <figcaption>{barber.name}</figcaption>
    </figure>
  );
}

/** Ulangi daftar sampai minimal n item (agar pita tidak kosong saat barber sedikit) */
function fill<T>(items: T[], n: number): T[] {
  const out: T[] = [];
  while (out.length < Math.max(n, items.length)) out.push(items[out.length % items.length]);
  return out;
}

/** Bagi ke beberapa kolom dengan urutan berbeda tiap kolom, masing-masing min. 3 foto */
function splitColumns<T>(items: T[], count: number): T[][] {
  return Array.from({ length: count }, (_, c) => {
    const rotated = [...items.slice(c), ...items.slice(0, c)];
    const own = rotated.filter((_, i) => i % count === 0);
    return fill(own.length >= 2 ? own : rotated, 3);
  });
}

/** Detail satu cabang: alamat, status hari ini, jam buka, peta, tombol. Dipakai juga di halaman /cabang/:slug/. */
export function BranchPanel({
  branch,
  labels,
  headingLevel = 3,
  layout = 'split',
  showServices = false,
}: {
  branch: Branch;
  labels: Labels;
  headingLevel?: 2 | 3;
  /** split: info | peta berdampingan (halaman cabang); stacked: peta di bawah info (section Lokasi) */
  layout?: 'split' | 'stacked';
  showServices?: boolean;
}) {
  const { announcements, selected, pageBranch, select } = useBranch();
  const book = useBooking();
  const status = getOpenStatus(branch, labels, announcements);
  const today = todayIndex(branch);
  const target = book({ kind: 'general', branchSlug: branch.slug });
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const isSelected = selected?.slug === branch.slug;

  return (
    <div className={styles.panel} data-layout={layout}>
      <Reveal className={styles.info}>
        <div className={styles.titleRow}>
          <Heading className={styles.name}>{branch.name}</Heading>
          <span className={styles.statusBadge} data-status={branch.status}>
            {labels.statusBadge[branch.status]}
          </span>
        </div>
        {status.label && (
          <p className={styles.openStatus} data-state={status.state}>
            <Icon name="clock" size={16} />
            {status.label}
          </p>
        )}
        <address className={styles.lines}>
          <p>
            <Icon name="pin" />
            <span>{branch.address ?? `${branch.city}, ${branch.province}`}</span>
          </p>
          {branch.bookable && branch.phoneDisplay && (
            <p>
              <Icon name="whatsapp" />
              <span>{branch.phoneDisplay}</span>
            </p>
          )}
        </address>

        {branch.hours.length > 0 && (
          <table className={styles.hours}>
            <caption>{labels.hoursCaption}</caption>
            <tbody>
              {branch.hours.map((h) => (
                <tr key={h.day} data-today={h.day === today || undefined}>
                  <th scope="row">
                    {h.label}
                    {h.day === today && <span className={styles.today}>{labels.today}</span>}
                  </th>
                  <td>{h.closed || !h.open || !h.close ? labels.closed : `${formatTime(h.open)} – ${formatTime(h.close)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {showServices && <BranchServices branch={branch} title={labels.servicesTitle} />}

        <div className={styles.ctas}>
          {branch.bookable ? (
            <Button href={target.href} external={target.external} onClick={target.onClick} variant="dark" icon="whatsapp">
              {labels.book}
            </Button>
          ) : (
            <p className={styles.note}>{branch.status === 'Segera Dibuka' ? labels.comingSoonNote : labels.temporarilyClosedNote}</p>
          )}
          <Button href={branch.directionsUrl} external variant="outline-dark" icon="navigate">
            {labels.directions}
          </Button>
        </div>
        <div className={styles.secondary}>
          {branch.bookable && !pageBranch && (
            <button type="button" className={styles.linkBtn} onClick={() => select(branch.slug)} aria-pressed={isSelected}>
              <Icon name={isSelected ? 'check' : 'pin'} size={14} />
              {isSelected ? labels.selected : labels.selectThis}
            </button>
          )}
          {!pageBranch && (
            <a className={styles.linkBtn} href={pageUrl(branch.pageUrl)}>
              {labels.viewPage}
              <Icon name="arrow" size={14} />
            </a>
          )}
        </div>
      </Reveal>

      <Reveal className={styles.map} delay={0.08}>
        <iframe title={`Peta lokasi ${branch.name}`} src={branch.mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
      </Reveal>
    </div>
  );
}

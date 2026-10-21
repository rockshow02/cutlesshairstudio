import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { getGallery, getLocations, getServices } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useBranch } from '@/lib/BranchContext';
import { useBooking } from '@/lib/useBooking';
import { getOpenStatus, todayIndex } from '@/lib/branchHours';
import { formatTime } from '@/lib/format';
import { pageUrl } from '@/lib/navigation';
import { MOBILE_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import { useFabZone } from '@/lib/fabZones';
import { usePageHidden } from '@/lib/usePageHidden';
import type { Branch, GalleryItem, LocationsContent } from '@/types';
import { DISTANCE, DURATION, EASE, MARQUEE } from '@/styles/motion';
import { Section } from '@/components/ui/Section';
import { SectionState } from '@/components/ui/SectionState';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { Marquee } from '@/components/motion/Marquee';
import styles from './Location.module.css';

type Labels = LocationsContent['labels'];

/** Section Lokasi: chip cabang → info cabang berganti (fade + geser) + foto Galeri berjalan di samping (tidak ikut cabang). */
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
        <GalleryMarquee labels={data.labels} />
      </div>
    </>
  );
}

/** Layanan di cabang ini (Pages CMS → Kartu Layanan), tanpa harga; harga lengkap di Daftar Harga */
function BranchServices({ branch, title }: { branch: Branch; title: string }) {
  const state = useContent(() => getServices(branch.slug), [branch.slug]);
  if (state.status !== 'success' || state.data.items.length === 0) return null;
  return (
    <div className={styles.services}>
      <p className={styles.servicesTitle}>{title}</p>
      <ul>
        {state.data.items.map((s) => (
          <li key={s.id}>
            <span>{s.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Foto dari Galeri (Pages CMS → Galeri, "Tampilkan di kolom foto berjalan"), tidak terikat cabang.
 * Desktop/tablet: 2–3 kolom berjalan vertikal berlawanan arah; HP: satu baris horizontal.
 * Berhenti saat di-hover/fokus, di-tap, lewat tombol jeda, di luar layar, dan saat tab tidak aktif.
 * Kurang dari 4 foto atau "kurangi gerakan" → grid statis tanpa animasi.
 */
function GalleryMarquee({ labels }: { labels: Labels }) {
  const state = useContent(getGallery);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const pageHidden = usePageHidden();
  // Tombol WhatsApp melayang disembunyikan selama kolom foto ini terlihat sebagian besar (tidak menutupi kartu)
  const fabZone = useFabZone<HTMLDivElement>(0.35);
  const items = state.status === 'success' ? state.data.items.filter((g) => g.showInMarquee) : [];
  if (items.length === 0) return null;

  if (items.length < MIN_MARQUEE || reduce) {
    return (
      <div ref={fabZone} className={styles.gallery} role="group" aria-label={labels.galleryMarquee}>
        <ul className={styles.staticGrid} data-count={Math.min(items.length, 3)}>
          {items.map((g) => (
            <li key={g.id}>
              <GalleryCard item={g} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const columns = mobile ? [fill(items, 6)] : splitColumns(items, items.length >= 9 ? 3 : 2);
  return (
    <div
      ref={fabZone}
      className={styles.gallery}
      role="group"
      aria-label={labels.galleryMarquee}
      onPointerUp={(e) => e.pointerType === 'touch' && setPaused((p) => !p)}
    >
      <div className={styles.columns} data-count={columns.length}>
        {columns.map((col, i) => (
          <Marquee
            key={i}
            className={styles.column}
            direction={mobile ? 'left' : i % 2 === 0 ? 'up' : 'down'}
            duration={mobile ? MARQUEE.horizontal : MARQUEE.vertical + i * 4}
            paused={paused || pageHidden}
          >
            {col.map((g, j) => (
              <GalleryCard key={`${g.id}-${j}`} item={g} />
            ))}
          </Marquee>
        ))}
      </div>
      <button type="button" className={styles.pause} onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
        <Icon name={paused ? 'play' : 'pause'} size={14} />
        {paused ? labels.playMotion : labels.pauseMotion}
      </button>
    </div>
  );
}

/** Minimal foto aktif untuk animasi; di bawahnya tampil grid statis */
const MIN_MARQUEE = 4;

/** Kartu foto: label = keterangan, atau gaya rambut bila keterangan kosong (chip di atas gradasi) */
function GalleryCard({ item }: { item: GalleryItem }) {
  const label = item.caption ?? item.styleCategory;
  return (
    <figure className={styles.photo} data-focus={item.focus}>
      <ResponsiveImage image={item.thumb} className={styles.photoImg} />
      {label && <figcaption>{label}</figcaption>}
    </figure>
  );
}

/** Ulangi daftar sampai minimal n item (agar pita tidak kosong & putaran mulus saat foto sedikit) */
function fill<T>(items: T[], n: number): T[] {
  const out: T[] = [];
  while (out.length < Math.max(n, items.length)) out.push(items[out.length % items.length]);
  return out;
}

/** Bagi foto bergantian ke beberapa kolom (foto 1 → kolom 1, foto 2 → kolom 2, …); tiap kolom min. 4 kartu */
function splitColumns<T>(items: T[], count: number): T[][] {
  return Array.from({ length: count }, (_, c) => fill(items.filter((_, i) => i % count === c), 4));
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
      <div className={styles.info}>
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
      </div>

      <div className={styles.map}>
        <iframe title={`Peta lokasi ${branch.name}`} src={branch.mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
      </div>
    </div>
  );
}

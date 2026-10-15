import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { getLocations } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useBranch } from '@/lib/BranchContext';
import { useBooking } from '@/lib/useBooking';
import { getOpenStatus, todayIndex } from '@/lib/branchHours';
import { formatTime } from '@/lib/format';
import { pageUrl } from '@/lib/navigation';
import type { Branch, LocationsContent } from '@/types';
import { Section } from '@/components/ui/Section';
import { SectionState } from '@/components/ui/SectionState';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';
import styles from './Location.module.css';

/** Section Lokasi: semua cabang dalam tab (cabang pilihan pengunjung dibuka lebih dulu). */
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

/** Tab cabang (pola tablist ARIA + navigasi panah). Satu cabang → tanpa tab. */
function Branches({ data }: { data: LocationsContent }) {
  const { effective } = useBranch();
  const preferred = Math.max(0, data.items.findIndex((b) => b.slug === effective?.slug));
  const [active, setActive] = useState(preferred);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const multi = data.items.length > 1;

  // Pengunjung ganti cabang → buka tab cabang itu
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
        <div className={styles.tabs} role="tablist" aria-label={data.labels.branchTabs} onKeyDown={onKeyDown}>
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
              aria-controls={`panel-${b.slug}`}
              tabIndex={i === active ? 0 : -1}
              className={styles.tab}
              onClick={() => setActive(i)}
            >
              {b.name}
              {b.status !== 'Aktif' && <span className={styles.tabBadge}>{data.labels.statusBadge[b.status]}</span>}
            </button>
          ))}
        </div>
      )}
      {data.items.map((b, i) => (
        <div
          key={b.slug}
          id={`panel-${b.slug}`}
          role={multi ? 'tabpanel' : undefined}
          aria-labelledby={multi ? `tab-${b.slug}` : undefined}
          hidden={i !== active}
        >
          <BranchPanel branch={b} labels={data.labels} />
        </div>
      ))}
    </>
  );
}

/** Detail satu cabang: alamat, status hari ini, jam buka, peta, tombol. Dipakai juga di halaman /cabang/:slug/. */
export function BranchPanel({ branch, labels, headingLevel = 3 }: { branch: Branch; labels: LocationsContent['labels']; headingLevel?: 2 | 3 }) {
  const { announcements, selected, pageBranch, select } = useBranch();
  const book = useBooking();
  const status = getOpenStatus(branch, labels, announcements);
  const today = todayIndex(branch);
  const target = book({ kind: 'general', branchSlug: branch.slug });
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const isSelected = selected?.slug === branch.slug;

  return (
    <div className={styles.panel}>
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

import { useRef, useState, type KeyboardEvent } from 'react';
import { getLocations } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useSite } from '@/lib/SiteContext';
import { formatTime } from '@/lib/format';
import { bookingLink } from '@/lib/whatsapp';
import type { Location as Branch, LocationsContent } from '@/types';
import { Section } from '@/components/ui/Section';
import { SectionState } from '@/components/ui/SectionState';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';
import styles from './Location.module.css';

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

/** Mendukung banyak cabang: tab muncul otomatis bila > 1 (pola tablist ARIA + navigasi panah). */
function Branches({ data }: { data: LocationsContent }) {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const multi = data.items.length > 1;

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
          {data.items.map((loc, i) => (
            <button
              key={loc.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${loc.id}`}
              aria-selected={i === active}
              aria-controls={`panel-${loc.id}`}
              tabIndex={i === active ? 0 : -1}
              className={styles.tab}
              onClick={() => setActive(i)}
            >
              {loc.shortName}
            </button>
          ))}
        </div>
      )}
      {data.items.map((loc, i) => (
        <div
          key={loc.id}
          id={`panel-${loc.id}`}
          role={multi ? 'tabpanel' : undefined}
          aria-labelledby={multi ? `tab-${loc.id}` : undefined}
          hidden={i !== active}
        >
          <BranchPanel branch={loc} labels={data.labels} />
        </div>
      ))}
    </>
  );
}

function BranchPanel({ branch, labels }: { branch: Branch; labels: LocationsContent['labels'] }) {
  const { site } = useSite();
  const today = new Date().getDay();
  const { address } = branch;

  return (
    <div className={styles.panel}>
      <Reveal className={styles.info}>
        <h3 className={styles.name}>{branch.name}</h3>
        <address className={styles.lines}>
          <p>
            <Icon name="pin" />
            <span>
              {address.formatted ?? (
                <>
                  {address.street}
                  {address.area && `, ${address.area}`}
                  <br />
                  {address.city}, {address.province} {address.postalCode}
                </>
              )}
            </span>
          </p>
          <p>
            <Icon name="whatsapp" />
            <span>{branch.phoneDisplay}</span>
          </p>
        </address>

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

        <div className={styles.ctas}>
          <Button href={branch.map.directionsUrl} external variant="dark" icon="navigate">
            {labels.directions}
          </Button>
          <Button
            href={bookingLink(site, 'branch', { branch: branch.shortName }, branch.whatsappNumber ?? site.whatsapp.number)}
            external
            variant="outline-dark"
            icon="whatsapp"
          >
            {labels.bookBranch}
          </Button>
        </div>
      </Reveal>

      <Reveal className={styles.map} delay={0.08}>
        <iframe title={branch.map.title} src={branch.map.embedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
      </Reveal>
    </div>
  );
}

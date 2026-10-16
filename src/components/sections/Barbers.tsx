import { getBarbers } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useSite } from '@/lib/SiteContext';
import { useBranch } from '@/lib/BranchContext';
import { useBooking } from '@/lib/useBooking';
import { fillTemplate } from '@/lib/whatsapp';
import type { Barber } from '@/types';
import { Section } from '@/components/ui/Section';
import { SectionState } from '@/components/ui/SectionState';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Card, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import styles from './Barbers.module.css';

export function Barbers() {
  const { effective, copy } = useBranch();
  const { site } = useSite();
  // Cabang dipilih → barber cabang itu; belum memilih → semua barber + label cabang
  const state = useContent(() => getBarbers(effective?.slug), [effective?.slug]);

  return (
    <Section id="hairstylist" tone="dark" labelledBy="hairstylist-title">
      <SectionState state={state}>
        {(data) => {
          const heading = effective ? { ...data.heading, intro: fillTemplate(copy.labels.barbersFor, { branch: effective.name }) } : data.heading;
          return (
            <>
              <SectionTitle heading={heading} id="hairstylist-title" />
              {data.items.length === 0 ? (
                <p className={styles.empty}>{copy.labels.noBarbers}</p>
              ) : (
                <ul className={styles.track} tabIndex={0} aria-label={`${data.heading.kicker}. ${site.ui.scrollHint}`}>
                  {data.items.map((barber) => (
                    <li key={barber.id} className={styles.item}>
                      <BarberCard barber={barber} showBranch={!effective} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          );
        }}
      </SectionState>
    </Section>
  );
}

function BarberCard({ barber, showBranch }: { barber: Barber; showBranch: boolean }) {
  const { site } = useSite();
  const { branches } = useBranch();
  const book = useBooking();
  const branch = branches.find((b) => b.slug === barber.branchSlug);
  // Booking selalu ke cabang barber ini; nomor WA pribadi barber bila diisi
  const target = book({ kind: 'barber', vars: { barber: barber.name }, branchSlug: barber.branchSlug, number: barber.whatsappNumber });

  return (
    <Card tone="plain" className={styles.card}>
      <div className={styles.photoWrap}>
        <ResponsiveImage image={barber.photo} className={styles.photo} />
      </div>
      {barber.role && <p className={styles.role}>{barber.role}</p>}
      <h3 className={styles.name}>{barber.name}</h3>
      {showBranch && <p className={styles.branch}>{barber.branchName}</p>}
      {barber.specialties.length > 0 && (
        <ul className={styles.tags}>
          {barber.specialties.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
      {branch?.bookable && (
        <CardFooter>
          <Button href={target.href} external={target.external} onClick={target.onClick} variant="ghost" block>
            {fillTemplate(site.ui.bookWithBarber, { name: barber.name })}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

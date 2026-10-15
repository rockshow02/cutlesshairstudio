import { getBarbers } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useSite } from '@/lib/SiteContext';
import { bookingLink, fillTemplate } from '@/lib/whatsapp';
import { Section } from '@/components/ui/Section';
import { SectionState } from '@/components/ui/SectionState';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Card, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import styles from './Barbers.module.css';

export function Barbers() {
  const state = useContent(getBarbers);
  const { site } = useSite();

  return (
    <Section id="hairstylist" tone="dark" labelledBy="hairstylist-title">
      <SectionState state={state} isEmpty={(d) => d.items.length === 0} skeletonCount={4}>
        {(data) => (
          <>
            <SectionTitle heading={data.heading} id="hairstylist-title" />
            {/* Mobile: geser horizontal (scroll-snap) di dalam container; tablet/desktop: grid */}
            <ul className={styles.track} tabIndex={0} aria-label={`${data.heading.kicker}. ${site.ui.scrollHint}`}>
              {data.items.map((barber, i) => (
                <Reveal as="li" key={barber.id} className={styles.item} delay={(i % 4) * 0.06}>
                  <Card tone="plain" className={styles.card}>
                    <div className={styles.photoWrap}>
                      <ResponsiveImage image={barber.photo} className={styles.photo} />
                    </div>
                    {barber.role && <p className={styles.role}>{barber.role}</p>}
                    <h3 className={styles.name}>{barber.name}</h3>
                    {barber.specialties.length > 0 && (
                      <ul className={styles.tags}>
                        {barber.specialties.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    )}
                    <CardFooter>
                      <Button href={bookingLink(site, 'barber', { barber: barber.name }, barber.whatsappNumber ?? site.whatsapp.number)} external variant="ghost" block>
                        {fillTemplate(site.ui.bookWithBarber, { name: barber.name })}
                      </Button>
                    </CardFooter>
                  </Card>
                </Reveal>
              ))}
            </ul>
          </>
        )}
      </SectionState>
    </Section>
  );
}

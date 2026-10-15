import { getCtaBanner } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useSite } from '@/lib/SiteContext';
import { useFabZone } from '@/lib/fabZones';
import { resolveCta } from '@/lib/whatsapp';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Kicker } from '@/components/ui/SectionTitle';
import { Reveal } from '@/components/ui/Reveal';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import styles from './CtaBanner.module.css';

export function CtaBanner() {
  const state = useContent(getCtaBanner);
  const { site } = useSite();
  const zoneRef = useFabZone<HTMLElement>();

  if (state.status !== 'success') {
    // CTA penutup bersifat opsional: tidak tampil saat loading/gagal/kosong.
    return null;
  }
  const data = state.data;
  const cta = resolveCta(data.cta, site);

  return (
    <section id="booking" ref={zoneRef} className={styles.banner} aria-labelledby="booking-title">
      <ResponsiveImage image={data.backgroundImage} alt="" className={styles.bg} />
      <div className={styles.shade} aria-hidden="true" />
      <Container className={styles.inner}>
        <Reveal>
          <Kicker center>{data.kicker}</Kicker>
          <h2 id="booking-title" className={styles.title}>
            {data.title}
          </h2>
          <p className={styles.desc}>{data.description}</p>
          <Button href={cta.href} external={cta.external} size="lg" variant="light" icon="whatsapp">
            {data.cta.label}
          </Button>
        </Reveal>
      </Container>
    </section>
  );
}

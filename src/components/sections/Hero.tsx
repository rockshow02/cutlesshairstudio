import type { CSSProperties } from 'react';
import { getHero } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useSite } from '@/lib/SiteContext';
import { useFabZone } from '@/lib/fabZones';
import { resolveCta } from '@/lib/whatsapp';
import { asset } from '@/lib/asset';
import type { HeroContent } from '@/types';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Icon } from '@/components/ui/Icon';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import styles from './Hero.module.css';

const delay = (s: number) => ({ '--d': `${s}s` }) as CSSProperties;

export function Hero() {
  const state = useContent(getHero);
  const zoneRef = useFabZone<HTMLElement>();

  return (
    <>
      <section id="top" ref={zoneRef} className={styles.hero} aria-labelledby="hero-title" aria-busy={state.status === 'loading'}>
        {state.status === 'success' && <HeroBody hero={state.data} />}
      </section>
      {state.status === 'success' && state.data.marquee.length > 0 && <Marquee words={state.data.marquee} />}
    </>
  );
}

function HeroBody({ hero }: { hero: HeroContent }) {
  const { site } = useSite();
  const primary = resolveCta(hero.primaryCta, site);
  const secondary = resolveCta(hero.secondaryCta, site);

  return (
    <>
      {/* Media & overlay ditumpuk lewat grid-area yang sama (tanpa position absolute) */}
      <div className={styles.media}>
        {hero.video ? (
          <video className={styles.mediaEl} autoPlay muted loop playsInline poster={asset(hero.image.src)} aria-hidden="true">
            <source src={asset(hero.video.src)} type={hero.video.type} />
          </video>
        ) : (
          <ResponsiveImage image={hero.image} className={styles.mediaEl} priority />
        )}
      </div>
      <div className={styles.overlay} aria-hidden="true" />

      <Container className={styles.content}>
        <p className={`${styles.kicker} ${styles.anim}`} style={delay(0.1)}>
          {hero.kicker}
        </p>
        <h1 id="hero-title" className={`${styles.title} ${styles.anim}`} style={delay(0.2)}>
          {hero.titleLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h1>
        <p className={`${styles.subtitle} ${styles.anim}`} style={delay(0.3)}>
          {hero.subtitle}
        </p>
        <div className={`${styles.ctas} ${styles.anim}`} style={delay(0.4)}>
          <Button href={primary.href} external={primary.external} variant="light" icon="whatsapp">
            {hero.primaryCta.label}
          </Button>
          <Button href={secondary.href} external={secondary.external} variant="ghost">
            {hero.secondaryCta.label}
          </Button>
        </div>
      </Container>

      {hero.highlights.length > 0 && (
        <Container className={`${styles.meta} ${styles.anim}`} style={delay(0.55)}>
          <ul className={styles.highlights}>
            {hero.highlights.map((h) => (
              <li key={h.text}>
                <Icon name={h.icon} className={h.icon === 'star' ? styles.star : undefined} />
                {h.text}
              </li>
            ))}
          </ul>
        </Container>
      )}
    </>
  );
}

function Marquee({ words }: { words: string[] }) {
  // Diduplikasi agar loop mulus; salinan kedua disembunyikan dari screen reader.
  return (
    <div className={styles.marquee} aria-hidden="true">
      <div className={styles.track}>
        {[0, 1].map((copy) => (
          <div key={copy} className={styles.group}>
            {words.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

import type { CSSProperties } from 'react';
import { getHero } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useFabZone } from '@/lib/fabZones';
import { useBranch } from '@/lib/BranchContext';
import { useCtaTarget } from '@/lib/useBooking';
import { getOpenStatus } from '@/lib/branchHours';
import { joinIndonesian, operatingCities } from '@/lib/contentTransforms';
import { fillTemplate } from '@/lib/whatsapp';
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
  const { branches, selected, copy, announcements, openPicker } = useBranch();
  const ctaTarget = useCtaTarget();
  const primary = ctaTarget(hero.primaryCta);
  const secondary = ctaTarget(hero.secondaryCta);

  // Ringkasan dihitung dari data cabang, mis. "2 cabang · Bogor & Cibubur"
  const cities = joinIndonesian(operatingCities(branches));
  const operating = branches.filter((b) => b.status !== 'Segera Dibuka').length;
  const summary = fillTemplate(copy.labels.summary, { count: operating, cities });
  const status = selected ? getOpenStatus(selected, copy.labels, announcements) : undefined;

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
          {fillTemplate(hero.kicker, { cities })}
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
          <Button href={primary.href} external={primary.external} onClick={primary.onClick} variant="light" icon="whatsapp">
            {hero.primaryCta.label}
          </Button>
          <Button href={secondary.href} external={secondary.external} variant="ghost">
            {hero.secondaryCta.label}
          </Button>
        </div>
      </Container>

      <Container className={`${styles.meta} ${styles.anim}`} style={delay(0.55)}>
        <ul className={styles.highlights}>
          <li>
            <Icon name="pin" />
            {selected ? (
              <span>
                <strong className={styles.branchName}>{fillTemplate(copy.labels.yourBranch, { branch: selected.name })}</strong>
                {status?.label && <span className={styles.status}> · {status.label}</span>}
              </span>
            ) : (
              <span>{summary}</span>
            )}
          </li>
          <li>
            <button type="button" className={styles.pickBtn} onClick={() => openPicker()}>
              {selected ? copy.labels.changeBranch : copy.labels.pickBranch}
            </button>
          </li>
        </ul>
      </Container>
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

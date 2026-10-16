import { useCallback, useRef } from 'react';
import * as m from 'motion/react-m';
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
import { DURATION, EASE, PARALLAX, STAGGER } from '@/styles/motion';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Icon } from '@/components/ui/Icon';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { Parallax } from '@/components/motion/Parallax';
import { TextReveal } from '@/components/motion/TextReveal';
import { useIntroDone } from '@/components/motion/Preloader';
import { useSnap } from '@/components/motion/smoothScroll';
import { usePauseOffscreen } from '@/lib/usePauseOffscreen';
import styles from './Hero.module.css';

export function Hero() {
  const state = useContent(getHero);
  const zoneRef = useFabZone<HTMLElement>();
  const snapRef = useRef<HTMLElement | null>(null);
  const ref = useCallback(
    (node: HTMLElement | null) => {
      zoneRef(node);
      snapRef.current = node;
    },
    [zoneRef],
  );
  useSnap(snapRef);

  return (
    <>
      <section id="top" ref={ref} className={styles.hero} data-tone="dark" aria-labelledby="hero-title" aria-busy={state.status === 'loading'}>
        {state.status === 'success' && <HeroBody hero={state.data} />}
      </section>
      {state.status === 'success' && state.data.marquee.length > 0 && <Marquee words={state.data.marquee} />}
    </>
  );
}

function HeroBody({ hero }: { hero: HeroContent }) {
  const { branches, selected, copy, announcements, openPicker } = useBranch();
  const ctaTarget = useCtaTarget();
  const intro = useIntroDone();
  const primary = ctaTarget(hero.primaryCta);
  const secondary = ctaTarget(hero.secondaryCta);

  // Ringkasan dihitung dari data cabang, mis. "2 cabang · Bogor & Cibubur"
  const cities = joinIndonesian(operatingCities(branches));
  const operating = branches.filter((b) => b.status !== 'Segera Dibuka').length;
  const summary = fillTemplate(copy.labels.summary, { count: operating, cities });
  const status = selected ? getOpenStatus(selected, copy.labels, announcements) : undefined;

  // Judul per baris → subjudul → tombol → info cabang, berurutan setelah preloader selesai
  const titleEnd = 0.15 + hero.titleLines.length * STAGGER.line;
  const enter = (delay: number) => ({
    initial: { opacity: 0, y: 20 },
    animate: intro ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: DURATION.slow, ease: EASE.out, delay },
  });

  return (
    <>
      {/* Media & overlay ditumpuk lewat grid-area yang sama. Foto: zoom 1.1 → 1 saat dimuat + parallax ringan. */}
      <Parallax className={styles.media} innerClassName={styles.mediaMove} speed={PARALLAX.heroMedia} range="top">
        <m.div
          className={styles.mediaZoom}
          initial={{ scale: 1.1 }}
          animate={intro ? { scale: 1 } : undefined}
          transition={{ duration: DURATION.heroZoom, ease: EASE.out }}
        >
          {hero.video ? (
            <video className={styles.mediaEl} autoPlay muted loop playsInline poster={asset(hero.image.src)} aria-hidden="true">
              <source src={asset(hero.video.src)} type={hero.video.type} />
            </video>
          ) : (
            <ResponsiveImage image={hero.image} className={styles.mediaEl} priority />
          )}
        </m.div>
      </Parallax>
      <div className={styles.overlay} aria-hidden="true" />

      <Container className={styles.content}>
        <m.p className={styles.kicker} {...enter(0.05)}>
          {fillTemplate(hero.kicker, { cities })}
        </m.p>
        <TextReveal as="h1" id="hero-title" className={styles.title} lines={hero.titleLines} play={intro} delay={0.12} />
        {/* Subjudul (elemen LCP di HP) tidak di-fade: langsung terlihat, hanya bergeser naik */}
        <m.p
          className={styles.subtitle}
          initial={{ y: 20 }}
          animate={intro ? { y: 0 } : undefined}
          transition={{ duration: DURATION.slow, ease: EASE.out, delay: titleEnd }}
        >
          {hero.subtitle}
        </m.p>
        <m.div className={styles.ctas} {...enter(titleEnd + STAGGER.line)}>
          <Button href={primary.href} external={primary.external} onClick={primary.onClick} variant="light" icon="whatsapp">
            {hero.primaryCta.label}
          </Button>
          <Button href={secondary.href} external={secondary.external} variant="ghost">
            {hero.secondaryCta.label}
          </Button>
        </m.div>
      </Container>

      <Container className={styles.meta}>
        <m.ul className={styles.highlights} {...enter(titleEnd + STAGGER.line * 2)}>
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
          <li className={styles.scrollHint} aria-hidden="true">
            <span>{hero.scrollHint}</span>
            <span className={styles.scrollLine} />
          </li>
        </m.ul>
      </Container>
    </>
  );
}

function Marquee({ words }: { words: string[] }) {
  // Diduplikasi agar loop mulus; salinan kedua disembunyikan dari screen reader. Dijeda saat di luar layar.
  const ref = useRef<HTMLDivElement>(null);
  usePauseOffscreen(ref);
  return (
    <div ref={ref} className={styles.marquee} data-tone="dark" aria-hidden="true">
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

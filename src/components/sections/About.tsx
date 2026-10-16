import { useRef } from 'react';
import { useInView } from 'motion/react';
import { getAbout } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import type { AboutContent, AboutStat } from '@/types';
import { PARALLAX } from '@/styles/motion';
import { Section } from '@/components/ui/Section';
import { SectionState } from '@/components/ui/SectionState';
import { Kicker } from '@/components/ui/SectionTitle';
import { Icon } from '@/components/ui/Icon';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { CountUp } from '@/components/motion/CountUp';
import { Parallax } from '@/components/motion/Parallax';
import { Reveal } from '@/components/motion/Reveal';
import { TextReveal } from '@/components/motion/TextReveal';
import { useSnap } from '@/components/motion/smoothScroll';
import styles from './About.module.css';

/** Tentang Kami (editorial): foto portrait besar, judul besar menumpuk di atasnya, keduanya parallax beda kecepatan. */
export function About() {
  const state = useContent(getAbout);
  const ref = useRef<HTMLElement>(null);
  useSnap(ref);

  return (
    <Section id="tentang" tone="light" labelledBy="tentang-title" ref={ref}>
      <SectionState state={state} tone="light" skeletonCount={2}>
        {(about) => <AboutBody about={about} />}
      </SectionState>
    </Section>
  );
}

function AboutBody({ about }: { about: AboutContent }) {
  const figureRef = useRef<HTMLDivElement>(null);
  const inView = useInView(figureRef, { once: true, amount: 0.35 });
  let order = 0;

  return (
    <>
      <div className={styles.editorial}>
        <div className={styles.feature}>
          <div ref={figureRef} className={styles.figure}>
            <Parallax className={styles.photo} innerClassName={styles.photoMove} speed={PARALLAX.editorialPhoto}>
              <ResponsiveImage image={about.image} className={styles.img} />
            </Parallax>
            <div className={styles.shade} aria-hidden="true" />
            <Parallax className={styles.titleWrap} speed={PARALLAX.editorialTitle}>
              <Kicker>{about.heading.kicker}</Kicker>
              <TextReveal as="h2" id="tentang-title" className={styles.title} lines={[about.heading.title]} play={inView} />
            </Parallax>
          </div>
          <p className={styles.caption}>{about.imageCaption}</p>
        </div>

        <div className={styles.text}>
          <Reveal as="p" className={styles.lead} index={order++}>
            {about.lead}
          </Reveal>
          {about.body.map((p) => (
            <Reveal as="p" key={p} className={styles.body} index={order++}>
              {p}
            </Reveal>
          ))}
          {about.values.length > 0 && (
            <ul className={styles.values}>
              {about.values.map((v) => (
                <Reveal as="li" key={v.title} index={order++}>
                  <Icon name="check" strokeWidth={2} />
                  <div>
                    <strong>{v.title}</strong>
                    <span>{v.description}</span>
                  </div>
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </div>

      {about.stats.length > 0 && (
        <dl className={styles.stats}>
          {about.stats.map((stat, i) => (
            <Reveal key={stat.label} className={styles.stat} index={i}>
              <dt>{stat.label}</dt>
              <dd>
                <StatValue stat={stat} />
              </dd>
            </Reveal>
          ))}
        </dl>
      )}
    </>
  );
}

/** Angka statistik menghitung naik sekali saat terlihat (nilai final tetap untuk screen reader) */
function StatValue({ stat }: { stat: AboutStat }) {
  return (
    <CountUp
      value={stat.value}
      decimals={Number.isInteger(stat.value) ? 0 : 1}
      prefix={stat.prefix}
      suffix={stat.suffix}
      display={stat.display}
      animateValue={Boolean(stat.animate)}
    />
  );
}

import { useEffect, useRef, useState } from 'react';
import { getAbout } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { formatNumber } from '@/lib/format';
import type { AboutStat } from '@/types';
import { Section } from '@/components/ui/Section';
import { SectionState } from '@/components/ui/SectionState';
import { Kicker } from '@/components/ui/SectionTitle';
import { Reveal } from '@/components/ui/Reveal';
import { Icon } from '@/components/ui/Icon';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import styles from './About.module.css';

export function About() {
  const state = useContent(getAbout);

  return (
    <Section id="tentang" tone="light" labelledBy="tentang-title">
      <SectionState state={state} tone="light" skeletonCount={2}>
        {(about) => (
          <>
            <div className={styles.grid}>
              <Reveal as="figure" className={styles.figure}>
                <ResponsiveImage image={about.image} className={styles.img} />
                <figcaption>{about.imageCaption}</figcaption>
              </Reveal>

              <div className={styles.text}>
                <Reveal>
                  <Kicker tone="light">{about.heading.kicker}</Kicker>
                  <h2 id="tentang-title" className={styles.title}>
                    {about.heading.title}
                  </h2>
                </Reveal>
                <Reveal delay={0.05}>
                  <p className={styles.lead}>{about.lead}</p>
                  {about.body.map((p) => (
                    <p key={p} className={styles.body}>
                      {p}
                    </p>
                  ))}
                </Reveal>
                {about.values.length > 0 && (
                  <Reveal as="ul" className={styles.values} delay={0.1}>
                    {about.values.map((v) => (
                      <li key={v.title}>
                        <Icon name="check" strokeWidth={2} />
                        <div>
                          <strong>{v.title}</strong>
                          <span>{v.description}</span>
                        </div>
                      </li>
                    ))}
                  </Reveal>
                )}
              </div>
            </div>

            {about.stats.length > 0 && (
              <dl className={styles.stats}>
                {about.stats.map((stat, i) => (
                  <Reveal key={stat.label} className={styles.stat} delay={i * 0.08}>
                    <dt>{stat.label}</dt>
                    <dd>
                      <StatValue stat={stat} />
                    </dd>
                  </Reveal>
                ))}
              </dl>
            )}
          </>
        )}
      </SectionState>
    </Section>
  );
}

/** Angka berjalan saat terlihat; format ribuan id-ID. Nilai akhir selalu ada di DOM untuk aksesibilitas. */
function StatValue({ stat }: { stat: AboutStat }) {
  const final = stat.display ?? formatNumber(stat.value);
  const [text, setText] = useState(final);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!stat.animate || !el || reduce || !('IntersectionObserver' in window)) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / 1600);
          const eased = 1 - Math.pow(1 - p, 3);
          setText(formatNumber(Math.round(stat.value * eased)));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [stat.animate, stat.value]);

  const affix = (v: string) => `${stat.prefix ?? ''}${v}${stat.suffix ?? ''}`;
  // Nilai final hanya SATU kali di teks halaman (sr-only). Angka animasi digambar lewat CSS
  // (::before + data-value) dan aria-hidden, sehingga screen reader maupun alat baca halaman
  // tidak membaca "5.000+ 5.000+".
  return (
    <>
      <span className="visually-hidden">{affix(final)}</span>
      <span ref={ref} aria-hidden="true" className={styles.counter} data-value={affix(text)} />
    </>
  );
}

import { useRef, type CSSProperties } from 'react';
import { useInView } from 'motion/react';
import { getAbout } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import type { AboutContent, AboutSlide, AboutStat } from '@/types';
import { asset, assetSrcSet } from '@/lib/asset';
import { PARALLAX } from '@/styles/motion';
import { Section } from '@/components/ui/Section';
import { SectionState } from '@/components/ui/SectionState';
import { Kicker } from '@/components/ui/SectionTitle';
import { Icon } from '@/components/ui/Icon';
import { CountUp } from '@/components/motion/CountUp';
import { Parallax } from '@/components/motion/Parallax';
import { Reveal } from '@/components/motion/Reveal';
import { TextReveal } from '@/components/motion/TextReveal';
import { useSnap } from '@/components/motion/smoothScroll';
import { SLIDE_FADE_MS, useSlideshow, useSwipe } from '@/components/motion/useSlideshow';
import styles from './About.module.css';

/**
 * Tentang Kami (editorial): foto portrait besar, judul besar menumpuk di atasnya, keduanya parallax beda kecepatan.
 * Foto berupa slideshow (1–8 foto dari Pages CMS → Tentang Kami); satu foto = statis tanpa indikator.
 */
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
  const intervalMs = about.slideInterval * 1000;
  const show = useSlideshow({ count: about.slides.length, intervalMs, frameRef: figureRef });
  const swipe = useSwipe(show.prev, show.next);
  let order = 0;

  return (
    <>
      <div className={styles.editorial}>
        <div className={styles.feature}>
          <div
            ref={figureRef}
            className={styles.figure}
            data-transition={about.transition}
            data-playing={show.playing}
            style={{ '--slide-ms': `${intervalMs}ms`, '--slide-fade': `${SLIDE_FADE_MS}ms` } as CSSProperties}
            {...(show.multi
              ? { role: 'region', 'aria-roledescription': 'carousel', 'aria-label': 'Foto studio Cutless', ...show.frameHandlers, ...swipe }
              : {})}
          >
            <Parallax className={styles.photo} innerClassName={styles.photoMove} speed={PARALLAX.editorialPhoto}>
              <div className={styles.slides} aria-live={show.multi ? (show.playing ? 'off' : 'polite') : undefined}>
                {about.slides.map(
                  (slide, i) =>
                    show.mounted.has(i) && (
                      <Slide key={slide.image.src} slide={slide} index={i} total={about.slides.length} active={i === show.visible} multi={show.multi} onLoaded={show.onLoaded} />
                    ),
                )}
              </div>
            </Parallax>
            <div className={styles.shade} aria-hidden="true" />
            <Parallax className={styles.titleWrap} speed={PARALLAX.editorialTitle}>
              <Kicker>{about.heading.kicker}</Kicker>
              <TextReveal as="h2" id="tentang-title" className={styles.title} lines={[about.heading.title]} play={inView} />
            </Parallax>
            {show.multi && (
              <div className={styles.controls}>
                <div className={styles.dots} role="group" aria-label="Pilih foto">
                  {about.slides.map((slide, i) => (
                    <button
                      key={slide.image.src}
                      type="button"
                      className={styles.dot}
                      aria-label={`Foto ${i + 1} dari ${about.slides.length}: ${slide.image.alt}`}
                      aria-current={i === show.visible ? 'true' : undefined}
                      onClick={() => show.go(i)}
                    >
                      <span className={styles.track}>
                        {/* key = mulai ulang animasi progres tiap foto berganti */}
                        <span key={i === show.visible ? `run-${show.visible}` : 'idle'} className={styles.fill} />
                      </span>
                    </button>
                  ))}
                </div>
                {show.reduce ? (
                  <div className={styles.arrows}>
                    <button type="button" className={styles.ctrlBtn} aria-label="Foto sebelumnya" onClick={show.prev}>
                      <Icon name="arrow" size={18} className={styles.flip} />
                    </button>
                    <button type="button" className={styles.ctrlBtn} aria-label="Foto berikutnya" onClick={show.next}>
                      <Icon name="arrow" size={18} />
                    </button>
                  </div>
                ) : (
                  <button type="button" className={styles.ctrlBtn} aria-label={show.userPaused ? 'Putar slideshow' : 'Jeda slideshow'} aria-pressed={show.userPaused} onClick={show.togglePause}>
                    <Icon name={show.userPaused ? 'play' : 'pause'} size={16} />
                  </button>
                )}
              </div>
            )}
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
                <li key={v.title}>
                  <Icon name="check" strokeWidth={2} />
                  <div>
                    <strong>{v.title}</strong>
                    <span>{v.description}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {about.stats.length > 0 && (
        <dl className={styles.stats}>
          {about.stats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <dt>{stat.label}</dt>
              <dd>
                <StatValue stat={stat} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

/**
 * Satu foto slideshow. Ukuran intrinsik + object-fit: cover di bingkai rasio tetap → tidak ada layout shift.
 * Foto pertama lazy seperti sebelumnya; foto berikutnya baru dipasang saat dibutuhkan (lihat useSlideshow).
 */
function Slide({ slide, index, total, active, multi, onLoaded }: { slide: AboutSlide; index: number; total: number; active: boolean; multi: boolean; onLoaded: (i: number) => void }) {
  const { image } = slide;
  return (
    <div
      className={styles.slide}
      data-active={active}
      data-focus={slide.focus}
      {...(multi ? { role: 'group', 'aria-roledescription': 'slide', 'aria-label': `${index + 1} dari ${total}`, 'aria-hidden': !active } : {})}
    >
      <img
        className={styles.img}
        src={asset(image.src)}
        srcSet={assetSrcSet(image.srcSet)}
        sizes={image.sizes}
        width={image.width}
        height={image.height}
        alt={image.alt}
        loading={index === 0 ? 'lazy' : 'eager'}
        decoding="async"
        onLoad={() => onLoaded(index)}
        // Gambar dari cache bisa selesai sebelum onLoad terpasang
        ref={(el) => {
          if (el?.complete && el.naturalWidth) onLoaded(index);
        }}
      />
    </div>
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

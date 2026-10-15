import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { getGallery } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useSite } from '@/lib/SiteContext';
import { asset } from '@/lib/asset';
import { fillTemplate } from '@/lib/whatsapp';
import type { BeforeAfter as BeforeAfterItem, GalleryItem, SocialLink } from '@/types';
import { Section } from '@/components/ui/Section';
import { SectionState } from '@/components/ui/SectionState';
import { SectionTitle, Kicker } from '@/components/ui/SectionTitle';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import styles from './Gallery.module.css';

export function Gallery() {
  const state = useContent(getGallery);
  const { socials } = useSite();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const instagram = socials.find((s) => s.platform === 'instagram');
  const tiktok = socials.find((s) => s.platform === 'tiktok');
  const socialButtons = [instagram, tiktok].filter((s): s is SocialLink => Boolean(s));

  return (
    <Section id="galeri" tone="light" labelledBy="galeri-title">
      <SectionState state={state} tone="light" isEmpty={(d) => d.items.length === 0 && d.beforeAfter.length === 0} skeletonCount={4}>
        {(data) => (
          <>
            <SectionTitle
              heading={data.heading}
              id="galeri-title"
              tone="light"
              aside={
                socialButtons.length > 0 && (
                  <div className={styles.socialRow}>
                    {socialButtons.map((s) => (
                      <a key={s.platform} className={styles.handle} href={s.url} target="_blank" rel="noopener noreferrer">
                        <Icon name={s.platform} size={18} />
                        {s.handle}
                        <span className="visually-hidden"> ({s.label})</span>
                      </a>
                    ))}
                  </div>
                )
              }
            />

            {data.items.length > 0 && (
              <div className={styles.gridWrap}>
                <ul className={styles.grid}>
                  {data.items.map((item, i) => (
                    <li key={item.id} className={styles[item.layout]}>
                      <button type="button" className={styles.tile} onClick={() => setOpenIndex(i)} aria-haspopup="dialog">
                        <ResponsiveImage image={item.image} className={styles.tileImg} />
                        <span className="visually-hidden">{item.caption ?? item.image.alt}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.beforeAfter.map((ba) => (
              <div key={ba.id} className={styles.baRow}>
                <Reveal>
                  <BeforeAfter item={ba} />
                </Reveal>
                <Reveal className={styles.baText} delay={0.08}>
                  <Kicker tone="light">{ba.kicker}</Kicker>
                  <h3>{ba.title}</h3>
                  <p>{ba.description}</p>
                  {socialButtons.length > 0 && (
                    <div className={styles.socialCtas}>
                      {socialButtons.map((s, idx) => (
                        <Button key={s.platform} href={s.url} external variant={idx === 0 ? 'dark' : 'outline-dark'} icon={s.platform}>
                          {s.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </Reveal>
              </div>
            ))}

            {openIndex !== null && (
              <Lightbox items={data.items} index={openIndex} onIndexChange={setOpenIndex} onClose={() => setOpenIndex(null)} />
            )}
          </>
        )}
      </SectionState>
    </Section>
  );
}

/* ---------- Before / After ---------- */
function BeforeAfter({ item }: { item: BeforeAfterItem }) {
  const [pos, setPos] = useState(50);
  return (
    <div className={styles.ba} style={{ '--pos': `${pos}%`, aspectRatio: `${item.after.width} / ${item.after.height}` } as CSSProperties}>
      <ResponsiveImage image={item.after} className={styles.baImg} />
      <div className={styles.baBefore}>
        <ResponsiveImage image={item.before} className={styles.baImg} />
      </div>
      <span className={`${styles.baLabel} ${styles.baLabelBefore}`}>{item.beforeLabel}</span>
      <span className={`${styles.baLabel} ${styles.baLabelAfter}`}>{item.afterLabel}</span>
      <span className={styles.baHandle} aria-hidden="true">
        <span className={styles.baKnob}>
          <Icon name="chevron-left" size={14} strokeWidth={2} />
          <Icon name="chevron-right" size={14} strokeWidth={2} />
        </span>
      </span>
      <input
        className={styles.baRange}
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={item.sliderLabel}
        aria-valuetext={`${pos}%`}
      />
    </div>
  );
}

/* ---------- Lightbox (native <dialog>: fokus, Esc, dan top-layer ditangani browser) ---------- */
interface LightboxProps {
  items: GalleryItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}

function Lightbox({ items, index, onIndexChange, onClose }: LightboxProps) {
  const { site } = useSite();
  const ref = useRef<HTMLDialogElement>(null);
  const item = items[index];
  const total = items.length;

  const go = useCallback((delta: number) => onIndexChange((index + delta + total) % total), [index, total, onIndexChange]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const trigger = document.activeElement as HTMLElement | null;
    return () => trigger?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go]);

  return (
    <dialog
      ref={ref}
      className={styles.lightbox}
      aria-label={item.caption ?? item.image.alt}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <div className={styles.lbInner}>
        <div className={styles.lbBar}>
          <span>{fillTemplate(site.ui.counter, { current: index + 1, total })}</span>
          <button type="button" className={styles.lbBtn} onClick={() => ref.current?.close()} aria-label={site.ui.close}>
            <Icon name="close" size={22} />
          </button>
        </div>
        <figure className={styles.lbFigure}>
          <img src={asset(item.fullSrc ?? item.image.src)} alt={item.image.alt} width={item.image.width} height={item.image.height} />
          {item.caption && <figcaption>{item.caption}</figcaption>}
        </figure>
        {total > 1 && (
          <div className={styles.lbNav}>
            <button type="button" className={styles.lbBtn} onClick={() => go(-1)} aria-label={site.ui.previous}>
              <Icon name="chevron-left" size={22} />
            </button>
            <button type="button" className={styles.lbBtn} onClick={() => go(1)} aria-label={site.ui.next}>
              <Icon name="chevron-right" size={22} />
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}

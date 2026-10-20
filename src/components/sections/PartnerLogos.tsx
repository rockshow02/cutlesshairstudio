import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'motion/react';
import { getPartnerLogos } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { usePageHidden } from '@/lib/usePageHidden';
import { asset } from '@/lib/asset';
import type { ImageAsset, PartnerLogo, PartnerLogosContent } from '@/types';
import { Marquee } from '@/components/motion/Marquee';
import styles from './PartnerLogos.module.css';

/**
 * Kecepatan pita = pita teks hero ("ON POINT ALWAYS · …", 32 detik per putaran): diukur dalam em per detik agar
 * sama di semua lebar layar (ukuran huruf pita memakai clamp yang sama). Lihat Hero.module.css → .track.
 */
const EM_PER_SECOND = 1.35;

/**
 * Pita logo partner di beranda, tepat sebelum CTA penutup (Pages CMS → Logo Partner). Gaya = pita teks hero.
 * Tidak dirender bila dimatikan / belum ada logo aktif. 1–2 logo: deret statis di tengah. 3+: berjalan, berhenti saat
 * di-hover, di luar layar, atau tab tidak aktif. "Kurangi gerakan": deret statis yang bisa digeser horizontal.
 */
export function PartnerLogos() {
  const state = useContent(getPartnerLogos);
  return state.status === 'success' ? <PartnerStrip data={state.data} /> : null;
}

/** null (dimatikan / tanpa logo aktif) → tidak ada elemen sama sekali */
export function PartnerStrip({ data }: { data: PartnerLogosContent | null }) {
  const reduce = useReducedMotion();
  if (!data) return null;
  const animated = data.animated && !reduce;
  return (
    <section className={styles.section} aria-label={data.ariaLabel} data-tone="dark" data-partner-strip={animated ? 'marquee' : 'static'}>
      {data.label && <p className={styles.label}>{data.label}</p>}
      {animated ? <Loop items={data.items} /> : <StaticRow items={data.items} />}
    </section>
  );
}

function StaticRow({ items }: { items: PartnerLogo[] }) {
  return (
    <div className={`${styles.band} ${styles.static}`}>
      <ul className={styles.set}>
        {items.map((p) => (
          <li key={p.name} className={styles.cell}>
            <Item partner={p} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ulangi urutan logo seperlunya agar satu salinan selebar layar (putaran mulus tanpa celah) */
function Loop({ items }: { items: PartnerLogo[] }) {
  const pageHidden = usePageHidden();
  const setRef = useRef<HTMLUListElement>(null);
  const [repeat, setRepeat] = useState(Math.max(1, Math.ceil(6 / items.length)));
  const [duration, setDuration] = useState(32);

  useEffect(() => {
    const set = setRef.current;
    const band = set?.closest<HTMLElement>(`.${styles.band}`);
    if (!set || !band || !('ResizeObserver' in window)) return;
    const measure = () => {
      const one = set.scrollWidth / repeat;
      if (!one) return;
      const next = Math.max(1, Math.ceil(band.clientWidth / one));
      if (next !== repeat) setRepeat(next);
      const em = parseFloat(getComputedStyle(set).fontSize) || 16;
      setDuration(Math.max(8, (one * next) / em / EM_PER_SECOND));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(band);
    ro.observe(set);
    return () => ro.disconnect();
  }, [repeat, items.length]);

  const copies = Array.from({ length: repeat }, (_, r) => r);
  return (
    <Marquee className={styles.band} direction="left" duration={duration} paused={pageHidden}>
      <ul ref={setRef} className={styles.set}>
        {copies.flatMap((r) =>
          items.map((p, i) => (
            // Salinan tambahan disembunyikan dari screen reader & keyboard (urutan asli dibaca sekali)
            <li key={`${r}-${i}`} className={styles.cell} aria-hidden={r > 0 || undefined} {...(r > 0 ? { inert: '' } : {})}>
              <Item partner={p} />
            </li>
          )),
        )}
      </ul>
    </Marquee>
  );
}

function Item({ partner }: { partner: PartnerLogo }) {
  const content = partner.logo ? <LogoMark image={partner.logo} /> : <span className={styles.name}>{partner.name}</span>;
  if (!partner.url) return <span className={styles.item}>{content}</span>;
  return (
    <a className={styles.item} href={partner.url} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  );
}

/**
 * Logo satu warna (senada teks outline) lewat CSS mask; warna asli tampil saat hover (desktop).
 * <img> tetap ada (alt = nama partner, lazy-load, lebar/tinggi asli → tanpa layout shift).
 */
function LogoMark({ image }: { image: ImageAsset }) {
  const [ready, setReady] = useState<string | null>(null);
  const src = asset(image.src);
  return (
    <span className={styles.logo} data-ready={ready ? '' : undefined} style={ready ? ({ '--logo': `url("${ready}")` } as CSSProperties) : undefined}>
      <img
        src={src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading="lazy"
        decoding="async"
        onLoad={(e) => setReady(e.currentTarget.currentSrc || src)}
      />
    </span>
  );
}

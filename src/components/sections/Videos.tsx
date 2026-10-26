import { useEffect, useRef, useState } from 'react';
import { getVideos } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { fillTemplate } from '@/lib/whatsapp';
import { processInstagramEmbeds } from '@/lib/instagramEmbed';
import type { VideosContent } from '@/types';
import { Section } from '@/components/ui/Section';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { Icon } from '@/components/ui/Icon';
import styles from './Videos.module.css';

/**
 * Bagian Video beranda (Pages CMS → Video), setelah Galeri. Kartu 9:16 berisi foto sampul + tombol putar (facade):
 * skrip embed Instagram baru dimuat saat kartu ditekan, lalu embed menggantikan isi kartu itu di bingkai yang sama
 * (ukuran tetap → tanpa layout shift). Link "Tonton di Instagram" selalu ada sebagai cadangan bila embed diblokir.
 * Tidak dirender bila Tampilkan bagian Video mati atau belum ada video aktif.
 */
export function Videos() {
  const state = useContent(getVideos);
  if (state.status !== 'success' || !state.data) return null;
  return <VideosView data={state.data} />;
}

export function VideosView({ data }: { data: VideosContent }) {
  return (
    <Section id="video" tone="dark" labelledBy="video-title">
      <SectionTitle heading={data.heading} id="video-title" />
      <ul className={styles.list} role="list">
        {data.items.map((video, index) => (
          <li key={video.id} className={styles.item}>
            <VideoCard video={video} label={video.caption ?? fillTemplate(data.copy.untitled, { n: index + 1 })} copy={data.copy} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

type Status = 'idle' | 'loading' | 'ready' | 'failed';

function VideoCard({ video, label, copy }: { video: VideosContent['items'][number]; label: string; copy: VideosContent['copy'] }) {
  const [status, setStatus] = useState<Status>('idle');
  const frameRef = useRef<HTMLDivElement>(null);
  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== 'loading' || !embedRef.current) return;
    // Blockquote dibuat di luar React: embed.js menggantinya dengan iframe (React tidak menyentuh isinya lagi)
    const quote = document.createElement('blockquote');
    quote.className = 'instagram-media';
    quote.dataset.instgrmPermalink = video.url;
    quote.dataset.instgrmVersion = '14';
    const link = document.createElement('a');
    link.href = video.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = copy.loading;
    quote.appendChild(link);
    embedRef.current.replaceChildren(quote);
    frameRef.current?.focus();
    let cancelled = false;
    processInstagramEmbeds().then(
      () => !cancelled && setStatus('ready'),
      () => !cancelled && setStatus('failed'),
    );
    return () => {
      cancelled = true;
    };
  }, [status, video.url, copy.loading]);

  return (
    <figure className={styles.card}>
      <div
        ref={frameRef}
        className={styles.frame}
        data-status={status}
        tabIndex={status === 'idle' ? undefined : -1}
        role={status === 'idle' ? undefined : 'region'}
        aria-label={status === 'idle' ? undefined : label}
        aria-busy={status === 'loading' || undefined}
        // Embed lebih tinggi dari bingkai digulir di dalam bingkai (Lenis tidak mengambil alih scroll-nya)
        data-lenis-prevent={status === 'idle' ? undefined : ''}
      >
        {status === 'idle' ? (
          <button type="button" className={styles.facade} onClick={() => setStatus('loading')} aria-label={fillTemplate(copy.playLabel, { caption: label })}>
            <ResponsiveImage image={video.image} className={styles.cover} alt="" />
            <span className={styles.play} aria-hidden="true">
              <Icon name="play" size={26} />
            </span>
          </button>
        ) : (
          <>
            <div ref={embedRef} className={styles.embed} />
            {status === 'failed' && (
              <p className={styles.failed} role="status">
                {copy.failed}
              </p>
            )}
          </>
        )}
      </div>
      <figcaption className={styles.meta}>
        {video.caption && <p className={styles.caption}>{video.caption}</p>}
        <a className={styles.watch} href={video.url} target="_blank" rel="noopener noreferrer">
          <Icon name="instagram" size={16} />
          {copy.watchOnInstagram}
          <span className="visually-hidden"> ({label})</span>
        </a>
      </figcaption>
    </figure>
  );
}

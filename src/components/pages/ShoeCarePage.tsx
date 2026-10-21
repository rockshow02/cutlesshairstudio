import { useState } from 'react';
import { getShoeCare } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useBranch } from '@/lib/BranchContext';
import { useFabZone } from '@/lib/fabZones';
import { pageUrl } from '@/lib/navigation';
import { formatTime } from '@/lib/format';
import { fillTemplate } from '@/lib/whatsapp';
import { shoeCarePlacement } from '@/lib/contentTransforms';
import type { Branch, ShoeCareContent } from '@/types';
import { Section } from '@/components/ui/Section';
import { SectionTitle, Kicker } from '@/components/ui/SectionTitle';
import { Container } from '@/components/ui/Container';
import { Card, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { Lightbox } from '@/components/ui/Lightbox';
import styles from './ShoeCarePage.module.css';

/**
 * Halaman /cuci-sepatu/ (Pages CMS → Partner Cuci Sepatu): hero foto, About Us, layanan (tanpa harga), galeri +
 * lightbox, catatan & CTA WhatsApp, lokasi cabang. Semua tombol WhatsApp ke nomor partner (kosong → nomor cabang partner).
 * Halaman mati → di produksi /cuci-sepatu dialihkan ke beranda (301); di sini tampil pemberitahuan singkat.
 */
export function ShoeCarePage() {
  const state = useContent(getShoeCare);
  const { branches, selected } = useBranch();
  if (state.status === 'loading') return <main aria-busy="true" />;
  const data = state.status === 'success' ? state.data : null;
  if (!data) {
    return (
      <Section id="cuci-sepatu" tone="dark" className={styles.missing}>
        <h1 className={styles.missingTitle}>Halaman cuci sepatu belum tersedia.</h1>
        <Button href={pageUrl('/')} variant="light" iconEnd="arrow">
          Kembali ke beranda
        </Button>
      </Section>
    );
  }
  const branch = branches.find((b) => b.slug === data.branch.slug);
  const otherBranch = shoeCarePlacement(data.branch.slug, { selectedSlug: selected?.slug }) === 'other-branch';
  return <ShoeCarePageView data={data} branch={branch} otherBranch={otherBranch} />;
}

export function ShoeCarePageView({ data, branch, otherBranch }: { data: ShoeCareContent; branch?: Branch; otherBranch: boolean }) {
  return (
    <>
      <Hero data={data} otherBranch={otherBranch} />
      <About data={data} />
      <Services data={data} />
      {data.photos.length > 0 && <Gallery data={data} />}
      <Closing data={data} />
      {branch && <Location data={data} branch={branch} />}
    </>
  );
}

/** Tombol "Lihat Daftar Menu": tab baru; tidak dirender bila link kosong */
export function MenuButton({ data, variant }: { data: ShoeCareContent; variant: 'ghost' | 'outline-dark' | 'light' }) {
  if (!data.menuUrl) return null;
  return (
    <Button href={data.menuUrl} external variant={variant} icon="tag" size="lg">
      {data.copy.menuLabel}
    </Button>
  );
}

function Hero({ data, otherBranch }: { data: ShoeCareContent; otherBranch: boolean }) {
  const { copy } = data;
  const zoneRef = useFabZone<HTMLElement>();
  return (
    <section ref={zoneRef} id="top" className={styles.hero} aria-labelledby="cuci-sepatu-title" data-tone="dark">
      <ResponsiveImage image={data.heroImage} className={styles.heroBg} alt="" priority />
      <div className={styles.heroShade} aria-hidden="true" />
      <Container className={styles.heroInner}>
        {data.logo && <ResponsiveImage image={data.logo} className={styles.heroLogo} priority />}
        <Kicker>{copy.kicker}</Kicker>
        <h1 id="cuci-sepatu-title" className={styles.heroTitle}>
          {data.name}
        </h1>
        {data.tagline && <p className={styles.heroTagline}>{data.tagline}</p>}
        {data.description && <p className={styles.heroText}>{data.description}</p>}
        <p className={styles.heroMeta}>
          <span className={styles.available}>
            <Icon name="pin" size={14} />
            {copy.availableAt} {data.branch.name}
          </span>
          <DemoBadge show={data.isDemo} />
        </p>
        {otherBranch && (
          <p className={styles.notice} role="note">
            <Icon name="info" size={18} />
            <span>
              {copy.onlyAt} <strong>{data.branch.name}</strong>.
            </span>
          </p>
        )}
        <div className={styles.heroActions}>
          <Button href={data.mainHref} external variant="whatsapp" size="lg" icon="whatsapp">
            {copy.mainLabel}
          </Button>
          <MenuButton data={data} variant="ghost" />
        </div>
      </Container>
    </section>
  );
}

function About({ data }: { data: ShoeCareContent }) {
  const { about } = data;
  return (
    <Section id="tentang" tone="light" labelledBy="cuci-sepatu-about">
      <div className={`${styles.about} ${about.image ? styles.aboutWithImage : ''}`}>
        <div>
          <SectionTitle heading={about.heading} id="cuci-sepatu-about" tone="light" />
          <div className={styles.paragraphs}>
            {about.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          {data.advantages.length > 0 && (
            <ul className={styles.advantages} role="list">
              {data.advantages.map((a) => (
                <li key={a.title} className={styles.advantage}>
                  <span className={styles.advIcon}>
                    <Icon name={a.icon} size={20} />
                  </span>
                  <span>
                    <strong className={styles.advTitle}>{a.title}</strong>
                    <span className={styles.advText}>{a.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {about.image && (
          <div className={styles.aboutMedia}>
            <ResponsiveImage image={about.image} className={styles.aboutImg} />
          </div>
        )}
      </div>
    </Section>
  );
}

function Services({ data }: { data: ShoeCareContent }) {
  const { copy } = data;
  // Tombol WA melayang disembunyikan selama daftar layanan terlihat (tidak menutupi tombol pesan)
  const zoneRef = useFabZone<HTMLDivElement>(0.05);
  return (
    <Section id="layanan" tone="dark" labelledBy="cuci-sepatu-layanan">
      <div ref={zoneRef}>
        <SectionTitle heading={{ kicker: copy.servicesKicker, title: copy.servicesTitle }} id="cuci-sepatu-layanan" />
        <ul className={styles.services} role="list">
          {data.services.map((s) => (
            <li key={s.name}>
              <Card tone="dark" as="article" className={styles.service}>
                {s.image ? (
                  <ResponsiveImage image={s.image} className={styles.serviceImg} />
                ) : (
                  s.icon && (
                    <span className={styles.serviceIcon}>
                      <Icon name={s.icon} size={28} strokeWidth={1.4} />
                    </span>
                  )
                )}
                <h3 className={styles.serviceName}>{s.name}</h3>
                {s.description && <p className={styles.serviceText}>{s.description}</p>}
                {s.estimate && (
                  <p className={styles.estimate}>
                    <Icon name="clock" size={14} />
                    <span className="visually-hidden">{copy.estimateLabel}: </span>
                    {s.estimate}
                  </p>
                )}
                <CardFooter>
                  <Button href={s.href} external variant="ghost" icon="whatsapp" block aria-label={`${copy.orderLabel}: ${s.name}`}>
                    {copy.orderLabel}
                  </Button>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
        {data.menuUrl && (
          <div className={styles.servicesMenu}>
            <MenuButton data={data} variant="light" />
          </div>
        )}
      </div>
    </Section>
  );
}

function Gallery({ data }: { data: ShoeCareContent }) {
  const { copy } = data;
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Section id="galeri" tone="light" labelledBy="cuci-sepatu-galeri">
      <SectionTitle heading={{ kicker: copy.galleryKicker, title: copy.galleryTitle }} id="cuci-sepatu-galeri" tone="light" />
      <ul className={styles.gallery} role="list">
        {data.photos.map((ph, i) => (
          <li key={`${ph.src}-${i}`}>
            <button type="button" className={styles.photo} onClick={() => setOpen(i)} aria-label={`${copy.lightbox.open}: ${ph.alt}`}>
              <ResponsiveImage image={ph} className={styles.photoImg} />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <Lightbox images={data.photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} labels={copy.lightbox} />}
    </Section>
  );
}

function Closing({ data }: { data: ShoeCareContent }) {
  const { copy } = data;
  const zoneRef = useFabZone<HTMLDivElement>(0.1);
  return (
    <Section id="titip" tone="dark" labelledBy="cuci-sepatu-titip">
      <div ref={zoneRef} className={styles.closing}>
        {data.notes.length > 0 && (
          <div className={styles.notes}>
            <h2 className={styles.notesTitle}>{copy.notesTitle}</h2>
            <ul>
              {data.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}
        <div className={styles.cta}>
          <Kicker center>{copy.closingKicker}</Kicker>
          <h2 id="cuci-sepatu-titip" className={styles.ctaTitle}>
            {copy.closingTitle}
          </h2>
          <p className={styles.ctaText}>{fillTemplate(copy.closingText, { branch: data.branch.name })}</p>
          <div className={styles.ctaActions}>
            <Button href={data.mainHref} external variant="whatsapp" size="lg" icon="whatsapp">
              {copy.mainLabel}
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Location({ data, branch }: { data: ShoeCareContent; branch: Branch }) {
  const { copy } = data;
  return (
    <Section id="lokasi" tone="light" labelledBy="cuci-sepatu-lokasi">
      <SectionTitle heading={{ kicker: copy.locationKicker, title: `Cutless ${branch.name}` }} id="cuci-sepatu-lokasi" tone="light" />
      <div className={styles.location}>
        <div>
          {branch.address && (
            <p className={styles.address}>
              <Icon name="pin" size={18} />
              <span>{branch.address}</span>
            </p>
          )}
          <Button href={branch.directionsUrl} external variant="outline-dark" icon="navigate">
            {copy.directions}
          </Button>
        </div>
        {branch.hours.length > 0 && (
          <table className={styles.hours}>
            <caption>{copy.hoursTitle}</caption>
            <tbody>
              {branch.hours.map((h) => (
                <tr key={h.day}>
                  <th scope="row">{h.label}</th>
                  <td>{h.closed || !h.open || !h.close ? copy.closed : `${formatTime(h.open)} – ${formatTime(h.close)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Section>
  );
}

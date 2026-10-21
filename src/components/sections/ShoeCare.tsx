import { getShoeCare } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useBranch } from '@/lib/BranchContext';
import { useFabZone } from '@/lib/fabZones';
import { shoeCarePlacement } from '@/lib/contentTransforms';
import type { ShoeCareContent } from '@/types';
import { Section } from '@/components/ui/Section';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Card, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import styles from './ShoeCare.module.css';

/**
 * Partner Cuci Sepatu (#cuci-sepatu), setelah Daftar Harga. Hanya untuk satu cabang (Pages CMS → Partner Cuci Sepatu):
 * tampil di beranda & halaman cabang itu; tidak tampil di halaman cabang lain. Bila pengunjung memilih cabang lain,
 * tampil dengan catatan dan tombol WhatsApp tetap ke nomor partner / cabang partner.
 */
export function ShoeCare() {
  const state = useContent(getShoeCare);
  const { pageBranch, selected } = useBranch();
  if (state.status !== 'success' || !state.data) return null;
  const placement = shoeCarePlacement(state.data.branch.slug, { pageSlug: pageBranch?.slug, selectedSlug: selected?.slug });
  if (placement === 'hidden') return null;
  return <ShoeCareView data={state.data} otherBranch={placement === 'other-branch'} />;
}

export function ShoeCareView({ data, otherBranch }: { data: ShoeCareContent; otherBranch: boolean }) {
  const { copy } = data;
  // Tombol WhatsApp melayang disembunyikan selama section terlihat (tidak menutupi tombol pesan)
  const zoneRef = useFabZone<HTMLDivElement>(0.05);
  return (
    <Section id={data.id} tone="light" surface="warm" labelledBy="cuci-sepatu-title">
      {/* Pita di garis batas atas: section partner, terpisah dari Daftar Harga */}
      <p className={styles.ribbon}>
        <Icon name="star" size={12} />
        {copy.ribbon}
      </p>
      <div ref={zoneRef}>
        <SectionTitle
          heading={data.heading}
          id="cuci-sepatu-title"
          tone="light"
          aside={
            <>
              {data.description && <p className={styles.description}>{data.description}</p>}
              <div className={styles.meta}>
                {data.logo && <ResponsiveImage image={data.logo} className={styles.logo} />}
                <span className={styles.available}>
                  <Icon name="pin" size={14} />
                  {copy.availableAt} {data.branch.name}
                </span>
              </div>
            </>
          }
        />

        {otherBranch && (
          <p className={styles.notice} role="note">
            <Icon name="info" size={18} />
            <span>
              {copy.onlyAt} <strong>{data.branch.name}</strong>.
            </span>
          </p>
        )}

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

        <h3 className={styles.subTitle}>{copy.servicesTitle}</h3>
        <ul className={styles.services} role="list">
          {data.services.map((s) => (
            <li key={s.name}>
              <Card tone="light" as="article" className={styles.service}>
                <h4 className={styles.serviceName}>{s.name}</h4>
                {s.description && <p className={styles.serviceText}>{s.description}</p>}
                <p className={styles.price}>{s.price}</p>
                {s.estimate && (
                  <p className={styles.estimate}>
                    <Icon name="clock" size={14} />
                    <span className="visually-hidden">{copy.estimateLabel}: </span>
                    {s.estimate}
                  </p>
                )}
                <CardFooter>
                  <Button href={s.href} external variant="outline-dark" icon="whatsapp" block aria-label={`${copy.orderLabel}: ${s.name}`}>
                    {copy.orderLabel}
                  </Button>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>

        {data.photos.length > 0 && (
          <>
            <h3 className={styles.subTitle}>{copy.galleryTitle}</h3>
            <ul className={styles.gallery} role="list">
              {data.photos.map((ph, i) => (
                <li key={`${ph.src}-${i}`} className={styles.photo}>
                  <ResponsiveImage image={ph} className={styles.photoImg} />
                </li>
              ))}
            </ul>
          </>
        )}

        {data.notes.length > 0 && (
          <div className={styles.notes}>
            <h3 className={styles.notesTitle}>{copy.notesTitle}</h3>
            <ul role="list">
              {data.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.main}>
          <Button href={data.mainHref} external variant="whatsapp" size="lg" icon="whatsapp">
            {copy.mainLabel}
          </Button>
        </div>
      </div>
    </Section>
  );
}

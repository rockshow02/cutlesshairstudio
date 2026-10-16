import { Swiper, SwiperSlide } from 'swiper/react';
import { A11y, Autoplay, Keyboard, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import { getTestimonials } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useSite } from '@/lib/SiteContext';
import type { RatingSummary, Testimonial } from '@/types';
import { Section } from '@/components/ui/Section';
import { SectionState } from '@/components/ui/SectionState';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Stars } from '@/components/ui/Stars';
import { CountUp } from '@/components/motion/CountUp';
import { Reveal } from '@/components/motion/Reveal';
import styles from './Testimonials.module.css';

const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Testimonials() {
  const state = useContent(getTestimonials);
  const { site } = useSite();
  // Section bisa dimatikan dari Pengaturan Situs (mis. belum ada ulasan asli)
  if (!site.features.testimonials) return null;
  const hasSummary = (d: { summary: RatingSummary }) => Boolean(d.summary.ratingDisplay || d.summary.reviewCountLabel);

  return (
    <Section id="testimoni" tone="dark" labelledBy="testimoni-title">
      <SectionState state={state} isEmpty={(d) => d.items.length === 0} skeletonCount={3}>
        {(data) => (
          <>
            <SectionTitle heading={data.heading} id="testimoni-title" aside={hasSummary(data) ? <Summary summary={data.summary} /> : undefined} />
            <Swiper
              className={styles.swiper}
              modules={[A11y, Autoplay, Keyboard, Pagination]}
              slidesPerView={1.08}
              spaceBetween={16}
              breakpoints={{
                768: { slidesPerView: 2, spaceBetween: 20 },
                1024: { slidesPerView: 3, spaceBetween: 24 },
              }}
              rewind
              keyboard={{ enabled: true, onlyInViewport: true }}
              pagination={{ clickable: true }}
              autoplay={reduceMotion ? false : { delay: 5500, pauseOnMouseEnter: true, disableOnInteraction: true }}
              a11y={{
                prevSlideMessage: site.ui.previous,
                nextSlideMessage: site.ui.next,
                paginationBulletMessage: site.ui.goToSlide,
              }}
            >
              {data.items.map((review, i) => (
                <SwiperSlide key={review.id} className={styles.slide}>
                  {/* Kartu muncul bertahap (3 pertama yang terlihat) */}
                  <Reveal index={i % 3} className={styles.reveal}>
                    <ReviewCard review={review} />
                  </Reveal>
                </SwiperSlide>
              ))}
            </Swiper>
            {data.summary.url && (
              <div className={styles.cta}>
                <Button href={data.summary.url} external variant="ghost" icon="google">
                  {data.summary.ctaLabel}
                </Button>
              </div>
            )}
          </>
        )}
      </SectionState>
    </Section>
  );
}

function Summary({ summary }: { summary: RatingSummary }) {
  return (
    <div className={styles.summary}>
      <Icon name="google" size={30} className={styles.gLogo} />
      <div className={styles.summaryText}>
        {summary.ratingDisplay && summary.rating && (
          <p className={styles.summaryTop}>
            <strong>
              <CountUp value={summary.rating} decimals={Number.isInteger(summary.rating) ? 0 : 1} display={summary.ratingDisplay} />
            </strong>
            <Stars rating={summary.rating} label={`${summary.ratingDisplay} / 5`} />
          </p>
        )}
        {summary.reviewCountLabel && <p className={styles.summaryCount}>{summary.reviewCountLabel}</p>}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Testimonial }) {
  return (
    <Card className={styles.card}>
      <header className={styles.head}>
        <span className={styles.avatar} style={{ background: review.avatarColor }} aria-hidden="true">
          {review.author.charAt(0)}
        </span>
        <div className={styles.who}>
          <h3>{review.author}</h3>
          <p>{[review.source, review.relativeTime].filter(Boolean).join(' · ')}</p>
        </div>
        {review.source === 'Google' && <Icon name="google" size={18} className={styles.source} />}
      </header>
      <Stars rating={review.rating} label={`${review.rating} / 5`} />
      <blockquote className={styles.text}>
        <p>{review.text}</p>
      </blockquote>
    </Card>
  );
}

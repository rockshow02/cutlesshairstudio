import { getFaq } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import type { FaqContent } from '@/types';
import { Section } from '@/components/ui/Section';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Icon } from '@/components/ui/Icon';
import styles from './Faq.module.css';

/**
 * Bagian FAQ beranda (Pages CMS → FAQ), sebelum Lokasi. Akordeon <details>/<summary> bawaan browser: bisa dibuka
 * dengan keyboard & pembaca layar, dan jawaban selalu ada di DOM (juga di HTML statis hasil build). Tidak dirender bila
 * Tampilkan FAQ mati atau belum ada item aktif berjawaban.
 */
export function Faq() {
  const state = useContent(getFaq);
  if (state.status !== 'success' || !state.data) return null;
  return <FaqView data={state.data} />;
}

export function FaqView({ data }: { data: FaqContent }) {
  return (
    <Section id="faq" tone="dark" labelledBy="faq-title">
      <SectionTitle heading={{ ...data.heading, kicker: data.heading.kicker || 'FAQ' }} id="faq-title" />
      <div className={styles.list}>
        {data.items.map((item) => (
          <details key={item.id} className={styles.item}>
            <summary className={styles.question}>
              <span>{item.question}</span>
              <Icon name="plus" size={20} className={styles.icon} />
            </summary>
            <p className={styles.answer}>{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

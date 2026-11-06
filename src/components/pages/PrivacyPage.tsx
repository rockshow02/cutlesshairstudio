import { useSite } from '@/lib/SiteContext';
import { useBranch } from '@/lib/BranchContext';
import { PRIVACY_EFFECTIVE, PRIVACY_LABEL, privacySections } from '@/content/privacyPolicy';
import { Section } from '@/components/ui/Section';
import styles from './PrivacyPage.module.css';

/** Halaman /kebijakan-privasi/: teks dari src/content/privacyPolicy.ts; nama, cabang, WhatsApp & email dari konten situs */
export function PrivacyPage() {
  const { site } = useSite();
  const { branches } = useBranch();
  const sections = privacySections({
    brand: site.brandName,
    branches: branches.filter((b) => b.status !== 'Segera Dibuka').map((b) => b.name),
    whatsapp: site.whatsapp.displayNumber,
    email: site.email,
  });
  return (
    <Section id="kebijakan-privasi" tone="dark" labelledBy="privasi-judul" className={styles.page}>
      <article className={styles.article}>
        <h1 id="privasi-judul" className={styles.title}>
          {PRIVACY_LABEL}
        </h1>
        <p className={styles.date}>Berlaku sejak {PRIVACY_EFFECTIVE.label}</p>
        {sections.map((s) => (
          <section key={s.id} aria-labelledby={`privasi-${s.id}`} className={styles.block}>
            <h2 id={`privasi-${s.id}`}>{s.heading}</h2>
            {s.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {s.items && (
              <ul>
                {s.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>
    </Section>
  );
}

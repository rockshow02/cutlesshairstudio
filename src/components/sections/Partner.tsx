import { useId, useState, type FormEvent } from 'react';
import { getPartnerPage } from '@/lib/content';
import { useContent } from '@/lib/useContent';
import { useFabZone } from '@/lib/fabZones';
import {
  EMPTY_PARTNER_FORM,
  PARTNER_IDS,
  PARTNER_LIMITS,
  partnerFormLink,
  validatePartnerForm,
  type PartnerFormErrors,
  type PartnerFormValues,
} from '@/lib/partner';
import type { PartnerPageContent, PartnerTarget } from '@/types';
import { Section } from '@/components/ui/Section';
import { SectionState } from '@/components/ui/SectionState';
import { SectionTitle, Kicker } from '@/components/ui/SectionTitle';
import { Card, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Icon } from '@/components/ui/Icon';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import styles from './Partner.module.css';

/**
 * Halaman /partner/: kemitraan cabang, brand & kolaborasi, korporat & event. Konten dari Pages CMS
 * (Halaman Partner); section yang dimatikan bernilai null dan tidak dirender, begitu juga link ke sana.
 * Form hanya membuka WhatsApp pengunjung (tidak ada data yang dikirim ke server).
 */
export function PartnerPage() {
  const state = useContent(getPartnerPage);
  // Jenis yang dipilih dari tombol "Ajukan" di section detail → terisi di form
  const [preset, setPreset] = useState<{ type: PartnerTarget; at: number } | null>(null);

  if (state.status !== 'success') {
    return (
      <Section id="partner" tone="dark" className={styles.loading}>
        <SectionState state={state}>{() => null}</SectionState>
      </Section>
    );
  }
  const data = state.data;
  const apply = data.form ? (type: PartnerTarget) => setPreset({ type, at: Date.now() }) : undefined;

  return (
    <>
      {data.hero ? <PartnerHero data={data} /> : <h1 className="visually-hidden">{data.brandName} Partner</h1>}
      {data.types && <TypesSection data={data.types} />}
      {data.franchise && <FranchiseSection data={data} onApply={apply} />}
      {data.brand && <BrandSection data={data} onApply={apply} />}
      {data.corporate && <CorporateSection data={data} onApply={apply} />}
      {data.testimonials && <TestimonialsSection data={data.testimonials} />}
      {data.faq && <FaqSection data={data.faq} />}
      {data.form && <PartnerForm data={data} preset={preset} />}
    </>
  );
}

/* ---------- 1. Hero ---------- */

function PartnerHero({ data }: { data: PartnerPageContent }) {
  const hero = data.hero!;
  const zoneRef = useFabZone<HTMLElement>();
  return (
    <section ref={zoneRef} className={styles.hero} aria-labelledby="partner-title" data-tone="dark">
      <ResponsiveImage image={hero.image} className={styles.heroBg} priority />
      <div className={styles.heroShade} aria-hidden="true" />
      <Container className={styles.heroInner}>
        <Kicker>{hero.kicker}</Kicker>
        <h1 id="partner-title" className={styles.heroTitle}>
          {hero.title}
        </h1>
        <p className={styles.heroText}>{hero.subtitle}</p>
        <div className={styles.heroActions}>
          {hero.primaryLabel && (
            <Button href={`#${PARTNER_IDS.form}`} variant="light" size="lg" iconEnd="arrow">
              {hero.primaryLabel}
            </Button>
          )}
          <Button href={hero.chatHref} external variant="ghost" size="lg" icon="whatsapp">
            {hero.secondaryLabel}
          </Button>
        </div>
      </Container>
    </section>
  );
}

/* ---------- 2. Pilih jenis kerja sama ---------- */

function TypesSection({ data }: { data: NonNullable<PartnerPageContent['types']> }) {
  return (
    <Section id={PARTNER_IDS.types} tone="dark" labelledBy="partner-types-title">
      <SectionTitle heading={data.heading} id="partner-types-title" />
      <ul className={styles.typeGrid} role="list">
        {data.items.map((item) => (
          <li key={item.target}>
            <Card tone="dark" as="div">
              <span className={styles.iconBadge}>
                <Icon name={item.icon} size={24} />
              </span>
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <p className={styles.cardText}>{item.description}</p>
              <CardFooter>
                <Button href={item.href} variant="ghost" iconEnd="arrow" block>
                  {item.buttonLabel}
                </Button>
              </CardFooter>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ---------- 3. Kemitraan Cabang ---------- */

function ApplyButton({ label, type, onApply, tone }: { label: string; type: PartnerTarget; onApply?: (t: PartnerTarget) => void; tone: 'dark' | 'light' }) {
  if (!onApply) return null;
  return (
    <div className={styles.apply}>
      <Button href={`#${PARTNER_IDS.form}`} variant={tone === 'light' ? 'dark' : 'light'} iconEnd="arrow" onClick={() => onApply(type)}>
        {label}
      </Button>
    </div>
  );
}

function FranchiseSection({ data, onApply }: { data: PartnerPageContent; onApply?: (t: PartnerTarget) => void }) {
  const f = data.franchise!;
  return (
    <Section id={PARTNER_IDS.cabang} tone="light" labelledBy="partner-franchise-title">
      <SectionTitle heading={f.heading} id="partner-franchise-title" tone="light" />
      <div className={styles.split}>
        {f.reasons.length > 0 && (
          <div>
            <h3 className={styles.subTitle}>{f.reasonsTitle}</h3>
            <ul className={styles.pointGrid} role="list">
              {f.reasons.map((r) => (
                <li key={r.title} className={styles.point}>
                  <h4 className={styles.pointTitle}>{r.title}</h4>
                  <p className={styles.pointText}>{r.description}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {f.benefits.length > 0 && (
          <div>
            <h3 className={styles.subTitle}>{f.benefitsTitle}</h3>
            <ul className={styles.checks} role="list">
              {f.benefits.map((b) => (
                <li key={b}>
                  <Icon name="check" size={18} className={styles.checkIcon} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {f.steps.length > 0 && (
        <div className={styles.block}>
          <h3 className={styles.subTitle}>{f.stepsTitle}</h3>
          <ol className={styles.steps}>
            {f.steps.map((s, i) => (
              <li key={s.title} className={styles.step}>
                <span className={styles.stepNo} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h4 className={styles.pointTitle}>{s.title}</h4>
                <p className={styles.pointText}>{s.description}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(f.cities.length > 0 || f.investmentRange) && (
        <div className={`${styles.block} ${styles.split}`}>
          {f.cities.length > 0 && (
            <div>
              <h3 className={styles.subTitle}>{f.citiesTitle}</h3>
              <ul className={styles.chips} role="list">
                {f.cities.map((c) => (
                  <li key={c} className={styles.chip}>
                    <Icon name="pin" size={14} />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {f.investmentRange && (
            <div>
              <h3 className={styles.subTitle}>{data.copy.investmentLabel}</h3>
              <p className={styles.investment}>{f.investmentRange}</p>
            </div>
          )}
        </div>
      )}
      <ApplyButton label={data.copy.applyLabel} type="cabang" onApply={onApply} tone="light" />
    </Section>
  );
}

/* ---------- 4. Brand & Kolaborasi ---------- */

function BrandSection({ data, onApply }: { data: PartnerPageContent; onApply?: (t: PartnerTarget) => void }) {
  const b = data.brand!;
  return (
    <Section id={PARTNER_IDS.brand} tone="dark" labelledBy="partner-brand-title">
      <SectionTitle heading={b.heading} id="partner-brand-title" />
      {b.forms.length > 0 && (
        <ul className={styles.pointGrid4} role="list">
          {b.forms.map((f) => (
            <li key={f.title} className={`${styles.point} ${styles.pointDark}`}>
              <h3 className={styles.pointTitle}>{f.title}</h3>
              <p className={styles.pointText}>{f.description}</p>
            </li>
          ))}
        </ul>
      )}
      {/* Bagian logo hanya bila ada logo aktif */}
      {b.logos.length > 0 && (
        <div className={styles.block}>
          <h3 className={styles.subTitle}>{b.logosTitle}</h3>
          <ul className={styles.logos} role="list">
            {b.logos.map((l) => (
              <li key={l.name} className={styles.logoCell}>
                {l.url ? (
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className={styles.logoLink} aria-label={l.name}>
                    <ResponsiveImage image={l.logo} className={styles.logo} />
                  </a>
                ) : (
                  <ResponsiveImage image={l.logo} className={styles.logo} />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ApplyButton label={data.copy.applyLabel} type="brand" onApply={onApply} tone="dark" />
    </Section>
  );
}

/* ---------- 5. Korporat & Event ---------- */

function CorporateSection({ data, onApply }: { data: PartnerPageContent; onApply?: (t: PartnerTarget) => void }) {
  const c = data.corporate!;
  return (
    <Section id={PARTNER_IDS.korporat} tone="light" labelledBy="partner-corporate-title">
      <SectionTitle heading={c.heading} id="partner-corporate-title" tone="light" />
      {c.services.length > 0 && (
        <ul className={styles.pointGrid4} role="list">
          {c.services.map((s) => (
            <li key={s.title} className={styles.point}>
              <span className={styles.iconBadgeLight}>
                <Icon name={s.icon} size={22} />
              </span>
              <h3 className={styles.pointTitle}>{s.title}</h3>
              <p className={styles.pointText}>{s.description}</p>
            </li>
          ))}
        </ul>
      )}
      {c.note && (
        <p className={styles.note}>
          <Icon name="info" size={18} />
          <span>{c.note}</span>
        </p>
      )}
      <ApplyButton label={data.copy.applyLabel} type="korporat" onApply={onApply} tone="light" />
    </Section>
  );
}

/* ---------- 6. Testimoni partner ---------- */

function TestimonialsSection({ data }: { data: NonNullable<PartnerPageContent['testimonials']> }) {
  return (
    <Section id={PARTNER_IDS.testimonials} tone="dark" labelledBy="partner-testi-title">
      <SectionTitle heading={data.heading} id="partner-testi-title" />
      <ul className={styles.pointGrid} role="list">
        {data.items.map((t) => (
          <li key={`${t.name}-${t.quote.slice(0, 20)}`}>
            <Card tone="dark" as="figure" className={styles.quoteCard}>
              <blockquote className={styles.quote}>“{t.quote}”</blockquote>
              <figcaption className={styles.quoteBy}>
                <strong>{t.name}</strong>
                {t.institution && <span>{t.institution}</span>}
              </figcaption>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ---------- 7. FAQ (details/summary: bisa dibuka dengan keyboard tanpa JavaScript tambahan) ---------- */

function FaqSection({ data }: { data: NonNullable<PartnerPageContent['faq']> }) {
  return (
    <Section id={PARTNER_IDS.faq} tone="light" labelledBy="partner-faq-title">
      <SectionTitle heading={data.heading} id="partner-faq-title" tone="light" />
      <div className={styles.faq}>
        {data.items.map((q) => (
          <details key={q.question} className={styles.faqItem}>
            <summary className={styles.faqQ}>
              <span>{q.question}</span>
              <Icon name="plus" size={18} className={styles.faqIcon} />
            </summary>
            <p className={styles.faqA}>{q.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

/* ---------- 8. Form pengajuan → WhatsApp ---------- */

function PartnerForm({ data, preset }: { data: PartnerPageContent; preset: { type: PartnerTarget; at: number } | null }) {
  const form = data.form!;
  const copy = data.copy.form;
  const uid = useId();
  const [values, setValues] = useState<PartnerFormValues>(EMPTY_PARTNER_FORM);
  const [errors, setErrors] = useState<PartnerFormErrors>({});
  const [opened, setOpened] = useState(false);
  const [lastPreset, setLastPreset] = useState<number | null>(null);
  // Tombol WA melayang disembunyikan selama form terlihat (tidak menutupi tombol kirim)
  const zoneRef = useFabZone<HTMLDivElement>(0.05);

  // Jenis dari tombol "Ajukan" di section detail
  if (preset && preset.at !== lastPreset) {
    setLastPreset(preset.at);
    setValues((v) => ({ ...v, type: preset.type }));
  }

  const set = (key: keyof PartnerFormValues) => (e: { target: { value: string } }) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
    setOpened(false);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const found = validatePartnerForm(values);
    setErrors(found);
    const first = (Object.keys(found) as (keyof PartnerFormValues)[])[0];
    if (first) {
      document.getElementById(`${uid}-${first}`)?.focus();
      setOpened(false);
      return;
    }
    window.open(partnerFormLink(data.whatsappNumber, values, data.brandName), '_blank', 'noopener,noreferrer');
    setOpened(true);
  };

  const id = (k: string) => `${uid}-${k}`;
  const field = (k: keyof PartnerFormValues) => ({
    id: id(k),
    name: k,
    value: values[k],
    onChange: set(k),
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': [errors[k] && id(`${k}-err`), k === 'phone' && id('phone-hint')].filter(Boolean).join(' ') || undefined,
  });
  const err = (k: keyof PartnerFormValues) =>
    errors[k] ? (
      <p id={id(`${k}-err`)} className={styles.error}>
        <Icon name="alert" size={14} />
        {errors[k]}
      </p>
    ) : null;
  const label = (k: keyof PartnerFormValues, text: string, required: boolean) => (
    <label htmlFor={id(k)} className={styles.label}>
      {text}
      <span className={styles.labelHint}>{required ? ` (${copy.required})` : ` (${copy.optional})`}</span>
    </label>
  );
  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <Section id={PARTNER_IDS.form} tone="dark" labelledBy="partner-form-title" className={styles.formSection}>
      <SectionTitle heading={form.heading} id="partner-form-title" />
      <div ref={zoneRef} className={styles.formWrap}>
        <div>
          <Card tone="dark" as="form" noValidate className={styles.form} onSubmit={onSubmit} aria-labelledby="partner-form-title">
            {hasErrors && (
              <p className={styles.errorSummary} role="alert">
                {copy.errorSummary}
              </p>
            )}
            <div className={styles.field}>
              {label('type', copy.type, true)}
              <div className={styles.selectWrap}>
                <select {...field('type')} className={styles.input} required>
                  <option value="">{copy.typePlaceholder}</option>
                  {form.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {err('type')}
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                {label('name', copy.name, true)}
                <input {...field('name')} className={styles.input} type="text" autoComplete="name" maxLength={PARTNER_LIMITS.name} required />
                {err('name')}
              </div>
              <div className={styles.field}>
                {label('company', copy.company, false)}
                <input {...field('company')} className={styles.input} type="text" autoComplete="organization" maxLength={PARTNER_LIMITS.company} />
                {err('company')}
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                {label('city', copy.city, true)}
                <input {...field('city')} className={styles.input} type="text" autoComplete="address-level2" maxLength={PARTNER_LIMITS.city} required />
                {err('city')}
              </div>
              <div className={styles.field}>
                {label('phone', copy.phone, true)}
                <input
                  {...field('phone')}
                  className={styles.input}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={PARTNER_LIMITS.phone}
                  placeholder="08xxxxxxxxxx"
                  required
                />
                <p id={id('phone-hint')} className={styles.hint}>
                  {copy.phoneHint}
                </p>
                {err('phone')}
              </div>
            </div>
            <div className={styles.field}>
              {label('message', copy.message, true)}
              <textarea {...field('message')} className={`${styles.input} ${styles.textarea}`} rows={4} maxLength={PARTNER_LIMITS.message} placeholder={copy.messagePlaceholder} required />
              {err('message')}
            </div>
            <Button type="submit" variant="whatsapp" size="lg" icon="whatsapp" block>
              {form.submitLabel}
            </Button>
            <p className={styles.privacy}>{form.privacyNote}</p>
            <p className={styles.opened} role="status">
              {opened ? copy.opened : ''}
            </p>
          </Card>
        </div>
      </div>
    </Section>
  );
}

/** CTA penutup: teks & foto dari Pages CMS (cta.json), foto cadangan, batas karakter sama di Zod & form CMS. */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { ctaBannerCopy } from '../src/content/cta';
import { ctaSchema } from '../src/content/schema';
import { buildCtaBanner } from '../src/lib/contentTransforms';
import { setMedia, validateCmsContent, type CmsField, type CmsMedia } from './helpers/pagesCms';
import { rawFixture } from './helpers/contentFixture';

// Data uji sebagai dasar; cta.json asli hanya diperiksa lolos Zod & form (isinya diubah admin kapan saja)
const current: Record<string, unknown> = { ...rawFixture.cta };
const config = parse(readFileSync('.pages.yml', 'utf8')) as { media: CmsMedia[]; content: { name: string; fields: CmsField[] }[] };
const form = config.content.find((c) => c.name === 'cta')!;
setMedia(config.media);

describe('CTA penutup', () => {
  it('cta.json saat ini valid (Zod) dan bisa disimpan lewat form CMS', () => {
    const file = JSON.parse(readFileSync('src/content/cta.json', 'utf8'));
    expect(ctaSchema.safeParse(file).success).toBe(true);
    expect(validateCmsContent(form, file)).toEqual([]);
  });

  it('batas: kicker 60, judul 60, deskripsi 240, label tombol 40, deskripsi foto 150 (Zod & form)', () => {
    const limits = { kicker: 60, title: 60, description: 240, ctaLabel: 40, imageAlt: 150 };
    for (const [field, max] of Object.entries(limits)) {
      const ok = { ...current, image: '/uploads/cta/studio.webp', imageAlt: 'Studio', [field]: 'x'.repeat(max) };
      const long = { ...ok, [field]: 'x'.repeat(max + 1) };
      expect(ctaSchema.safeParse(ok).success, field).toBe(true);
      expect(ctaSchema.safeParse(long).success, field).toBe(false);
      expect(validateCmsContent(form, ok), field).toEqual([]);
      expect(validateCmsContent(form, long)[0], field).toMatch(new RegExp(`${field}: lebih dari ${max} karakter`));
    }
  });

  it('foto: deskripsi wajib bila foto diisi; foto harus di folder CTA', () => {
    expect(ctaSchema.safeParse({ ...current, image: '/uploads/cta/studio.webp', imageAlt: '' }).success).toBe(false);
    expect(validateCmsContent(form, { ...current, image: '/uploads/gallery/a.webp', imageAlt: 'x' })[0]).toMatch(/folder media \/uploads\/cta/);
  });

  it('foto kosong → foto cadangan; tombol tetap WhatsApp; foto CMS → dipakai dengan deskripsinya', () => {
    const empty = buildCtaBanner(ctaSchema.parse({ ...current, image: '' }), ctaBannerCopy);
    expect(empty.backgroundImage).toEqual(ctaBannerCopy.fallbackImage);
    expect(empty.cta).toEqual({ label: current.ctaLabel, action: { type: 'whatsapp' } });
    const custom = buildCtaBanner(ctaSchema.parse({ ...current, image: '/uploads/cta/kursi.webp', imageAlt: 'Kursi barber' }), ctaBannerCopy);
    expect(custom.backgroundImage).toMatchObject({ src: '/uploads/cta/kursi.webp', alt: 'Kursi barber' });
  });
});

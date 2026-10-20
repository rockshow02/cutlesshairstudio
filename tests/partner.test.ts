/** Halaman Partner: pesan WhatsApp dari form, fallback nomor, section yang dimatikan tidak dirender. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { partnerSchema } from '../src/content/schema';
import { partnerCopy } from '../src/content/partnerCopy';
import {
  buildPartnerMessage,
  buildPartnerPage,
  EMPTY_PARTNER_FORM,
  partnerFormLink,
  partnerWhatsappNumber,
  validatePartnerForm,
  type PartnerFormValues,
} from '../src/lib/partner';
import { setMedia, validateCmsContent, type CmsField, type CmsMedia } from './helpers/pagesCms';

const raw = JSON.parse(readFileSync('src/content/partner.json', 'utf8'));
const seed = partnerSchema.parse(raw);
const settings = { mainWhatsappNumber: '6281111111111', siteName: 'Cutless Hair Studio' };
const fallback = { src: '/images/cta/studio.jpg', alt: 'Studio', width: 750, height: 423 };
const build = (p = seed) => buildPartnerPage(p, settings, fallback, partnerCopy);
const valid: PartnerFormValues = {
  type: 'cabang',
  name: 'Budi Santoso',
  company: '',
  city: 'Sukabumi',
  phone: '0812-3456-7890',
  message: 'Saya punya ruko di pusat kota dan ingin membuka cabang.',
};
const decode = (href: string) => new URL(href).searchParams.get('text') ?? '';

describe('form pengajuan → WhatsApp', () => {
  it('pesan berformat rapi berisi semua isian', () => {
    const msg = buildPartnerMessage({ ...valid, company: 'PT Maju Jaya' }, 'Cutless Hair Studio');
    expect(msg).toBe(
      [
        'Halo Tim Partnership Cutless Hair Studio, saya ingin mengajukan kerja sama.',
        '',
        '*Jenis kerja sama:* Kemitraan Cabang',
        '*Nama:* Budi Santoso',
        '*Perusahaan/brand:* PT Maju Jaya',
        '*Kota:* Sukabumi',
        '*Nomor WhatsApp:* 081234567890',
        '',
        '*Pesan:*',
        'Saya punya ruko di pusat kota dan ingin membuka cabang.',
      ].join('\n'),
    );
    // Perusahaan opsional → "-"
    expect(buildPartnerMessage(valid, 'X')).toContain('*Perusahaan/brand:* -');
    expect(buildPartnerMessage({ ...valid, type: 'korporat' }, 'X')).toContain('*Jenis kerja sama:* Korporat & Event');
  });

  it('link wa.me ke nomor partnership dengan pesan ter-encode', () => {
    const href = partnerFormLink('6289999999999', valid, 'Cutless Hair Studio');
    expect(href.startsWith('https://wa.me/6289999999999?text=')).toBe(true);
    expect(decode(href)).toBe(buildPartnerMessage(valid, 'Cutless Hair Studio'));
  });

  it('validasi: wajib isi & format nomor 08/62', () => {
    expect(validatePartnerForm(valid)).toEqual({});
    expect(Object.keys(validatePartnerForm(EMPTY_PARTNER_FORM)).sort()).toEqual(['city', 'message', 'name', 'phone', 'type']);
    for (const phone of ['081234567890', '6281234567890', '+62 812-3456-7890', '0812.3456.7890']) {
      expect(validatePartnerForm({ ...valid, phone }).phone, phone).toBeUndefined();
    }
    for (const phone of ['12345', '0712345678', '+1 555 1234 567', '08123', '62123456789', 'abc']) {
      expect(validatePartnerForm({ ...valid, phone }).phone, phone).toMatch(/08 atau 62/);
    }
    expect(validatePartnerForm({ ...valid, name: '   ' }).name).toBeDefined();
    expect(validatePartnerForm({ ...valid, message: 'x'.repeat(501) }).message).toMatch(/Maksimal 500/);
  });
});

describe('nomor tujuan', () => {
  it('nomor partnership; kosong → Nomor WhatsApp pusat', () => {
    expect(partnerWhatsappNumber('6282222222222', '6281111111111')).toBe('6282222222222');
    expect(partnerWhatsappNumber('', '6281111111111')).toBe('6281111111111');
    expect(partnerWhatsappNumber(null, '6281111111111')).toBe('6281111111111');
    expect(partnerWhatsappNumber(undefined, '6281111111111')).toBe('6281111111111');
    expect(build().whatsappNumber).toBe('6281111111111');
    expect(build({ ...seed, partnershipWhatsapp: '6282222222222' }).whatsappNumber).toBe('6282222222222');
    expect(new URL(build().hero!.chatHref).pathname).toBe('/6281111111111');
  });
});

describe('section yang dimatikan tidak dirender', () => {
  it('seed: semua section tampil kecuali testimoni (kosong & nonaktif); logo & investasi kosong tidak tampil', () => {
    const page = build();
    expect(page.hero && page.types && page.franchise && page.brand && page.corporate && page.faq && page.form).toBeTruthy();
    expect(page.testimonials).toBeNull();
    expect(page.brand!.logos).toEqual([]);
    expect(page.franchise!.investmentRange).toBeNull();
    expect(page.types!.items.map((t) => t.href)).toEqual(['#kemitraan-cabang', '#brand-kolaborasi', '#korporat-event']);
  });

  it('section detail mati → kartu & link anchornya ikut hilang', () => {
    const page = build({ ...seed, brand: { ...seed.brand, enabled: false } });
    expect(page.brand).toBeNull();
    expect(page.types!.items.map((t) => t.target)).toEqual(['cabang', 'korporat']);
    expect(JSON.stringify(page)).not.toContain('#brand-kolaborasi');
    // Semua section detail mati → section pilihan jenis ikut hilang
    const none = build({ ...seed, franchise: { ...seed.franchise, enabled: false }, brand: { ...seed.brand, enabled: false }, corporate: { ...seed.corporate, enabled: false } });
    expect(none.types).toBeNull();
  });

  it('form mati → tombol "Ajukan" di hero hilang', () => {
    const page = build({ ...seed, form: { ...seed.form, enabled: false } });
    expect(page.form).toBeNull();
    expect(page.hero!.primaryLabel).toBeNull();
    expect(build().hero!.primaryLabel).toBe('Ajukan Kerja Sama');
  });

  it('hero, FAQ, testimoni', () => {
    expect(build({ ...seed, hero: { ...seed.hero, enabled: false } }).hero).toBeNull();
    expect(build({ ...seed, faq: { ...seed.faq, enabled: false } }).faq).toBeNull();
    expect(build({ ...seed, faq: { ...seed.faq, items: [] } }).faq).toBeNull();
    const items = [{ name: 'Rina', institution: '', quote: 'Kerja sama yang rapi.' }];
    expect(build({ ...seed, testimonials: { ...seed.testimonials, items } }).testimonials).toBeNull(); // masih nonaktif
    expect(build({ ...seed, testimonials: { ...seed.testimonials, enabled: true, items } }).testimonials!.items[0]).toEqual({ name: 'Rina', institution: null, quote: 'Kerja sama yang rapi.' });
  });

  it('logo: hanya yang aktif, urut; investasi tampil bila diisi admin', () => {
    const logos = [
      { name: 'B', logo: '/uploads/partner-logos/b.webp', url: '', order: 2, isActive: true },
      { name: 'A', logo: '/uploads/partner-logos/a.webp', url: 'https://contoh.id', order: 1, isActive: true },
      { name: 'C', logo: '/uploads/partner-logos/c.webp', url: '', order: 0, isActive: false },
    ];
    const page = build({ ...seed, brand: { ...seed.brand, logos } });
    expect(page.brand!.logos.map((l) => [l.name, l.url])).toEqual([['A', 'https://contoh.id'], ['B', null]]);
    expect(build({ ...seed, franchise: { ...seed.franchise, investmentRange: 'Hubungi kami' } }).franchise!.investmentRange).toBe('Hubungi kami');
  });

  it('hero: foto CMS dipakai, kosong → foto cadangan', () => {
    expect(build().hero!.image.src).toBe(fallback.src);
    const page = build({ ...seed, hero: { ...seed.hero, image: '/uploads/partner/hero.webp', imageAlt: 'Studio' } });
    expect(page.hero!.image.src).toBe('/uploads/partner/hero.webp');
  });
});

describe('seed & CMS Halaman Partner', () => {
  it('seed tanpa angka finansial, tanpa testimoni', () => {
    const text = JSON.stringify(raw);
    expect(text).not.toMatch(/\bRp|\bjuta\b|\bmiliar\b|\bROI\b|balik modal|\d+\s?%/i);
    expect(raw.franchise.investmentRange).toBe('');
    expect(raw.testimonials).toMatchObject({ enabled: false, items: [] });
    expect(raw.brand.logos).toEqual([]);
  });

  it('batas karakter sesuai brief (Zod = .pages.yml dijaga cms-schema.test.ts)', () => {
    const config = parse(readFileSync('.pages.yml', 'utf8')) as { media: CmsMedia[]; content: { name: string; fields: CmsField[] }[] };
    const entry = config.content.find((c) => c.name === 'partner')!;
    const f = (path: string) => path.split('.').reduce<CmsField | undefined>((acc, name) => (acc ? acc.fields : entry.fields)?.find((x) => x.name === name), undefined)!;
    expect(f('hero.title').options?.maxlength).toBe(80);
    expect(f('types.items.description').options?.maxlength).toBe(300);
    expect(f('franchise.benefits').options?.maxlength).toBe(160);
    expect(f('faq.items.answer').options?.maxlength).toBe(600);
    expect(f('brand.logos.name').options?.maxlength).toBe(60);
    expect(f('testimonials.items.quote').options?.maxlength).toBe(400);
    expect(config.media.map((m) => m.output)).toEqual(expect.arrayContaining(['/uploads/partner', '/uploads/partner-logos']));

    // partner.json + logo baru lolos form Pages CMS; pelanggaran ditolak
    setMedia(config.media);
    expect(validateCmsContent(entry, raw)).toEqual([]);
    const logo = { name: 'Brand Contoh', logo: '/uploads/partner-logos/contoh.png', url: '', order: 0, isActive: true };
    expect(validateCmsContent(entry, { ...raw, brand: { ...raw.brand, logos: [logo] } })).toEqual([]);
    expect(validateCmsContent(entry, { ...raw, brand: { ...raw.brand, logos: [{ ...logo, logo: '/uploads/gallery/a.webp' }] } })[0]).toMatch(/partner-logos/);
    expect(validateCmsContent(entry, { ...raw, brand: { ...raw.brand, logos: [{ ...logo, name: 'x'.repeat(61) }] } })[0]).toMatch(/lebih dari 60/);
    expect(validateCmsContent(entry, { ...raw, partnershipWhatsapp: '0812345678' })[0]).toMatch(/partnershipWhatsapp/);
    expect(validateCmsContent(entry, { ...raw, faq: { ...raw.faq, items: [{ question: 'Q', answer: 'x'.repeat(601) }] } })[0]).toMatch(/lebih dari 600/);
    // Zod juga menolak
    expect(partnerSchema.safeParse({ ...raw, testimonials: { ...raw.testimonials, items: [{ name: 'A', quote: 'x'.repeat(401) }] } }).success).toBe(false);
    expect(partnerSchema.safeParse({ ...raw, hero: { ...raw.hero, image: '/uploads/partner/a.webp', imageAlt: '' } }).success).toBe(false);
  });
});

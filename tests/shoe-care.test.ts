/** Partner Cuci Sepatu: tidak dirender saat mati, fallback nomor WA, pesan per layanan, catatan cabang lain, CMS. */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { shoeCareSchema, type ShoeCareEntry } from '../src/content/schema';
import { shoeCareCopy } from '../src/content/shoeCare';
import { site } from '../src/content/site';
import { buildShoeCare, buildSite, shoeCarePlacement } from '../src/lib/contentTransforms';
import { templateLink } from '../src/lib/whatsapp';
import { ShoeCareView } from '../src/components/sections/ShoeCare';
import type { Branch } from '../src/types';
import { setMedia, validateCmsContent, type CmsField, type CmsMedia } from './helpers/pagesCms';

// Data uji sendiri (bukan isi CMS, yang bisa berubah kapan saja)
const branch = (slug: string, name: string, whatsappNumber: string) =>
  ({ slug, name, city: name, whatsappNumber, pageUrl: `/cabang/${slug}/`, bookable: true }) as unknown as Branch;
const BRANCHES = [branch('bogor-bantarjati', 'Bogor Bantarjati', '6281100000101'), branch('cibubur', 'Cibubur', '6281100000202')];

const entry = (extra: Partial<ShoeCareEntry> = {}): ShoeCareEntry =>
  shoeCareSchema.parse({
    enabled: true,
    branchSlug: 'bogor-bantarjati',
    name: 'Cuci Sepatu Uji',
    advantages: [
      { title: 'Teliti', description: 'Dikerjakan satu per satu.', icon: 'check' },
      { title: 'Cepat', description: 'Estimasi jelas.', icon: 'clock' },
    ],
    services: [
      { name: 'Deep Clean', price: 45000, priceFrom: true, estimate: '±2 hari', order: 1 },
      { name: 'Fast Clean', price: 30000, order: 2 },
      { name: 'Unyellowing', price: 60000, isActive: false },
    ],
    ...extra,
  });
const build = (p: ShoeCareEntry | null = entry()) => buildShoeCare(p, BRANCHES, shoeCareCopy);
const wa = (href: string) => {
  const url = new URL(href);
  return { number: url.pathname.slice(1), text: url.searchParams.get('text') ?? '' };
};

describe('section Cuci Sepatu', () => {
  it('tidak dirender saat toggle mati, tanpa layanan tampil, atau cabang tidak ada', () => {
    expect(build(entry({ enabled: false }))).toBeNull();
    expect(build(shoeCareSchema.parse({ ...JSON.parse(readFileSync('src/content/shoeCare.json', 'utf8')), enabled: false }))).toBeNull();
    expect(build(entry({ services: [{ name: 'A', price: 1000, priceFrom: false, isActive: false, order: 0 }] }))).toBeNull();
    expect(build(entry({ branchSlug: 'depok' }))).toBeNull();
    expect(build(null)).toBeNull();
    // Menu HP & footer: "Cuci Sepatu" hanya saat section tampil
    const settings = { siteName: 'Cutless', siteUrl: '', mainWhatsappNumber: '62811', showTestimonials: false, showProducts: true, showBeforeAfter: false } as never;
    expect(buildSite(settings, site, BRANCHES, { shoeCare: false }).nav.some((n) => n.sectionId === 'cuci-sepatu')).toBe(false);
    const on = buildSite(settings, site, BRANCHES, { shoeCare: true }).nav.find((n) => n.sectionId === 'cuci-sepatu');
    expect(on).toMatchObject({ label: 'Cuci Sepatu', desktop: false });
  });

  it('nomor WhatsApp: nomor partner; kosong → nomor cabang partner (bukan cabang pilihan pengunjung)', () => {
    expect(wa(build(entry({ whatsappNumber: '6281100000909' }))!.mainHref).number).toBe('6281100000909');
    expect(wa(build(entry({ whatsappNumber: '' }))!.mainHref).number).toBe('6281100000101');
    expect(wa(build(entry({ whatsappNumber: null }))!.services[0].href).number).toBe('6281100000101');
    // Partner di Cibubur → nomor Cibubur
    expect(wa(build(entry({ branchSlug: 'cibubur' }))!.mainHref).number).toBe('6281100000202');
  });

  it('pesan per layanan mengisi {partner} & {service}; tombol utama memakai pesan umum; penanda "via website Cutless"', () => {
    const data = build()!;
    expect(data.services.map((s) => s.name)).toEqual(['Deep Clean', 'Fast Clean']);
    expect(wa(data.services[0].href).text).toBe('Halo Cuci Sepatu Uji, saya mau pesan Deep Clean di Cutless Hair Studio cabang Bogor Bantarjati. (via website Cutless)');
    expect(wa(data.services[1].href).text).toContain('pesan Fast Clean di');
    expect(wa(data.mainHref).text).toBe('Halo Cuci Sepatu Uji, saya mau pesan layanan cuci sepatu di Cutless Hair Studio cabang Bogor Bantarjati. (via website Cutless)');
    // Template dari CMS; kosong → bawaan
    const custom = build(entry({ messageTemplate: 'Order {service} @ {branch}' }))!;
    expect(wa(custom.services[0].href).text).toBe('Order Deep Clean @ Bogor Bantarjati');
    // {partner} = Nama partner (ikut berubah bila nama diganti); boleh dipakai berulang & di mana saja
    const named = build(entry({ name: 'Sepatu Kinclong', messageTemplate: '{partner}: {service} ({branch}) - {partner}' }))!;
    expect(wa(named.services[1].href).text).toBe('Sepatu Kinclong: Fast Clean (Bogor Bantarjati) - Sepatu Kinclong');
    expect(wa(named.mainHref).text).toBe('Sepatu Kinclong: layanan cuci sepatu (Bogor Bantarjati) - Sepatu Kinclong');
    // Template tanpa {partner} tetap jalan
    expect(wa(build(entry({ messageTemplate: 'Pesan {service}' }))!.mainHref).text).toBe('Pesan layanan cuci sepatu');
    expect(wa(build(entry({ messageTemplate: '' }))!.mainHref).text).toContain('(via website Cutless)');
    // Helper umum
    expect(wa(templateLink('081234', 'Halo {service}  ,  {branch}', { service: 'A', branch: 'B' })).text).toBe('Halo A, B');
    expect(wa(templateLink('081234', 'x', {})).number).toBe('6281234');
  });

  it('harga Rupiah tanpa desimal, "mulai" opsional, estimasi', () => {
    const [deep, fast] = build()!.services;
    expect(deep.price).toMatch(/^mulai Rp\s45\.000$/);
    expect(fast.price).toMatch(/^Rp\s30\.000$/);
    expect(deep.estimate).toBe('±2 hari');
    expect(fast.estimate).toBeUndefined();
  });

  it('cabang: halaman cabang lain → tidak tampil; cabang lain dipilih di beranda → tampil dengan catatan', () => {
    expect(shoeCarePlacement('bogor-bantarjati', { pageSlug: 'cibubur', selectedSlug: 'bogor-bantarjati' })).toBe('hidden');
    expect(shoeCarePlacement('bogor-bantarjati', { pageSlug: 'bogor-bantarjati', selectedSlug: 'cibubur' })).toBe('available');
    expect(shoeCarePlacement('bogor-bantarjati', { selectedSlug: 'cibubur' })).toBe('other-branch');
    expect(shoeCarePlacement('bogor-bantarjati', { selectedSlug: 'bogor-bantarjati' })).toBe('available');
    expect(shoeCarePlacement('bogor-bantarjati', {})).toBe('available');

    const data = build()!;
    const note = renderToStaticMarkup(createElement(ShoeCareView, { data, otherBranch: true }));
    expect(note).toContain('Layanan cuci sepatu hanya tersedia di cabang <strong>Bogor Bantarjati</strong>');
    expect(note).toContain('wa.me/6281100000101'); // tetap ke cabang partner
    const plain = renderToStaticMarkup(createElement(ShoeCareView, { data, otherBranch: false }));
    expect(plain).not.toContain('hanya tersedia di cabang');
    expect(plain).toContain('id="cuci-sepatu"');
    // Terpisah dari Daftar Harga (juga terang): latar terang hangat + pita "Partner Cutless" di batas atas
    expect(plain).toContain('data-tone="light"');
    expect(plain).toContain('data-surface="warm"');
    expect(plain).toContain('Partner Cutless</p>');
    expect(plain).toContain('Tersedia di Bogor Bantarjati');
    expect(plain).toContain('Titip Sepatu via WhatsApp');
    // Galeri hanya bila ada foto
    expect(plain).not.toContain('Hasil cuci');
  });
});

describe('CMS Partner Cuci Sepatu', () => {
  const config = parse(readFileSync('.pages.yml', 'utf8')) as { media: CmsMedia[]; content: { name: string; path: string; fields: CmsField[] }[] };
  const cms = config.content.find((c) => c.path === 'src/content/shoeCare.json')!;
  const raw = JSON.parse(readFileSync('src/content/shoeCare.json', 'utf8'));
  const f = (path: string) => path.split('.').reduce<CmsField | undefined>((acc, n) => (acc ? acc.fields : cms.fields)?.find((x) => x.name === n), undefined)!;

  it('batas karakter & daftar sesuai brief, media shoe-care', () => {
    expect(cms.name).toBe('shoeCare');
    expect(f('enabled').default).toBe(false);
    expect(f('branchSlug').default).toBe('bogor-bantarjati');
    expect([f('name'), f('tagline'), f('description')].map((x) => x.options?.maxlength)).toEqual([60, 120, 300]);
    expect([f('advantages.title'), f('advantages.description')].map((x) => x.options?.maxlength)).toEqual([40, 120]);
    expect(f('advantages').list).toMatchObject({ min: 2, max: 4 });
    expect([f('services.name'), f('services.description'), f('services.estimate')].map((x) => x.options?.maxlength)).toEqual([40, 120, 30]);
    expect(f('services').list).toMatchObject({ min: 1, max: 8 });
    expect(f('photos').list).toMatchObject({ max: 8 });
    expect(f('photos.alt').options?.maxlength).toBe(150);
    expect(f('notes').options?.maxlength).toBe(160);
    expect(f('messageTemplate').options?.maxlength).toBe(500);
    expect(f('photos.image').options?.media).toBe('shoe-care');
    expect(config.media.find((m) => m.name === 'shoe-care')?.output).toBe('/uploads/shoe-care');
  });

  it('isi saat ini lolos form & Zod; form dan Zod menolak isian tidak valid', () => {
    setMedia(config.media);
    expect(validateCmsContent(cms, raw)).toEqual([]);
    expect(shoeCareSchema.safeParse(raw).success).toBe(true);
    // Template: hanya {service} & {branch}
    expect(validateCmsContent(cms, { ...raw, messageTemplate: 'Halo {brand}' })[0]).toMatch(/messageTemplate/);
    expect(shoeCareSchema.safeParse({ ...raw, messageTemplate: 'Halo {brand}' }).success).toBe(false);
    expect(validateCmsContent(cms, { ...raw, messageTemplate: '{service} di {branch}' })).toEqual([]);
    // {partner} diizinkan di form & Zod
    const withPartner = 'Halo {partner}, {service} di {branch}';
    expect(validateCmsContent(cms, { ...raw, messageTemplate: withPartner })).toEqual([]);
    expect(shoeCareSchema.safeParse({ ...raw, messageTemplate: withPartner }).success).toBe(true);
    expect(shoeCareSchema.safeParse({ ...raw, messageTemplate: 'Halo {partner} {nama}' }).success).toBe(false);
    expect(validateCmsContent(cms, { ...raw, messageTemplate: 'Halo {Partner}' })[0]).toMatch(/messageTemplate/);
    // Nomor partner
    expect(validateCmsContent(cms, { ...raw, whatsappNumber: '0812345678' })[0]).toMatch(/whatsappNumber/);
    expect(shoeCareSchema.safeParse({ ...raw, whatsappNumber: '0812345678' }).success).toBe(false);
    // Daftar & batas
    expect(validateCmsContent(cms, { ...raw, advantages: raw.advantages.slice(0, 1) })[0]).toMatch(/minimal 2/);
    expect(validateCmsContent(cms, { ...raw, services: [] })[0]).toMatch(/minimal 1/);
    expect(shoeCareSchema.safeParse({ ...raw, services: [{ name: 'A', price: 1000.5 }] }).success).toBe(false);
    const photo = { image: '/uploads/shoe-care/hasil.jpg', alt: 'Sepatu putih setelah dicuci' };
    expect(validateCmsContent(cms, { ...raw, photos: [photo] })).toEqual([]);
    expect(validateCmsContent(cms, { ...raw, photos: [{ ...photo, alt: '' }] })[0]).toMatch(/alt: wajib/);
    expect(validateCmsContent(cms, { ...raw, photos: [{ ...photo, image: '/uploads/gallery/a.webp' }] })[0]).toMatch(/shoe-care/);
    // Cabang kosong di CMS → bawaan bogor-bantarjati
    expect(shoeCareSchema.parse({ ...raw, branchSlug: '' }).branchSlug).toBe('bogor-bantarjati');
    // Template bawaan sama dengan isi awal
    expect(shoeCareCopy.defaultTemplate).toBe('Halo {partner}, saya mau pesan {service} di Cutless Hair Studio cabang {branch}. (via website Cutless)');
    expect(raw.messageTemplate).toBe(shoeCareCopy.defaultTemplate);
    expect(f('messageTemplate').description).toContain('{partner}');
    expect(shoeCareCopy.defaultTemplate).toContain('(via website Cutless)');
  });
});

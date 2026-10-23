/** Halaman /cuci-sepatu/ & teaser: data, WhatsApp, teaser & redirect mengikuti toggle, meta, CMS. Data uji sendiri. */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { SHOE_CARE_PRICE_PATTERN, shoeCareSchema, type ShoeCareEntry } from '../src/content/schema';
import { shoeCareCopy } from '../src/content/shoeCare';
import { shoeCareDescription, shoeCareImage, shoeCareRedirects, shoeCareTitle, shoeCareVisible } from '../src/content/shoeCareSeo';
import { site } from '../src/content/site';
import { buildShoeCare, buildSite, shoeCareMenuUrl, shoeCarePlacement } from '../src/lib/contentTransforms';
import { formatPriceText } from '../src/lib/format';
import { templateLink } from '../src/lib/whatsapp';
import { MenuButton, ShoeCarePageView } from '../src/components/pages/ShoeCarePage';
import { ShoeCareTeaserView } from '../src/components/sections/ShoeCareTeaser';
import type { Branch, ImageAsset } from '../src/types';
import { setMedia, validateCmsContent, type CmsField, type CmsMedia } from './helpers/pagesCms';

const branch = (slug: string, name: string, whatsappNumber: string) =>
  ({ slug, name, city: name, whatsappNumber, pageUrl: `/cabang/${slug}/`, bookable: true, address: 'Jl. Uji No. 1', hours: [], directionsUrl: 'https://maps.example/x' }) as unknown as Branch;
const BRANCHES = [branch('bogor-bantarjati', 'Bogor Bantarjati', '6281100000101'), branch('cibubur', 'Cibubur', '6281100000202')];
const CTA: ImageAsset = { src: '/uploads/cta/cta.webp', alt: 'CTA', width: 1920, height: 1080 };

const entry = (extra: Partial<ShoeCareEntry> = {}): ShoeCareEntry =>
  shoeCareSchema.parse({
    enabled: true,
    branchSlug: 'bogor-bantarjati',
    name: 'Cuci Sepatu Uji',
    tagline: 'Sepatu bersih sambil potong rambut.',
    aboutParagraphs: ['Paragraf satu.', 'Paragraf dua.'],
    advantages: [
      { title: 'Teliti', description: 'Dikerjakan satu per satu.', icon: 'check' },
      { title: 'Cepat', description: 'Estimasi jelas.', icon: 'clock' },
    ],
    services: [
      { name: 'Deep Clean', estimate: '±2 hari', icon: 'wash', order: 1 },
      { name: 'Fast Clean', order: 2 },
      { name: 'Unyellowing', isActive: false },
    ],
    ...extra,
  });
const build = (p: ShoeCareEntry | null = entry()) => buildShoeCare(p, BRANCHES, shoeCareCopy, CTA);
const wa = (href: string) => {
  const url = new URL(href);
  return { number: url.pathname.slice(1), text: url.searchParams.get('text') ?? '' };
};
const page = (p = entry()) => renderToStaticMarkup(createElement(ShoeCarePageView, { data: build(p)!, branch: BRANCHES[0], otherBranch: false }));

describe('data halaman Cuci Sepatu', () => {
  it('tidak ada saat "Tampilkan halaman" mati, tanpa layanan tampil, atau cabang tidak ada', () => {
    expect(build(entry({ enabled: false }))).toBeNull();
    expect(build(entry({ services: [{ name: 'A', isActive: false, order: 0 }] }))).toBeNull();
    expect(build(entry({ branchSlug: 'depok' }))).toBeNull();
    expect(build(null)).toBeNull();
    expect(build()!.pageUrl).toBe('/cuci-sepatu/');
  });

  it('nomor WhatsApp partner; kosong → nomor cabang partner; pesan per layanan & umum ({partner} {service} {branch})', () => {
    expect(wa(build(entry({ whatsappNumber: '6281100000909' }))!.mainHref).number).toBe('6281100000909');
    expect(wa(build(entry({ whatsappNumber: '' }))!.mainHref).number).toBe('6281100000101');
    const data = build()!;
    expect(data.services.map((s) => s.name)).toEqual(['Deep Clean', 'Fast Clean']);
    expect(wa(data.services[0].href).text).toBe('Halo Cuci Sepatu Uji, saya mau pesan Deep Clean di Cutless Hair Studio cabang Bogor Bantarjati. (via website Cutless)');
    expect(wa(data.mainHref).text).toContain('pesan layanan cuci sepatu di');
    expect(wa(templateLink('081234', 'Halo {service}  ,  {branch}', { service: 'A', branch: 'B' })).text).toBe('Halo A, B');
  });

  it('harga opsional (gaya "K"); ikon/foto opsional; estimasi', () => {
    const [deep, fast] = build()!.services;
    expect(deep).toMatchObject({ icon: 'wash', estimate: '±2 hari', price: undefined });
    expect(fast.icon).toBeUndefined();
    const priced = build(entry({ services: [{ name: 'A', price: '45K' }, { name: 'B', price: '70-120k' }, { name: 'C', price: '7,5K' }, { name: 'D', price: '' }] }))!;
    expect(priced.services.map((s) => s.price)).toEqual(['45K', '70–120K', '7,5K', undefined]);
    expect(build(entry({ services: [{ name: 'Foto', image: '/uploads/shoe-care/a.webp', order: 0, isActive: true }] }))!.services[0].image?.src).toBe('/uploads/shoe-care/a.webp');
  });

  it('format harga: angka + K atau rentang dengan –/-; boleh kosong & 0K; selain itu ditolak', () => {
    expect(formatPriceText('45k')).toBe('45K');
    expect(formatPriceText('70 - 120K')).toBe('70–120K');
    expect(formatPriceText('70–120K')).toBe('70–120K');
    const ok = (price: string) => shoeCareSchema.safeParse({ ...entry(), services: [{ name: 'A', price }] }).success;
    for (const v of ['45K', '100K', '7,5K', '70–120K', '70-120K', '70 – 120K', '0K', '30k', '', '1111–1111K']) expect(ok(v), v).toBe(true);
    for (const v of ['45', 'Rp45.000', '45.000', '45 K', 'K', '45KK', '70–K', 'mulai 45K', '12345K', '1–2–3K']) expect(ok(v), v).toBe(false);
  });

  it('daftar menu: file PDF → Link Daftar Menu → tidak ada', () => {
    const pdf = '/uploads/shoe-care/daftar-menu.pdf';
    const link = 'https://drive.google.com/file/d/xyz/view';
    expect(build(entry({ menuFile: pdf, menuUrl: link }))!.menuUrl).toBe(pdf);
    expect(build(entry({ menuFile: '', menuUrl: link }))!.menuUrl).toBe(link);
    expect(build(entry({ menuFile: null, menuUrl: '' }))!.menuUrl).toBeUndefined();
    expect(shoeCareMenuUrl({ menuFile: undefined, menuUrl: undefined })).toBeUndefined();
    // Hanya PDF di folder media Partner Cuci Sepatu
    expect(shoeCareSchema.safeParse({ ...entry(), menuFile: '/uploads/shoe-care/menu.docx' }).success).toBe(false);
    expect(shoeCareSchema.safeParse({ ...entry(), menuFile: '/uploads/gallery/menu.pdf' }).success).toBe(false);
  });

  it('foto hero: CMS → foto hasil pertama → foto CTA', () => {
    expect(build(entry({ heroImage: '/uploads/shoe-care/hero.webp' }))!.heroImage.src).toBe('/uploads/shoe-care/hero.webp');
    expect(build(entry({ photos: [{ image: '/uploads/shoe-care/hasil.webp', alt: 'Hasil' }] }))!.heroImage.src).toBe('/uploads/shoe-care/hasil.webp');
    expect(build()!.heroImage.src).toBe(CTA.src);
  });

  it('About Us: judul (kosong → "Tentang [nama]"), paragraf, foto opsional', () => {
    expect(build()!.about.heading.title).toBe('Tentang Cuci Sepatu Uji');
    expect(build(entry({ aboutTitle: 'Kenalan dulu' }))!.about.heading.title).toBe('Kenalan dulu');
    expect(build()!.about.paragraphs).toEqual(['Paragraf satu.', 'Paragraf dua.']);
    expect(build(entry({ aboutParagraphs: [], description: 'Deskripsi uji.' }))!.about.paragraphs).toEqual(['Deskripsi uji.']);
  });
});

describe('tampilan halaman', () => {
  it('hero, About, layanan, CTA, lokasi; galeri hanya bila ada foto', () => {
    const html = page();
    expect(html).toContain('<h1 id="cuci-sepatu-title"');
    expect(html).toContain('Tersedia di Bogor Bantarjati');
    expect(html).toContain('Paragraf satu.');
    expect(html).toContain('Pesan via WhatsApp: Deep Clean');
    expect(html).toContain('Titip Sepatu via WhatsApp');
    expect(html).toContain('Jl. Uji No. 1');
    expect(html).not.toContain('id="galeri"');
    expect(page(entry({ photos: [{ image: '/uploads/shoe-care/h.webp', alt: 'Hasil satu' }] }))).toContain('Perbesar foto: Hasil satu');
  });

  it('kartu layanan: harga tampil; harga kosong → "Lihat di daftar menu" (link ke daftar menu, bila ada)', () => {
    const pdf = '/uploads/shoe-care/daftar-menu.pdf';
    const services = [{ name: 'Berharga', price: '45K' }, { name: 'Tanpa Harga' }];
    const html = page(entry({ services, menuFile: pdf }));
    expect(html).toMatch(/<span class="visually-hidden">Harga: <\/span><span[^>]*>45K<\/span>/);
    expect(html.match(/Lihat di daftar menu/g)).toHaveLength(1);
    expect(html).toMatch(/<a [^>]*href="\/uploads\/shoe-care\/daftar-menu\.pdf"[^>]*target="_blank"[^>]*>Lihat di daftar menu<\/a>/);
    expect(html).toContain('Layanan lain (paket kombinasi, tas, topi, dompet) ada di daftar menu.');
    // Tanpa daftar menu: tidak ada teks "Lihat di daftar menu" maupun ajakan layanan lain
    const none = page(entry({ services }));
    expect(none).toContain('45K');
    expect(none).not.toContain('Lihat di daftar menu');
    expect(none).not.toContain('Layanan lain');
  });

  it('tombol "Lihat Daftar Menu": tab baru (noopener noreferrer), tidak tampil bila link kosong', () => {
    expect(page()).not.toContain('Lihat Daftar Menu');
    const withMenu = entry({ menuUrl: 'https://drive.google.com/file/d/xyz/view' });
    const html = page(withMenu);
    expect(html.match(/Lihat Daftar Menu/g)).toHaveLength(2); // hero + bawah layanan
    expect(html).toMatch(/<a [^>]*href="https:\/\/drive\.google\.com\/file\/d\/xyz\/view"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
    expect(renderToStaticMarkup(createElement(MenuButton, { data: build()!, variant: 'light' }))).toBe('');
  });
});

describe('teaser & navigasi mengikuti toggle', () => {
  it('teaser: judul, nama + tagline, tombol "Lihat Layanan" ke /cuci-sepatu/; ikut "Tampilkan teaser di beranda"', () => {
    const data = build()!;
    expect(data.showTeaser).toBe(true);
    expect(build(entry({ showTeaser: false }))!.showTeaser).toBe(false);
    const html = renderToStaticMarkup(createElement(ShoeCareTeaserView, { data, href: '/cuci-sepatu/' }));
    expect(html).toContain('Cuci Sepatu');
    expect(html).toContain('Cuci Sepatu Uji');
    expect(html).toContain('Sepatu bersih sambil potong rambut.');
    expect(html).toMatch(/<a [^>]*href="\/cuci-sepatu\/"[^>]*>.*Lihat Layanan/);
    // Halaman cabang lain → teaser tidak tampil
    expect(shoeCarePlacement('bogor-bantarjati', { pageSlug: 'cibubur' })).toBe('hidden');
    expect(shoeCarePlacement('bogor-bantarjati', { pageSlug: 'bogor-bantarjati' })).toBe('available');
    expect(shoeCarePlacement('bogor-bantarjati', {})).toBe('available');
  });

  it('menu HP & footer: "Cuci Sepatu" → /cuci-sepatu/, hanya saat halaman aktif', () => {
    const settings = { siteName: 'Cutless', siteUrl: '', mainWhatsappNumber: '62811', showTestimonials: false, showProducts: true, showBeforeAfter: false } as never;
    expect(buildSite(settings, site, BRANCHES, { shoeCare: false }).nav.some((n) => n.href === '/cuci-sepatu/')).toBe(false);
    expect(buildSite(settings, site, BRANCHES, { shoeCare: true }).nav.find((n) => n.href === '/cuci-sepatu/')).toMatchObject({ label: 'Cuci Sepatu', desktop: false });
  });

  it('halaman mati → /cuci-sepatu dialihkan 301 ke beranda & tidak masuk sitemap', () => {
    expect(shoeCareVisible(entry(), BRANCHES)).toBe(true);
    expect(shoeCareVisible(entry({ enabled: false }), BRANCHES)).toBe(false);
    expect(shoeCareVisible(entry({ branchSlug: 'depok' }), BRANCHES)).toBe(false);
    expect(shoeCareRedirects(true)).toEqual([]);
    expect(shoeCareRedirects(false).map((r) => r.split(/\s+/))).toEqual([
      ['/cuci-sepatu', '/', '301'],
      ['/cuci-sepatu/*', '/', '301'],
    ]);
  });
});

describe('SEO halaman', () => {
  it('title, meta description (tagline + layanan) ≤ 160, gambar OG', () => {
    expect(shoeCareTitle(entry(), 'Bogor Bantarjati')).toBe('Cuci Sepatu Cuci Sepatu Uji di Cutless Bogor Bantarjati');
    expect(shoeCareDescription(entry(), 'Bogor Bantarjati')).toBe('Sepatu bersih sambil potong rambut. Layanan: Deep Clean dan Fast Clean.');
    expect(shoeCareDescription(entry({ tagline: '' }), 'Bogor Bantarjati')).toBe('Cuci sepatu Cuci Sepatu Uji di Cutless Bogor Bantarjati. Layanan: Deep Clean dan Fast Clean.');
    const many = entry({ tagline: 'x'.repeat(110), services: Array.from({ length: 8 }, (_, i) => ({ name: `Layanan Panjang Nomor ${i + 1}`, order: i, isActive: true })) });
    expect(shoeCareDescription(many, 'Bogor Bantarjati').length).toBeLessThanOrEqual(160);
    expect(shoeCareImage(entry({ heroImage: '/uploads/shoe-care/h.webp' }), '/c.webp')).toBe('/uploads/shoe-care/h.webp');
    expect(shoeCareImage(entry({ photos: [{ image: '/uploads/shoe-care/p.webp', alt: 'p' }] }), '/c.webp')).toBe('/uploads/shoe-care/p.webp');
    expect(shoeCareImage(entry(), '/c.webp')).toBe('/c.webp');
  });
});

describe('CMS Partner Cuci Sepatu', () => {
  const config = parse(readFileSync('.pages.yml', 'utf8')) as { media: CmsMedia[]; content: { name: string; path: string; fields: CmsField[] }[] };
  const cms = config.content.find((c) => c.path === 'src/content/shoeCare.json')!;
  const raw = JSON.parse(readFileSync('src/content/shoeCare.json', 'utf8'));
  const f = (path: string) => path.split('.').reduce<CmsField | undefined>((acc, n) => (acc ? acc.fields : cms.fields)?.find((x) => x.name === n), undefined)!;

  it('label & field baru, batas karakter, harga & PDF daftar menu', () => {
    expect(f('enabled')).toMatchObject({ label: 'Tampilkan halaman', default: false });
    expect(f('showTeaser')).toMatchObject({ label: 'Tampilkan teaser di beranda', type: 'boolean', default: true });
    expect(f('heroImage')).toMatchObject({ label: 'Foto hero', type: 'image' });
    expect(f('aboutTitle').options?.maxlength).toBe(60);
    expect(f('aboutParagraphs')).toMatchObject({ list: { max: 3 } });
    expect(f('aboutParagraphs').required).toBeFalsy();
    expect(f('aboutParagraphs').options?.maxlength).toBe(400);
    expect(f('aboutImage').type).toBe('image');
    expect(f('aboutImageAlt').options?.maxlength).toBe(150);
    expect(f('menuUrl').label).toBe('Link Daftar Menu');
    expect(f('services.icon').type).toBe('select');
    expect(f('services.image').type).toBe('image');
    expect(f('services.price')).toMatchObject({ label: 'Harga', type: 'string', options: { maxlength: 20 } });
    expect(f('services.price').required).toBeFalsy();
    // Pattern CMS = pattern Zod, dibungkus (...)? agar boleh kosong
    expect((f('services.price').pattern as { regex: string }).regex).toBe(`^(${SHOE_CARE_PRICE_PATTERN.source.slice(1, -1)})?$`);
    expect(f('menuFile')).toMatchObject({ label: 'File daftar menu (PDF)', type: 'file', options: { media: 'shoe-care-menu', extensions: ['pdf'] } });
    expect(config.media.find((m) => m.name === 'shoe-care-menu')).toMatchObject({ input: 'public/uploads/shoe-care', output: '/uploads/shoe-care', extensions: ['pdf'] });
  });

  it('form CMS & Zod sepakat: harga dan file PDF (data uji)', () => {
    setMedia(config.media);
    // Data uji (bukan shoeCare.json, yang bisa berubah dari CMS kapan saja)
    const base = { ...entry(), services: [{ name: 'A', isActive: true, order: 0 }] };
    const both = (patch: Record<string, unknown>) => {
      const content = { ...base, ...patch };
      return { cms: validateCmsContent(cms, content).length === 0, zod: shoeCareSchema.safeParse(content).success };
    };
    const price = (p: string) => both({ services: [{ name: 'A', price: p, isActive: true, order: 0 }] });
    for (const v of ['45K', '70–120K', '70-120k', '0K', '']) expect(price(v), v).toEqual({ cms: true, zod: true });
    for (const v of ['45', 'Rp45.000', '45 K', '1111–1111K' + 'x'.repeat(10)]) expect(price(v), v).toEqual({ cms: false, zod: false });
    expect(both({ menuFile: '/uploads/shoe-care/daftar-menu.pdf' })).toEqual({ cms: true, zod: true });
    expect(both({ menuFile: '/uploads/shoe-care/foto.webp' })).toEqual({ cms: false, zod: false });
    expect(both({ menuFile: '/uploads/gallery/daftar-menu.pdf' })).toEqual({ cms: false, zod: false });
    expect(both({ menuFile: '' })).toEqual({ cms: true, zod: true });
  });

  it('isi saat ini lolos form & Zod; isian tidak valid ditolak', () => {
    setMedia(config.media);
    expect(validateCmsContent(cms, raw)).toEqual([]);
    expect(shoeCareSchema.safeParse(raw).success).toBe(true);
    expect(validateCmsContent(cms, { ...raw, menuUrl: 'http://drive.google.com/x' })[0]).toMatch(/menuUrl/);
    expect(validateCmsContent(cms, { ...raw, menuUrl: 'https://drive.google.com/drive/folders/abc' })).toEqual([]);
    expect(shoeCareSchema.safeParse({ ...raw, menuUrl: 'drive.google.com/x' }).success).toBe(false);
    // Boleh kosong (bukan field wajib; editor lama tidak menolak Save) → About memakai Deskripsi singkat
    expect(validateCmsContent(cms, { ...raw, aboutParagraphs: [] })).toEqual([]);
    expect(shoeCareSchema.safeParse({ ...raw, aboutParagraphs: undefined }).success).toBe(true);
    expect(validateCmsContent(cms, { ...raw, aboutParagraphs: ['a', 'b', 'c', 'd'] })[0]).toMatch(/maksimal 3/);
    expect(validateCmsContent(cms, { ...raw, aboutParagraphs: ['x'.repeat(401)] })[0]).toMatch(/lebih dari 400/);
    expect(validateCmsContent(cms, { ...raw, aboutTitle: 'x'.repeat(61) })[0]).toMatch(/lebih dari 60/);
    // Foto About Us tanpa deskripsi ditolak Zod
    expect(shoeCareSchema.safeParse({ ...raw, aboutImage: '/uploads/shoe-care/a.webp', aboutImageAlt: '' }).success).toBe(false);
    expect(shoeCareSchema.safeParse({ ...raw, aboutImage: '/uploads/shoe-care/a.webp', aboutImageAlt: 'Partner di studio' }).success).toBe(true);
    // Template: {partner} {service} {branch} saja
    expect(shoeCareSchema.safeParse({ ...raw, messageTemplate: 'Halo {brand}' }).success).toBe(false);
  });
});

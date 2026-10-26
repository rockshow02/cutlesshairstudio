/**
 * GEO (mudah dibaca & dikutip asisten AI): FAQ (skema, item tampil, JSON-LD FAQPage, akordeon), ringkasan statis
 * beranda, /llms.txt dari konten, robots.txt mengizinkan bot AI, sitemap dengan lastmod. Data uji sendiri.
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { branchSchema, crossCheck, faqSchema, pricingItemSchema, type ContentBundle, type FaqEntry } from '../src/content/schema';
import { activeFaqItems, faqPageJsonLd } from '../src/content/faqSeo';
import { buildFaq } from '../src/lib/contentTransforms';
import { FaqView } from '../src/components/sections/Faq';
import { cabangIndexBody, homeBody, hoursSummary, llmsTxt, robots, sitemap } from '../scripts/vite-content-plugin';
import { setMedia, validateCmsContent, type CmsField, type CmsMedia } from './helpers/pagesCms';

const faq = (extra: Partial<FaqEntry> = {}): FaqEntry =>
  faqSchema.parse({
    enabled: true,
    kicker: 'FAQ',
    title: 'Pertanyaan uji',
    items: [
      { question: 'Kedua?', answer: 'Jawaban kedua.', order: 20 },
      { question: 'Pertama?', answer: 'Jawaban pertama.', order: 10 },
      { question: 'Nonaktif?', answer: 'Tidak tampil.', isActive: false, order: 30 },
      { question: 'Belum dijawab?', order: 40 },
    ],
    ...extra,
  });

const everyDay = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((day) => ({ day, openTime: '09:00', closeTime: '21:00', isClosed: false }));
const branch = (slug: string, name: string, extra: Record<string, unknown> = {}) =>
  branchSchema.parse({ slug, name, city: name, province: 'Jawa Barat', address: `Jl. Uji ${name} No. 1`, whatsappNumber: '6281100000101', openingHours: everyDay, googleMapsUrl: `https://maps.app.goo.gl/${slug}`, ...extra });

const bundle = (f: FaqEntry = faq(), extra: Partial<ContentBundle> = {}) =>
  ({
    settings: { siteUrl: 'https://cutlesshairstudio.com', siteName: 'Cutless Uji', mainWhatsappNumber: '6281100000909', email: 'halo@uji.test', instagramUrl: 'https://www.instagram.com/uji/', tiktokUrl: '', showProducts: false },
    branches: [branch('bogor-bantarjati', 'Bogor Bantarjati'), branch('cibubur', 'Cibubur')],
    pricing: [pricingItemSchema.parse({ name: 'Haircut Uji', category: 'Haircut', price: 100000 }), pricingItemSchema.parse({ name: 'Wash Uji', category: 'Special Treatment', price: 30000 })],
    shoeCare: { enabled: false, branchSlug: 'bogor-bantarjati', services: [] },
    hero: { kicker: 'Hair studio · {cities}', titleLines: ['Cut Less.', 'Style More.'], subtitle: 'Subjudul uji.' },
    faq: f,
    ...extra,
  }) as unknown as ContentBundle;

describe('FAQ', () => {
  it('skema: pertanyaan ≤ 120, jawaban ≤ 500 (boleh kosong), maks. 12 item, default mati', () => {
    expect(faqSchema.parse({ title: 'X' }).enabled).toBe(false);
    expect(faqSchema.safeParse({ title: 'X', items: [{ question: 'q'.repeat(120), answer: 'a'.repeat(500) }] }).success).toBe(true);
    expect(faqSchema.safeParse({ title: 'X', items: [{ question: 'q'.repeat(121) }] }).success).toBe(false);
    expect(faqSchema.safeParse({ title: 'X', items: [{ question: 'Q?', answer: 'a'.repeat(501) }] }).success).toBe(false);
    expect(faqSchema.safeParse({ title: 'X', items: Array.from({ length: 13 }, (_, i) => ({ question: `Q${i}?` })) }).success).toBe(false);
  });

  it('item tampil: aktif & berjawaban, urut Urutan; mati / kosong → bagian tidak ada', () => {
    expect(activeFaqItems(faq()).map((i) => i.question)).toEqual(['Pertama?', 'Kedua?']);
    expect(activeFaqItems(faq({ enabled: false }))).toEqual([]);
    expect(buildFaq(faq({ enabled: false }))).toBeNull();
    expect(buildFaq(faq({ items: [{ question: 'Belum?', isActive: true, order: 0 }] }))).toBeNull();
    expect(buildFaq(faq())!.items.map((i) => i.answer)).toEqual(['Jawaban pertama.', 'Jawaban kedua.']);
  });

  it('JSON-LD FAQPage dari item tampil; null saat mati', () => {
    expect(faqPageJsonLd(faq(), 'https://cutlesshairstudio.com/')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': 'https://cutlesshairstudio.com/#faq',
      url: 'https://cutlesshairstudio.com/',
      mainEntity: [
        { '@type': 'Question', name: 'Pertama?', acceptedAnswer: { '@type': 'Answer', text: 'Jawaban pertama.' } },
        { '@type': 'Question', name: 'Kedua?', acceptedAnswer: { '@type': 'Answer', text: 'Jawaban kedua.' } },
      ],
    });
    expect(faqPageJsonLd(faq({ enabled: false }), 'https://x/')).toBeNull();
  });

  it('akordeon: <details>/<summary>, jawaban ada di DOM walau tertutup', () => {
    const html = renderToStaticMarkup(createElement(FaqView, { data: buildFaq(faq())! }));
    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html).toMatch(/<summary[^>]*><span>Pertama\?<\/span>/);
    expect(html).toContain('Jawaban pertama.');
    expect(html).not.toContain('Nonaktif?');
    expect(html).not.toContain('Belum dijawab?');
  });

  it('pemeriksaan launch: FAQ aktif dengan pertanyaan aktif tanpa jawaban ditandai; FAQ mati tidak', () => {
    const launch = (f: FaqEntry) =>
      crossCheck({ ...bundle(f), settings: { ...bundle(f).settings, stats: {}, siteUrl: 'https://cutlesshairstudio.com' }, barbers: [], gallery: [], promos: [], announcements: [], testimonials: [], products: [], partners: { enabled: false, logos: [] }, services: [], hero: {}, about: {}, studio: {}, cta: {}, shoeCare: { enabled: false, branchSlug: 'bogor-bantarjati', services: [] } } as unknown as ContentBundle).launch.filter((i) => i.file === 'faq.json');
    expect(launch(faq()).map((i) => i.where)).toEqual(['pertanyaan 4 "Belum dijawab?"']);
    expect(launch(faq({ enabled: false }))).toEqual([]);
  });

  // Tidak memeriksa nilai faq.json (Tampilkan FAQ, jawaban): admin mengubahnya kapan saja lewat CMS. Aturan "item aktif
  // tanpa jawaban" diuji dengan data uji di "pemeriksaan launch" di atas.
  it('CMS: batas & toggle sama dengan Zod; isi faq.json saat ini bisa disimpan form CMS', () => {
    const config = parse(readFileSync('.pages.yml', 'utf8')) as { media: CmsMedia[]; content: { path: string; fields: CmsField[] }[] };
    const cms = config.content.find((c) => c.path === 'src/content/faq.json')!;
    const f = (n: string) => cms.fields.find((x) => x.name === n)! as CmsField & { label: string; default?: unknown };
    expect(f('enabled')).toMatchObject({ label: 'Tampilkan FAQ', type: 'boolean', default: false });
    expect(f('items')).toMatchObject({ list: { max: 12 } });
    expect(f('items').fields!.find((x) => x.name === 'question')).toMatchObject({ required: true, options: { maxlength: 120 } });
    expect(f('items').fields!.find((x) => x.name === 'answer')).toMatchObject({ options: { maxlength: 500 } });
    const raw = JSON.parse(readFileSync('src/content/faq.json', 'utf8'));
    setMedia(config.media);
    expect(validateCmsContent(cms, raw)).toEqual([]);
  });
});

describe('konten statis untuk crawler & asisten AI', () => {
  it('jam buka ringkas: "Setiap hari" bila semua hari sama, selain itu per hari', () => {
    expect(hoursSummary(branch('a', 'A'))).toBe('Setiap hari 09.00–21.00');
    const sunday = everyDay.map((h) => (h.day === 'Minggu' ? { ...h, isClosed: true } : h));
    expect(hoursSummary(branch('a', 'A', { openingHours: sunday }))).toMatch(/^Senin 09\.00–21\.00, .*Minggu Tutup$/);
  });

  it('beranda & /cabang/: hanya teks yang terlihat pengunjung (hero, harga, FAQ, cabang tampilan awal, footer)', () => {
    // Hanya teks yang tampil setelah React (lihat e2e/static-content.spec.ts): hero, harga, FAQ, Lokasi, footer
    const html = homeBody(bundle());
    expect(html).toContain('<p>Hair studio · Bogor Bantarjati &amp; Cibubur</p><h1>Cut Less.<br />Style More.</h1><p>Subjudul uji.</p>');
    expect(html).toContain('<p>Berlaku di semua cabang</p><h3>Haircut</h3><ul><li><span>Haircut Uji</span> <span>100K</span></li></ul>');
    expect(html).toContain('<dt>Pertama?</dt><dd>Jawaban pertama.</dd>');
    expect(html).toContain('<li><a href="/cabang/cibubur/">Cibubur</a></li>');
    expect(html).toContain('<h3>Bogor Bantarjati</h3><p>Jl. Uji Bogor Bantarjati No. 1</p><p><a href="https://wa.me/6281100000101">0811-0000-0101</a></p>');
    expect(html).toContain('<tr><th>Senin</th><td>09.00 – 21.00</td></tr>');
    // Cabang kedua hanya tampil setelah tab dipilih → tidak masuk ringkasan; format khusus bot tidak ada
    expect(html).not.toContain('Jl. Uji Cibubur');
    for (const botOnly of ['barbershop &amp; hair studio di', 'mulai 100K', 'WhatsApp: +62', 'Jam buka:']) expect(html).not.toContain(botOnly);
    expect(homeBody(bundle(faq({ enabled: false })))).not.toContain('<dl>');
    expect(cabangIndexBody(bundle())).toContain('<li><p>Cibubur, Jawa Barat</p><h2><a href="/cabang/cibubur/">Cibubur</a></h2><p>Jl. Uji Cibubur No. 1</p></li>');
  });

  it('/llms.txt dari konten: cabang, alamat, jam buka, WhatsApp, Maps, halaman penting, FAQ, kontak', () => {
    const txt = llmsTxt(bundle());
    expect(txt.startsWith('# Cutless Uji\n\n> ')).toBe(true);
    for (const part of ['### Cutless Uji Bogor Bantarjati', '- Alamat: Jl. Uji Cibubur No. 1', '- Jam buka: Setiap hari 09.00–21.00', '- WhatsApp: +6281100000101', '- Google Maps: https://maps.app.goo.gl/cibubur', '- [Semua cabang](https://cutlesshairstudio.com/cabang/)', '- Haircut: mulai 100K', '### Pertama?', '- Email: halo@uji.test']) {
      expect(txt, part).toContain(part);
    }
    expect(txt).not.toContain('/produk/');
    expect(llmsTxt(bundle(faq({ enabled: false })))).not.toContain('## FAQ');
  });

  it('robots.txt produksi tidak memblokir bot AI (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, ...)', () => {
    const txt = robots(bundle(), true);
    expect(txt).toMatch(/^User-agent: \*\nAllow: \/\n/);
    expect(txt).not.toMatch(/Disallow/);
    for (const bot of ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Applebot']) expect(txt).not.toContain(bot);
  });

  it('sitemap.xml: setiap URL punya lastmod', () => {
    const xml = sitemap(bundle());
    const urls = xml.match(/<url>.*?<\/url>/g)!;
    expect(urls.length).toBeGreaterThanOrEqual(4);
    for (const u of urls) expect(u).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  });
});

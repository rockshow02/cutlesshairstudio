/** Pita logo partner (beranda): tidak dirender saat kosong/dimatikan, fallback nama, mode statis 1–2 logo, CMS. */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { partnersSchema, type PartnersEntry } from '../src/content/schema';
import { buildPartnerLogos } from '../src/lib/contentTransforms';
import { PartnerStrip } from '../src/components/sections/PartnerLogos';
import { setMedia, validateCmsContent, type CmsField, type CmsMedia } from './helpers/pagesCms';

const logo = (name: string, extra: Partial<PartnersEntry['logos'][number]> = {}) => ({
  name,
  logo: `/uploads/partner-logos/${name.toLowerCase().replace(/\s+/g, '-')}.webp`,
  url: '',
  isActive: true,
  order: 0,
  ...extra,
});
const entry = (logos: PartnersEntry['logos'], extra: Partial<PartnersEntry> = {}): PartnersEntry => ({ enabled: true, label: '', logos, ...extra });
const build = (p: PartnersEntry) => buildPartnerLogos(p, 'Cutless Hair Studio');
const html = (p: PartnersEntry) => renderToStaticMarkup(createElement(PartnerStrip, { data: build(p) }));

describe('pita logo partner', () => {
  it('tidak dirender saat kosong, semua logo disembunyikan, atau section dimatikan', () => {
    expect(build(entry([]))).toBeNull();
    expect(build(entry([logo('Satu', { isActive: false })]))).toBeNull();
    expect(build(entry([logo('Satu')], { enabled: false }))).toBeNull();
    expect(html(entry([]))).toBe('');
    expect(html(entry([logo('Satu')], { enabled: false }))).toBe('');
    // partners.json saat ini (daftar kosong) → tidak ada pita
    const current = partnersSchema.parse(JSON.parse(readFileSync('src/content/partners.json', 'utf8')));
    expect(build(current)).toBeNull();
  });

  it('logo kosong → nama partner sebagai teks; logo ada → <img> dengan alt nama partner', () => {
    const out = html(entry([logo('Brand Uji', { logo: '' }), logo('Studio Uji')]));
    expect(out).toContain('>Brand Uji</span>');
    expect(out).toMatch(/<img[^>]+alt="Studio Uji"[^>]*loading="lazy"/);
    expect(out).not.toMatch(/alt="Brand Uji"/);
    expect(build(entry([logo('A', { logo: null })]))!.items[0].logo).toBeNull();
  });

  it('1–2 logo: statis tanpa animasi; 3+: berjalan', () => {
    expect(build(entry([logo('A')]))!.animated).toBe(false);
    expect(build(entry([logo('A'), logo('B')]))!.animated).toBe(false);
    expect(build(entry([logo('A'), logo('B'), logo('C')]))!.animated).toBe(true);
    const two = html(entry([logo('A'), logo('B')]));
    expect(two).toContain('data-partner-strip="static"');
    expect(two).not.toContain('--marquee-duration');
    const three = html(entry([logo('A'), logo('B'), logo('C')]));
    expect(three).toContain('data-partner-strip="marquee"');
    expect(three).toContain('--marquee-duration');
  });

  it('hanya yang tampil, urut; link https → tab baru; aria-label & label kecil', () => {
    const data = build(entry([logo('B', { order: 2, url: 'https://contoh.id' }), logo('A', { order: 1 }), logo('X', { isActive: false })], { label: 'Partner & Kolaborasi' }))!;
    expect(data.items.map((i) => i.name)).toEqual(['A', 'B']);
    expect(data.ariaLabel).toBe('Partner Cutless Hair Studio');
    const out = renderToStaticMarkup(createElement(PartnerStrip, { data }));
    expect(out).toContain('aria-label="Partner Cutless Hair Studio"');
    expect(out).toContain('Partner &amp; Kolaborasi');
    expect(out).toMatch(/<a [^>]*href="https:\/\/contoh\.id"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
    expect(out.match(/<a /g)).toHaveLength(1);
    // Label kosong → tidak ada elemen label
    expect(html(entry([logo('A')]))).not.toContain('<p');
  });
});

describe('CMS Logo Partner', () => {
  const config = parse(readFileSync('.pages.yml', 'utf8')) as { media: CmsMedia[]; content: { name: string; path: string; fields: CmsField[] }[] };
  const cms = config.content.find((c) => c.path === 'src/content/partners.json')!;
  const raw = JSON.parse(readFileSync('src/content/partners.json', 'utf8'));

  it('koleksi "Logo Partner": batas karakter, folder media, isi saat ini lolos form', () => {
    expect(cms.name).toBe('partners');
    const f = (name: string) => cms.fields.find((x) => x.name === name)!;
    expect(f('label').options?.maxlength).toBe(40);
    expect(f('logos').fields!.find((x) => x.name === 'name')!.options?.maxlength).toBe(60);
    expect(f('logos').fields!.find((x) => x.name === 'logo')!.options?.media).toBe('partner-logos');
    setMedia(config.media);
    expect(validateCmsContent(cms, raw)).toEqual([]);
    // Tanpa seed brand nyata
    expect(raw.logos).toEqual([]);
  });

  it('form & Zod menolak isian yang tidak valid', () => {
    setMedia(config.media);
    const ok = logo('Brand Uji', { url: 'https://contoh.id' });
    expect(validateCmsContent(cms, { ...raw, logos: [ok] })).toEqual([]);
    expect(validateCmsContent(cms, { ...raw, logos: [{ name: 'Tanpa Logo' }] })).toEqual([]);
    expect(validateCmsContent(cms, { ...raw, logos: [{ ...ok, url: 'http://contoh.id' }] })[0]).toMatch(/url/);
    expect(validateCmsContent(cms, { ...raw, logos: [{ ...ok, name: 'x'.repeat(61) }] })[0]).toMatch(/lebih dari 60/);
    expect(validateCmsContent(cms, { ...raw, label: 'x'.repeat(41) })[0]).toMatch(/lebih dari 40/);
    expect(validateCmsContent(cms, { ...raw, logos: [{ ...ok, logo: '/uploads/gallery/a.webp' }] })[0]).toMatch(/partner-logos/);
    expect(partnersSchema.safeParse({ ...raw, logos: [{ ...ok, url: 'http://contoh.id' }] }).success).toBe(false);
    expect(partnersSchema.safeParse({ ...raw, logos: [{ ...ok, name: '' }] }).success).toBe(false);
    expect(partnersSchema.safeParse({ ...raw, label: 'x'.repeat(41) }).success).toBe(false);
    expect(partnersSchema.safeParse({ logos: [{ name: 'Tanpa Logo' }] }).success).toBe(true);
  });
});

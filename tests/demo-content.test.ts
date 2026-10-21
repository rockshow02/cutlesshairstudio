/** Data demo (isDemo): badge DEMO di staging/dev, build produksi (mode ketat) menolak data demo yang tayang. */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { CONTENT_FILES, crossCheck, partnersSchema, shoeCareSchema, type ContentBundle } from '../src/content/schema';
import { shoeCareCopy } from '../src/content/shoeCare';
import { buildPartnerLogos, buildShoeCare } from '../src/lib/contentTransforms';
import { PartnerStrip } from '../src/components/sections/PartnerLogos';
import { ShoeCareView } from '../src/components/sections/ShoeCare';
import type { Branch } from '../src/types';
import type { CmsField } from './helpers/pagesCms';

// Struktur bundle dari file konten; bagian yang diuji (shoeCare, partners) selalu data uji sendiri
const base = Object.fromEntries(
  Object.entries(CONTENT_FILES).map(([file, schema]) => [file.replace('.json', ''), schema.parse(JSON.parse(readFileSync(`src/content/${file}`, 'utf8')))]),
) as unknown as ContentBundle;
const slug = base.branches[0].slug;
const shoe = (extra: Record<string, unknown> = {}) =>
  shoeCareSchema.parse({
    enabled: true,
    branchSlug: slug,
    name: 'Cuci Sepatu Uji',
    advantages: [
      { title: 'A', description: 'a' },
      { title: 'B', description: 'b' },
    ],
    services: [{ name: 'Fast Clean', price: 35000 }],
    ...extra,
  });
const partners = (logos: Record<string, unknown>[], extra: Record<string, unknown> = {}) => partnersSchema.parse({ enabled: true, logos, ...extra });
const demoIssues = (bundle: Partial<ContentBundle>) =>
  crossCheck({ ...base, shoeCare: shoe({ enabled: false }), partners: partners([]), ...bundle }).launch.filter((i) => i.message.includes('data demo'));

describe('data demo: build produksi (mode ketat) menolak data demo yang tayang', () => {
  it('Partner Cuci Sepatu demo yang tampil → masalah launch dengan pesan jelas', () => {
    const issues = demoIssues({ shoeCare: shoe({ isDemo: true }) });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ file: 'shoeCare.json', where: 'Partner Cuci Sepatu "Cuci Sepatu Uji"' });
    expect(issues[0].message).toMatch(/hapus atau matikan "Data demo"/);
    // Section mati / bukan demo → aman
    expect(demoIssues({ shoeCare: shoe({ isDemo: true, enabled: false }) })).toEqual([]);
    expect(demoIssues({ shoeCare: shoe({ isDemo: false }) })).toEqual([]);
  });

  it('logo partner demo yang tampil → masalah launch per logo', () => {
    const logos = [
      { name: 'Partner Demo A', isDemo: true },
      { name: 'Partner Demo B', isDemo: true, isActive: false },
      { name: 'Partner Asli' },
    ];
    expect(demoIssues({ partners: partners(logos) }).map((i) => i.where)).toEqual(['logo "Partner Demo A"']);
    expect(demoIssues({ partners: partners(logos, { enabled: false }) })).toEqual([]);
    expect(demoIssues({ partners: partners([{ name: 'Partner Asli' }]) })).toEqual([]);
  });

  it('isDemo bawaan false (isian lama tanpa field tetap bukan demo)', () => {
    expect(shoe().isDemo).toBe(false);
    expect(partners([{ name: 'X' }]).logos[0].isDemo).toBe(false);
  });
});

const BRANCHES = [{ slug, name: base.branches[0].name, city: '', whatsappNumber: '6281100000101', pageUrl: `/cabang/${slug}/`, bookable: true } as unknown as Branch];

describe('badge DEMO', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('tampil di staging/development pada isian demo saja', () => {
    const strip = renderToStaticMarkup(
      createElement(PartnerStrip, { data: buildPartnerLogos(partners([{ name: 'Partner Demo A', isDemo: true }, { name: 'Partner Asli' }]), 'Cutless') }),
    );
    expect(strip.match(/>Demo</g)).toHaveLength(1);
    const view = (isDemo: boolean) =>
      renderToStaticMarkup(createElement(ShoeCareView, { data: buildShoeCare(shoe({ isDemo }), BRANCHES, shoeCareCopy)!, otherBranch: false }));
    expect(view(true)).toContain('>Demo</span>');
    expect(view(false)).not.toContain('>Demo<');
  });

  it('tidak ada di build produksi', async () => {
    vi.stubEnv('VITE_APP_ENV', 'production');
    vi.resetModules();
    const { DemoBadge } = await import('../src/components/ui/DemoBadge');
    expect(renderToStaticMarkup(createElement(DemoBadge, { show: true }))).toBe('');
  });
});

describe('CMS: field "Data demo"', () => {
  const config = parse(readFileSync('.pages.yml', 'utf8')) as { content: { path: string; fields: CmsField[] }[] };
  const fields = (path: string) => config.content.find((c) => c.path === path)!.fields;
  it('ada di Partner Cuci Sepatu (section) & item Logo Partner, bawaan false, label jelas', () => {
    const shoeDemo = fields('src/content/shoeCare.json').find((f) => f.name === 'isDemo')!;
    const logoDemo = fields('src/content/partners.json').find((f) => f.name === 'logos')!.fields!.find((f) => f.name === 'isDemo')!;
    for (const f of [shoeDemo, logoDemo]) {
      expect(f).toMatchObject({ type: 'boolean', default: false, label: 'Data demo (hapus/matikan sebelum launch)' });
    }
  });
});

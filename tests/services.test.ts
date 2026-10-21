/** Kartu Layanan sinkron dengan Daftar Harga (data uji sendiri), meta description dari kategori aktif, CMS. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { CONTENT_FILES, crossCheck, pricingItemSchema, serviceCardSchema, type ContentBundle, type PricingEntry, type ServiceCardEntry } from '../src/content/schema';
import { servicesCopy } from '../src/content/services';
import { branchDescription, fitDescription, homeDescription, joinList, META_MAX, pricedServiceNames } from '../src/content/serviceSeo';
import { buildServices } from '../src/lib/contentTransforms';
import { setMedia, validateCmsContent, type CmsField, type CmsMedia } from './helpers/pagesCms';

const price = (name: string, category: string, value: number, extra: Record<string, unknown> = {}): PricingEntry =>
  pricingItemSchema.parse({ name, category, price: value, ...extra });
const card = (name: string, pricingCategory: string, extra: Record<string, unknown> = {}): ServiceCardEntry =>
  serviceCardSchema.parse({ name, description: `Deskripsi ${name}`, pricingCategory, ...extra });

const PRICING = [
  price('White Grooming', 'Haircut & Grooming', 100000),
  price('Black Grooming', 'Haircut & Grooming', 175000),
  price('Signature Haircut', 'Haircut & Grooming', 50000, { isActive: false }), // nonaktif: tidak dihitung
  price('Woman Catok', 'Wanita', 50000),
  price('Woman Haircut', 'Wanita', 150000),
  price('Cornrow Basic', 'Braids & Dreadlock', 350000),
  price('Hot Towel Shave', 'Shaving', 50000, { isActive: false }),
  price('Student Deal', 'Paket', 60000),
];
const CARDS = [
  card('Braids & Dreadlock', 'Braids & Dreadlock', { order: 30 }),
  card('Haircut & Grooming', 'Haircut & Grooming', { order: 10 }),
  card('Wanita', 'Wanita', { order: 20 }),
  card('Shaving & Beard', 'Shaving', { order: 40 }), // kategori tanpa item aktif
  card('Haircut + Wash', 'Haircut & Grooming', { order: 50, isActive: false }),
];

describe('kartu Layanan sinkron dengan Daftar Harga', () => {
  it('satu kartu per kategori dengan item aktif, urut, "mulai" = harga terendah item aktif', () => {
    const { items, heading } = buildServices(CARDS, servicesCopy, PRICING);
    expect(heading).toEqual(servicesCopy.heading);
    expect(items.map((s) => [s.name, s.startingPrice])).toEqual([
      ['Haircut & Grooming', 100000],
      ['Wanita', 50000],
      ['Braids & Dreadlock', 350000],
    ]);
    // Kartu kategori tanpa harga aktif & kartu Tampilkan=false tidak muncul
    expect(items.some((s) => s.name === 'Shaving & Beard' || s.name === 'Haircut + Wash')).toBe(false);
    expect(new Set(items.map((s) => s.id)).size).toBe(items.length);
  });

  it('harga khusus cabang ikut dipakai; tanpa cabang terpilih = terendah semua cabang', () => {
    const pricing = [price('White Grooming', 'Haircut & Grooming', 100000, { branchPrices: [{ branchSlug: 'cibubur', price: 120000 }] })];
    const at = (slug?: string) => buildServices([card('Haircut & Grooming', 'Haircut & Grooming')], servicesCopy, pricing, slug).items[0].startingPrice;
    expect(at('cibubur')).toBe(120000);
    expect(at('bogor-bantarjati')).toBe(100000);
    expect(at()).toBe(100000);
  });

  it('isi saat ini: setiap kategori berharga aktif punya tepat satu kartu tampil (tanpa masalah launch)', () => {
    const bundle = Object.fromEntries(
      Object.entries(CONTENT_FILES).map(([f, s]) => [f.replace('.json', ''), s.parse(JSON.parse(readFileSync(`src/content/${f}`, 'utf8')))]),
    ) as unknown as ContentBundle;
    expect(crossCheck(bundle).launch.filter((i) => i.file === 'services.json')).toEqual([]);
    // Pemeriksaan mendeteksi kategori tanpa kartu & kartu ganda
    const issues = (services: ServiceCardEntry[]) => crossCheck({ ...bundle, pricing: PRICING, services }).launch.filter((i) => i.file === 'services.json');
    expect(issues(CARDS)).toEqual([]);
    expect(issues(CARDS.filter((c) => c.name !== 'Wanita')).map((i) => i.where)).toEqual(['kategori "Wanita"']);
    expect(issues([...CARDS, card('Wanita Lagi', 'Wanita')])[0].message).toMatch(/lebih dari satu kartu/);
  });
});

describe('meta description dari kategori layanan aktif', () => {
  const names = pricedServiceNames(CARDS, PRICING);
  it('nama kartu tampil yang berharga aktif, urut', () => {
    expect(names).toEqual(['Haircut & Grooming', 'Wanita', 'Braids & Dreadlock']);
    expect(joinList(['A'])).toBe('A');
    expect(joinList(['A', 'B'])).toBe('A dan B');
    expect(joinList(['A', 'B', 'C'])).toBe('A, B, dan C');
  });

  it('beranda & cabang ≤ 160 karakter, menyebut kategori aktif', () => {
    const home = homeDescription('Cutless Hair Studio', 'Bogor', names);
    expect(home).toBe('Cutless Hair Studio, hair studio di Bogor: Haircut & Grooming, Wanita, dan Braids & Dreadlock. Booking via WhatsApp.');
    const branch = branchDescription('Cutless Hair Studio', 'Bogor Bantarjati', names, true);
    expect(branch).toContain('Haircut & Grooming, Wanita, dan Braids & Dreadlock');
    expect(branch).toContain('cuci sepatu');
    expect(branchDescription('Cutless', 'X', names, false)).not.toContain('cuci sepatu');
  });

  it('terlalu panjang → kategori belakang diganti "dan lainnya", tidak pernah lewat 160', () => {
    const many = ['Haircut & Grooming', 'Wanita', 'Treatment', 'Coloring', 'Perming', 'Braids & Dreadlock', 'Kids', 'Shaving & Beard'];
    const text = branchDescription('Cutless Hair Studio', 'Bogor Bantarjati', many, true);
    expect(text.length).toBeLessThanOrEqual(META_MAX);
    expect(text).toMatch(/^Cutless Hair Studio cabang Bogor Bantarjati: Haircut & Grooming, .*, dan lainnya\. Ada juga layanan cuci sepatu\. Booking via WhatsApp\.$/);
    for (let n = 0; n <= many.length; n++) {
      expect(homeDescription('Cutless Hair Studio', 'Bogor & Cibubur', many.slice(0, n)).length).toBeLessThanOrEqual(META_MAX);
    }
    expect(fitDescription('x'.repeat(200), ['A'], '.').length).toBeLessThanOrEqual(META_MAX);
  });
});

describe('CMS Kartu Layanan', () => {
  const config = parse(readFileSync('.pages.yml', 'utf8')) as { media: CmsMedia[]; content: { name: string; path: string; list?: boolean; fields: CmsField[] }[] };
  const cms = config.content.find((c) => c.path === 'src/content/services.json')!;
  const raw = JSON.parse(readFileSync('src/content/services.json', 'utf8')) as Record<string, unknown>[];

  it('koleksi ada, batas karakter, pilihan kategori tanpa Paket; isi saat ini lolos form', () => {
    expect(cms).toMatchObject({ name: 'services', label: 'Kartu Layanan', list: true });
    const f = (n: string) => cms.fields.find((x) => x.name === n)!;
    expect(f('name').options?.maxlength).toBe(40);
    expect(f('description').options?.maxlength).toBe(160);
    expect(f('pricingCategory').options?.values).not.toContain('Paket');
    setMedia(config.media);
    expect(validateCmsContent(cms, raw)).toEqual([]);
    const ok = { name: 'Uji', description: 'Deskripsi', pricingCategory: 'Wanita' };
    expect(validateCmsContent(cms, [{ ...ok, name: 'x'.repeat(41) }])[0]).toMatch(/lebih dari 40/);
    expect(validateCmsContent(cms, [{ ...ok, pricingCategory: 'Paket' }])[0]).toMatch(/pricingCategory: bukan pilihan/);
    expect(validateCmsContent(cms, [{ ...ok, description: '' }])[0]).toMatch(/description: wajib/);
    expect(serviceCardSchema.safeParse({ ...ok, description: 'x'.repeat(161) }).success).toBe(false);
    expect(serviceCardSchema.safeParse({ ...ok, pricingCategory: 'Paket' }).success).toBe(false);
  });
});

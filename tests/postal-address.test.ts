/**
 * Alamat cabang untuk JSON-LD HairSalon (Rich Results: postalCode): kolom Kode pos (5 digit), alamat lengkap dipecah
 * jadi streetAddress / addressLocality / addressRegion / postalCode. Data uji (bukan branches.json asli).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { branchSchema, type BranchEntry } from '../src/content/schema';
import { postalAddressParts } from '../src/content/postalAddress';
import { branchJsonLd } from '../scripts/vite-content-plugin';
import { contentFixture, rawFixture } from './helpers/contentFixture';
import { setMedia, validateCmsContent, type CmsField, type CmsMedia } from './helpers/pagesCms';

const CIBUBUR_FULL = 'Jl. Alternatif Cibubur No.87, Harjamukti, Kec. Cimanggis, Kota Depok, Jawa Barat 16454';
const BOGOR_FULL = 'Jl Pandawa Raya No.4 Blk B1, RT.07/RW.15, Bantarjati, Kec. Bogor Utara, Kota Bogor, Jawa Barat 16152';
const branch = (extra: Record<string, unknown> = {}): BranchEntry => branchSchema.parse({ ...rawFixture.branches[1], ...extra });

describe('alamat cabang → PostalAddress', () => {
  it('alamat lengkap dipecah: jalan + kelurahan + kecamatan / kota / provinsi / kode pos', () => {
    expect(postalAddressParts({ address: CIBUBUR_FULL, city: 'Cibubur', province: 'Jawa Barat' })).toEqual({
      streetAddress: 'Jl. Alternatif Cibubur No.87, Harjamukti, Kec. Cimanggis',
      addressLocality: 'Depok',
      addressRegion: 'Jawa Barat',
      postalCode: '16454',
    });
    expect(postalAddressParts({ address: BOGOR_FULL, city: 'Bogor', province: 'Jawa Barat' })).toEqual({
      streetAddress: 'Jl Pandawa Raya No.4 Blk B1, RT.07/RW.15, Bantarjati, Kec. Bogor Utara',
      addressLocality: 'Bogor',
      addressRegion: 'Jawa Barat',
      postalCode: '16152',
    });
  });

  it('alamat hanya jalan + kelurahan + kecamatan: kota & provinsi dari kolomnya, kode pos dari kolom Kode pos', () => {
    expect(postalAddressParts({ address: 'Jl. Alternatif Cibubur No.87, Harjamukti, Kec. Cimanggis', city: 'Depok', province: 'Jawa Barat', postalCode: '16454' })).toEqual({
      streetAddress: 'Jl. Alternatif Cibubur No.87, Harjamukti, Kec. Cimanggis',
      addressLocality: 'Depok',
      addressRegion: 'Jawa Barat',
      postalCode: '16454',
    });
    // Tanpa kode pos di mana pun → tidak ada postalCode (bukan string kosong)
    expect(postalAddressParts({ address: 'Jl. Uji No. 1, Kec. Uji', city: 'Bogor', province: 'Jawa Barat' })).not.toHaveProperty('postalCode');
    // Tanpa alamat → hanya kota & provinsi
    expect(postalAddressParts({ city: 'Bogor', province: 'Jawa Barat' })).toEqual({ addressLocality: 'Bogor', addressRegion: 'Jawa Barat' });
  });

  it('kolom Kode pos lebih diutamakan daripada angka di akhir alamat; variasi penulisan akhir alamat', () => {
    expect(postalAddressParts({ address: CIBUBUR_FULL, city: 'Cibubur', province: 'Jawa Barat', postalCode: '16455' }).postalCode).toBe('16455');
    const variants: [string, Partial<ReturnType<typeof postalAddressParts>>][] = [
      ['Jl. Uji 1, Kec. Cibinong, Kabupaten Bogor, Jawa Barat 16911', { addressLocality: 'Bogor', postalCode: '16911' }],
      ['Jl. Uji 1, Kec. Cibinong, Kab. Bogor, Provinsi Jawa Barat, 16911', { addressLocality: 'Bogor', postalCode: '16911' }],
      ['Jl. Uji 1, Kec. Cimanggis, Depok, Jawa Barat, Indonesia', { addressLocality: 'Depok' }],
      ['Jl. Uji 1, Kec. Cimanggis, Kota Depok 16454', { addressLocality: 'Depok', postalCode: '16454' }],
    ];
    for (const [address, expected] of variants) {
      const r = postalAddressParts({ address, city: 'Depok', province: 'Jawa Barat' });
      expect(r, address).toMatchObject({ streetAddress: address.split(',').slice(0, 2).join(',').trim(), ...expected });
    }
  });

  it('JSON-LD HairSalon: postalCode ada; streetAddress tidak mengulang kota, provinsi, atau kode pos', () => {
    for (const b of [branch({ address: CIBUBUR_FULL }), branch({ address: 'Jl. Alternatif Cibubur No.87, Harjamukti, Kec. Cimanggis', city: 'Depok', postalCode: '16454' })]) {
      const { address } = branchJsonLd(b, contentFixture()) as { address: Record<string, string> };
      expect(address).toEqual({
        '@type': 'PostalAddress',
        streetAddress: 'Jl. Alternatif Cibubur No.87, Harjamukti, Kec. Cimanggis',
        addressLocality: 'Depok',
        addressRegion: 'Jawa Barat',
        postalCode: '16454',
        addressCountry: 'ID',
      });
      for (const repeated of ['Depok', 'Jawa Barat', '16454']) expect(address.streetAddress).not.toContain(repeated);
    }
  });
});

describe('kolom Kode pos (Zod & form Pages CMS)', () => {
  const config = parse(readFileSync('.pages.yml', 'utf8')) as { media: CmsMedia[]; content: { name: string; fields: CmsField[] }[] };
  setMedia(config.media);
  const cms = config.content.find((c) => c.name === 'branches')!;

  it('opsional, 5 digit angka; form CMS & Zod menerima/menolak isian yang sama', () => {
    const field = cms.fields.find((f) => f.name === 'postalCode')! as CmsField & { label: string; description: string };
    expect(field).toMatchObject({ label: 'Kode pos', type: 'string' });
    expect(field.required).toBeFalsy();
    expect(field.description).toContain('16454');
    const both = (postalCode: unknown) => {
      const entry = { ...rawFixture.branches[1], postalCode };
      return { cms: validateCmsContent(cms, [entry]).length === 0, zod: branchSchema.safeParse(entry).success };
    };
    for (const ok of ['16454', ' 16454 ', '', null, undefined]) expect(both(ok), String(ok)).toEqual({ cms: true, zod: true });
    for (const bad of ['1645', '164540', '16-454', 'abcde', '16454a']) expect(both(bad), bad).toEqual({ cms: false, zod: false });
    expect(branchSchema.safeParse({ ...rawFixture.branches[1], postalCode: '1645' }).error?.issues[0].message).toBe('kode pos harus 5 digit angka, mis. 16454');
  });

  it('deskripsi Kota, Alamat lengkap, Kode pos menjelaskan isi tiap kolom dengan contoh', () => {
    const d = (n: string) => (cms.fields.find((f) => f.name === n) as CmsField & { description: string }).description;
    expect(d('city')).toMatch(/mis\. Depok/);
    expect(d('address')).toContain('Jl. Alternatif Cibubur No.87, Harjamukti, Kec. Cimanggis');
    expect(d('postalCode')).toMatch(/5 digit angka, mis\. 16454/);
  });
});

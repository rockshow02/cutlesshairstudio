/** Template pesan booking kapster (Pengaturan Situs): default persis, placeholder {brand}/{branch}/{barber}, batas 500. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { settingsSchema } from '../src/content/schema';
import { site } from '../src/content/site';
import { buildSite } from '../src/lib/contentTransforms';
import { bookingMessage } from '../src/lib/whatsapp';
import { setMedia, validateCmsContent, type CmsField, type CmsMedia } from './helpers/pagesCms';

const DEFAULT = [
  'Halo Kak! Untuk reservasi di {brand} cabang {branch}, mohon isi formulir berikut ya:',
  'Nama Lengkap:',
  'Nomor HP / WA:',
  'Hari & Tanggal:',
  'Jam Kedatangan:',
  'Pilihan Layanan: (mis. Haircut / Treatment / Coloring)',
  'Kapster Pilihan: {barber}',
  'Kirim kembali format ini jika sudah diisi, kami akan segera mengonfirmasi jadwalnya. 😊',
  'Catatan: Toleransi keterlambatan maks. 15 menit. Lewat dari itu, slot dialihkan ke antrean berikutnya. Terima kasih telah memilih {brand}!',
].join('\n');

const rawSettings = JSON.parse(readFileSync('src/content/settings.json', 'utf8'));
const settings = settingsSchema.parse(rawSettings);
const siteWith = (barberWaMessage: string | null) => buildSite({ ...settings, barberWaMessage }, site, []);

describe('template pesan booking kapster', () => {
  it('bawaan persis sesuai klien; dipakai bila field kosong; field CMS menimpa', () => {
    expect(site.whatsapp.templates.barber).toBe(DEFAULT);
    expect(siteWith('').whatsapp.templates.barber).toBe(DEFAULT);
    expect(siteWith(null).whatsapp.templates.barber).toBe(DEFAULT);
    expect(siteWith('Halo {brand}, booking {barber} di {branch}').whatsapp.templates.barber).toBe('Halo {brand}, booking {barber} di {branch}');
    // Tombol booking umum tetap pesan default yang lama
    expect(siteWith('X {barber}').whatsapp.templates.general).toBe(buildSite(settings, site, []).whatsapp.templates.general);
  });

  it('{barber} = nama barber yang diklik, {branch} = cabang barber itu, {brand} = nama usaha', () => {
    const s = siteWith(DEFAULT);
    const msg = bookingMessage(s, 'barber', { barber: 'Raka', branch: 'Cibubur' });
    expect(msg).toContain('Kapster Pilihan: Raka');
    expect(msg).toContain(`reservasi di ${s.brandName} cabang Cibubur`);
    expect(msg).toContain(`Terima kasih telah memilih ${s.brandName}!`);
    expect(msg).not.toMatch(/\{(brand|branch|barber)\}/);
  });

  it('validasi: maks. 500 karakter (hitungan JavaScript, emoji = 2) & hanya {brand} {branch} {barber}', () => {
    const ok = (v: string) => settingsSchema.safeParse({ ...rawSettings, barberWaMessage: v }).success;
    expect('😊'.length).toBe(2);
    expect(DEFAULT.length).toBeLessThanOrEqual(500);
    expect(ok(DEFAULT)).toBe(true);
    expect(ok('x'.repeat(500))).toBe(true);
    expect(ok(`${'x'.repeat(499)}😊`)).toBe(false); // 501 karena emoji dihitung 2
    expect(ok('Halo {nama}')).toBe(false);
    expect(ok('Halo {Barber}')).toBe(false);
    expect(ok('Halo {service}')).toBe(false);
    expect(ok('')).toBe(true);
  });

  it('pesan terisi nama barber & cabang terpanjang yang ada tetap ≤ 500 karakter', () => {
    const barbers = JSON.parse(readFileSync('src/content/barbers.json', 'utf8')) as { name: string }[];
    const branches = JSON.parse(readFileSync('src/content/branches.json', 'utf8')) as { name: string }[];
    const longest = (xs: { name: string }[]) => xs.map((x) => x.name).sort((a, b) => b.length - a.length)[0] ?? '';
    const s = siteWith(settings.barberWaMessage ?? null);
    const msg = bookingMessage(s, 'barber', { barber: longest(barbers), branch: longest(branches) });
    expect(msg).toContain(`Kapster Pilihan: ${longest(barbers)}`);
    expect(msg.length).toBeLessThanOrEqual(500);
  });

  it('CMS: field ada di Pengaturan Situs, maxlength 500, pola placeholder sama; isi saat ini lolos form', () => {
    const config = parse(readFileSync('.pages.yml', 'utf8')) as { media: CmsMedia[]; content: { path: string; fields: CmsField[] }[] };
    const cms = config.content.find((c) => c.path === 'src/content/settings.json')!;
    const f = cms.fields.find((x) => x.name === 'barberWaMessage')!;
    expect(f).toMatchObject({ label: 'Template pesan booking kapster', type: 'text' });
    expect(f.options?.maxlength).toBe(500);
    setMedia(config.media);
    expect(validateCmsContent(cms, rawSettings)).toEqual([]);
    expect(validateCmsContent(cms, { ...rawSettings, barberWaMessage: 'Halo {nama}' })[0]).toMatch(/barberWaMessage/);
    expect(validateCmsContent(cms, { ...rawSettings, barberWaMessage: DEFAULT })).toEqual([]);
  });
});

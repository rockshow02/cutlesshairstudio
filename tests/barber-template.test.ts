/** Template pesan booking kapster (Pengaturan Situs): default persis, placeholder {brand}/{branch}/{barber}, batas 500. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { settingsSchema } from '../src/content/schema';
import { site } from '../src/content/site';
import { buildSite } from '../src/lib/contentTransforms';
import { bookingMessage } from '../src/lib/whatsapp';
import { setMedia, validateCmsContent, type CmsField, type CmsMedia } from './helpers/pagesCms';
import { rawFixture } from './helpers/contentFixture';

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

// Data uji (bukan settings.json asli): template di CMS bisa diubah admin kapan saja
const rawSettings = rawFixture.settings;
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

  // Batas 500 hanya untuk field template; pesan terisi boleh lebih panjang (wa.me tidak membatasi). Nama uji realistis.
  it('template bawaan terisi nama barber & cabang yang panjang (data uji) tetap ringkas, ≤ 500 karakter', () => {
    const barber = 'Muhammad Rizky Akbar';
    const branch = 'Bogor Bantarjati Utara';
    const msg = bookingMessage(siteWith(DEFAULT), 'barber', { barber, branch });
    expect(msg).toContain(`Kapster Pilihan: ${barber}`);
    expect(msg.length).toBeLessThanOrEqual(500);
  });

  it('CMS: field ada di Pengaturan Situs, maxlength 500, pola placeholder sama; isi saat ini lolos form', () => {
    const config = parse(readFileSync('.pages.yml', 'utf8')) as { media: CmsMedia[]; content: { path: string; fields: CmsField[] }[] };
    const cms = config.content.find((c) => c.path === 'src/content/settings.json')!;
    const f = cms.fields.find((x) => x.name === 'barberWaMessage')!;
    expect(f).toMatchObject({ label: 'Template pesan booking kapster', type: 'text' });
    expect(f.options?.maxlength).toBe(500);
    setMedia(config.media);
    // Isi settings.json saat ini (apa pun yang diisi admin) harus bisa disimpan form
    const current = JSON.parse(readFileSync('src/content/settings.json', 'utf8'));
    expect(validateCmsContent(cms, current)).toEqual([]);
    expect(validateCmsContent(cms, { ...rawSettings, barberWaMessage: 'Halo {nama}' })[0]).toMatch(/barberWaMessage/);
    expect(validateCmsContent(cms, { ...rawSettings, barberWaMessage: DEFAULT })).toEqual([]);
  });
});

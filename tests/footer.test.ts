/** Footer & kontak dinamis: tagline {cities} dari cabang aktif, email opsional, validasi Pengaturan Situs. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { settingsSchema } from '../src/content/schema';
import { site } from '../src/content/site';
import { buildBranches, buildSite } from '../src/lib/contentTransforms';

const settings = settingsSchema.parse({ ...JSON.parse(readFileSync('src/content/settings.json', 'utf8')), defaultWaMessage: 'Halo {brand} cabang {branch}' });
// Status dipaksa "Aktif": tes tidak boleh ikut berubah saat admin mengubah status cabang di CMS
const branchesJson = JSON.parse(readFileSync('src/content/branches.json', 'utf8')).map((b: object) => ({ ...b, status: 'Aktif' }));
const branches = buildBranches(branchesJson, settings.siteName);

describe('footer dinamis', () => {
  it('tagline: {cities} diisi kota cabang aktif, tanpa kota yang di-hardcode', () => {
    const s = buildSite({ ...settings, footerTagline: 'Hair studio di {cities}. Goodstyle, goodmood.' }, site, branches);
    expect(s.footer.description).toBe('Hair studio di Bogor & Cibubur. Goodstyle, goodmood.');
    expect(JSON.stringify(site)).not.toMatch(/Kota Bogor/);
    // Tagline kosong → bawaan, tetap dari data cabang
    expect(buildSite({ ...settings, footerTagline: '' }, site, branches).footer.description).toBe('Hair studio di Bogor & Cibubur. Goodstyle, goodmood.');
    // Cabang "Segera Dibuka" tidak ikut disebut
    const soon = buildBranches(branchesJson.map((b: { slug: string }) => (b.slug === 'cibubur' ? { ...b, status: 'Segera Dibuka' } : b)), settings.siteName);
    expect(buildSite(settings, site, soon).footer.description).toBe('Hair studio di Bogor. Goodstyle, goodmood.');
  });

  it('email: dari Pengaturan Situs; kosong → tidak ada email', () => {
    expect(buildSite({ ...settings, email: 'halo@cutless.id' }, site, branches).email).toBe('halo@cutless.id');
    expect(buildSite({ ...settings, email: '' }, site, branches).email).toBe('');
    expect(buildSite({ ...settings, email: null }, site, branches).email).toBe('');
  });

  it('nomor WA & sosial media tetap dari Pengaturan Situs', () => {
    const s = buildSite({ ...settings, mainWhatsappNumber: '6281234567890' }, site, branches);
    expect(s.whatsapp.number).toBe('6281234567890');
    expect(s.whatsapp.displayNumber).toBe('0812-3456-7890');
  });

  it('validasi: email harus valid bila diisi, tagline maks. 160 karakter', () => {
    const base = JSON.parse(readFileSync('src/content/settings.json', 'utf8'));
    const ok = (extra: Record<string, unknown>) => settingsSchema.safeParse({ ...base, defaultWaMessage: '', ...extra }).success;
    expect(ok({ email: '' })).toBe(true);
    expect(ok({ email: 'halo@cutlesshairstudio.id' })).toBe(true);
    expect(ok({ email: 'halo cutless' })).toBe(false);
    expect(ok({ footerTagline: 'x'.repeat(160) })).toBe(true);
    expect(ok({ footerTagline: 'x'.repeat(161) })).toBe(false);
  });
});

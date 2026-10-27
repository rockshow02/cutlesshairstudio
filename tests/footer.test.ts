/** Footer & kontak dinamis: tagline {cities} dari cabang aktif, email opsional, validasi Pengaturan Situs (data uji). */
import { describe, expect, it } from 'vitest';
import { CONTENT_FILES, settingsSchema } from '../src/content/schema';
import { site } from '../src/content/site';
import { buildBranches, buildSite } from '../src/lib/contentTransforms';
import { rawFixture } from './helpers/contentFixture';

// Data uji (bukan src/content/*.json): cabang Bogor & Cibubur, keduanya Aktif
const settings = settingsSchema.parse({ ...rawFixture.settings, defaultWaMessage: 'Halo {brand} cabang {branch}' });
const branchesJson = CONTENT_FILES['branches.json'].parse(rawFixture.branches.map((b) => ({ ...b, status: 'Aktif' })));
const branches = buildBranches(branchesJson, settings.siteName);

describe('footer dinamis', () => {
  it('tagline: {cities} diisi kota cabang aktif, tanpa kota yang di-hardcode', () => {
    const s = buildSite({ ...settings, footerTagline: 'Hair studio di {cities}. Goodstyle, goodmood.' }, site, branches);
    expect(s.footer.description).toBe('Hair studio di Bogor & Cibubur. Goodstyle, goodmood.');
    expect(JSON.stringify(site)).not.toMatch(/Kota Bogor/);
    // Tagline kosong → bawaan, tetap dari data cabang
    expect(buildSite({ ...settings, footerTagline: '' }, site, branches).footer.description).toBe('Hair studio di Bogor & Cibubur. Goodstyle, goodmood.');
    // Cabang "Segera Dibuka" tidak ikut disebut
    const soon = buildBranches(branchesJson.map((b) => (b.slug === 'cibubur' ? { ...b, status: 'Segera Dibuka' as const } : b)), settings.siteName);
    expect(buildSite(settings, site, soon).footer.description).toBe('Hair studio di Bogor. Goodstyle, goodmood.');
  });

  it('email: dari Pengaturan Situs; kosong → tidak ada email', () => {
    expect(buildSite({ ...settings, email: 'halo@cutlesshairstudio.com' }, site, branches).email).toBe('halo@cutlesshairstudio.com');
    expect(buildSite({ ...settings, email: '' }, site, branches).email).toBe('');
    expect(buildSite({ ...settings, email: null }, site, branches).email).toBe('');
  });

  it('nomor WA & sosial media tetap dari Pengaturan Situs', () => {
    const s = buildSite({ ...settings, mainWhatsappNumber: '6281234567890' }, site, branches);
    expect(s.whatsapp.number).toBe('6281234567890');
    expect(s.whatsapp.displayNumber).toBe('0812-3456-7890');
  });

  it('validasi: email harus valid bila diisi, tagline maks. 160 karakter', () => {
    const base = rawFixture.settings;
    const ok = (extra: Record<string, unknown>) => settingsSchema.safeParse({ ...base, defaultWaMessage: '', ...extra }).success;
    expect(ok({ email: '' })).toBe(true);
    expect(ok({ email: 'halo@cutlesshairstudio.com' })).toBe(true);
    expect(ok({ email: 'halo cutless' })).toBe(false);
    expect(ok({ footerTagline: 'x'.repeat(160) })).toBe(true);
    expect(ok({ footerTagline: 'x'.repeat(161) })).toBe(false);
  });
});

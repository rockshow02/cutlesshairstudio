/**
 * Simulasi Save dari Pages CMS untuk SETIAP file konten: buka entri → Save tanpa perubahan. Isi yang tersimpan
 * (hanya field terdefinisi, field kosong/null/list kosong dihapus) harus lolos form CMS dan Zod, dan tidak boleh ada
 * data yang hilang atau berubah bentuk dibanding isi sekarang.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { z } from 'zod';
import { CONTENT_FILES, kabarSchema, tipSchema } from '../src/content/schema';
import { splitFrontmatter } from '../scripts/tips';
import { sanitizeObject, setMedia, simulateCmsSave, validateCmsContent, type CmsField, type CmsMedia } from './helpers/pagesCms';

const config = parse(readFileSync('.pages.yml', 'utf8')) as { media: CmsMedia[]; content: { name: string; path: string; list?: boolean; fields: CmsField[] }[] };
setMedia(config.media);

/** Zod lalu buang nilai kosong, agar "" vs tidak ada dianggap sama (sama-sama kosong) */
const normalized = (schema: z.ZodType, value: unknown) => sanitizeObject(JSON.parse(JSON.stringify(schema.parse(value))));

describe('simulasi simpan dari Pages CMS (tanpa perubahan)', () => {
  for (const [file, schema] of Object.entries(CONTENT_FILES)) {
    it(file, () => {
      const entry = config.content.find((c) => c.path === `src/content/${file}`);
      expect(entry, `${file} tidak punya koleksi di .pages.yml`).toBeTruthy();
      const original = JSON.parse(readFileSync(`src/content/${file}`, 'utf8'));
      const { saved, errors } = simulateCmsSave(entry!, original);
      expect(errors, 'Save akan ditolak form/server Pages CMS').toEqual([]);
      const parsed = (schema as z.ZodType).safeParse(saved);
      expect(parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`), 'hasil simpan ditolak Zod (build gagal)').toEqual([]);
      // Tidak ada field yang hilang / berubah bentuk
      expect(normalized(schema as z.ZodType, saved)).toEqual(normalized(schema as z.ZodType, original));
    });
  }

  it('mendeteksi field yang tidak didefinisikan di CMS (hilang saat disimpan)', () => {
    const entry = config.content.find((c) => c.path === 'src/content/cta.json')!;
    const original = { ...JSON.parse(readFileSync('src/content/cta.json', 'utf8')), extraField: 'hilang' };
    const { saved } = simulateCmsSave(entry, original);
    expect((saved as Record<string, unknown>).extraField).toBeUndefined();
  });

  it('field list wajib dikunci: list wajib BARU membuat Save ditolak ("Required at …") dari editor yang memuat konfigurasi lama', () => {
    const required: string[] = [];
    const walk = (path: string, fields: CmsField[]) =>
      fields.forEach((f) => {
        if (f.list && f.required) required.push(`${path}.${f.name}`);
        if (f.fields) walk(`${path}.${f.name}`, f.fields);
      });
    config.content.forEach((c) => walk(c.name, c.fields));
    // Field baru sebaiknya opsional (default [] di Zod). Ubah daftar ini hanya bila semua isian sudah punya nilainya.
    expect(required.sort()).toEqual(
      ['about.images', 'about.paragraphs', 'hero.marquee', 'hero.titleLines', 'reviewReplies.templates.bintang12', 'reviewReplies.templates.bintang3', 'reviewReplies.templates.bintang4', 'reviewReplies.templates.bintang5', 'reviewReplies.templates.tanpaTeks', 'shoeCare.advantages', 'shoeCare.services', 'studio.taglines'].sort(),
    );
  });

  // Artikel Tips & Trik (Markdown): frontmatter + body dibuka & disimpan ulang tanpa perubahan
  for (const name of readdirSync('src/content/tips').filter((f) => f.endsWith('.md'))) {
    it(`tips/${name}`, () => {
      const entry = config.content.find((c) => c.path === 'src/content/tips')!;
      const { data, body } = splitFrontmatter(readFileSync(`src/content/tips/${name}`, 'utf8'));
      const original = { ...(data as object), body };
      const { saved, errors } = simulateCmsSave(entry, original);
      expect(errors, 'Save akan ditolak form/server Pages CMS').toEqual([]);
      const parsed = tipSchema.safeParse(saved);
      expect(parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`), 'hasil simpan ditolak Zod (build gagal)').toEqual([]);
      expect(normalized(tipSchema, saved)).toEqual(normalized(tipSchema, original));
    });
  }

  // Kabar, Promo & Acara: koleksi bisa kosong (hanya .gitkeep), jadi memakai fixture sebaris, bukan isi CMS
  describe('kabar (fixture sebaris)', () => {
    const entry = () => config.content.find((c) => c.path === 'src/content/kabar')!;
    const dasar = { title: 'Contoh Item', publishedAt: '2026-11-01', summary: 'Ringkasan contoh.', status: 'Terbit', body: 'Isi contoh.' };
    const fixtures: Record<string, Record<string, unknown>> = {
      Kabar: { ...dasar, kind: 'Kabar', branches: ['semua'] },
      'Promo cabang tertentu': { ...dasar, kind: 'Promo', branches: ['cibubur', 'bogor-bantarjati'], validFrom: '2026-12-01', validUntil: '2026-12-31', image: '/uploads/kabar/contoh.webp', imageAlt: 'Contoh gambar', waLabel: 'Ambil promo' },
      'Acara Tempat lain': { ...dasar, kind: 'Acara', branches: ['semua'], startsAt: '2026-12-20T10:00', endsAt: '2026-12-20T12:00', locationType: 'Tempat lain', venueName: 'Balai Warga', venueAddress: 'Jl. Contoh No. 1', performer: 'Band Contoh', linkUrl: 'https://contoh.id/daftar' },
    };
    for (const [nama, original] of Object.entries(fixtures)) {
      it(`${nama}: buka dan simpan ulang tanpa perubahan`, () => {
        const { saved, errors } = simulateCmsSave(entry(), original);
        expect(errors, 'Save akan ditolak form/server Pages CMS').toEqual([]);
        const parsed = kabarSchema.safeParse(saved);
        expect(parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`), 'hasil simpan ditolak Zod (build gagal)').toEqual([]);
        expect(normalized(kabarSchema, saved)).toEqual(normalized(kabarSchema, original));
      });
    }

    it('kolom jenis lain yang masih terisi: Save lolos form dan Zod, kolomnya dibuang dari hasil', () => {
      const original = { ...fixtures.Kabar, startsAt: '2026-12-20T10:00', endsAt: '2026-12-19T10:00', validUntil: '2026-12-31', venueName: 'Sisa lama' };
      const { saved, errors } = simulateCmsSave(entry(), original);
      expect(errors).toEqual([]);
      const parsed = kabarSchema.safeParse(saved);
      expect(parsed.success).toBe(true);
      expect(parsed.data).not.toHaveProperty('endsAt');
    });

    it('kombinasi salah ditolak form (validateCmsContent) atau Zod', () => {
      const salah: Record<string, Record<string, unknown>> = {
        'Promo tanpa validUntil': { ...fixtures['Promo cabang tertentu'], validUntil: undefined },
        'Acara tanpa startsAt': { ...fixtures['Acara Tempat lain'], startsAt: undefined },
        'Acara endsAt sebelum startsAt': { ...fixtures['Acara Tempat lain'], endsAt: '2026-12-20T09:00' },
        'Tempat lain tanpa alamat': { ...fixtures['Acara Tempat lain'], venueAddress: undefined },
        'Terbit tanpa isi': { ...fixtures.Kabar, body: '' },
        'semua digabung cabang': { ...fixtures.Kabar, branches: ['semua', 'cibubur'] },
      };
      for (const [nama, isi] of Object.entries(salah)) {
        const { saved, errors } = simulateCmsSave(entry(), isi);
        expect(errors.length > 0 || !kabarSchema.safeParse(saved).success, nama).toBe(true);
      }
      // Pelanggaran yang sudah ditolak form: nama tempat 81 karakter, link bukan https
      expect(validateCmsContent(entry(), { ...fixtures['Acara Tempat lain'], venueName: 'x'.repeat(81) })[0]).toMatch(/lebih dari 80 karakter/);
      expect(validateCmsContent(entry(), { ...fixtures['Acara Tempat lain'], performer: 'x'.repeat(81) })[0]).toMatch(/performer: lebih dari 80 karakter/);
      expect(validateCmsContent(entry(), { ...fixtures['Acara Tempat lain'], linkUrl: 'http://contoh.id' }).length).toBeGreaterThan(0);
    });
  });

  it('kata keluhan dikosongkan di CMS: Save lolos form dan Zod, hasilnya daftar kosong', () => {
    const entry = config.content.find((c) => c.path === 'src/content/reviewReplies.json')!;
    const original = { ...JSON.parse(readFileSync('src/content/reviewReplies.json', 'utf8')), complaintWords: [] };
    const { saved, errors } = simulateCmsSave(entry, original);
    expect(errors, 'Save akan ditolak form/server Pages CMS').toEqual([]);
    const parsed = (CONTENT_FILES['reviewReplies.json'] as z.ZodType).safeParse(saved);
    expect(parsed.success ? [] : parsed.error.issues.map((i) => i.message)).toEqual([]);
    expect(parsed.success && (parsed.data as { complaintWords: string[] }).complaintWords).toEqual([]);
  });

  it('isian lama tanpa field baru tetap bisa disimpan (field list/teks baru tidak boleh membuat Save ditolak)', () => {
    for (const c of config.content) {
      if (c.list || (c as { type?: string }).type === 'collection') continue;
      const original = JSON.parse(readFileSync(c.path, 'utf8')) as Record<string, unknown>;
      // Field wajib (non-list) memang harus ada; field list yang tidak wajib boleh tidak ada
      const optionalLists = c.fields.filter((f) => f.list && !f.required).map((f) => f.name);
      const stripped = Object.fromEntries(Object.entries(original).filter(([k]) => !optionalLists.includes(k)));
      expect(simulateCmsSave(c, stripped).errors, c.name).toEqual([]);
    }
  });
});

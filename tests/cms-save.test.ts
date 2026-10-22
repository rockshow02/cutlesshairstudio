/**
 * Simulasi Save dari Pages CMS untuk SETIAP file konten: buka entri → Save tanpa perubahan. Isi yang tersimpan
 * (hanya field terdefinisi, field kosong/null/list kosong dihapus) harus lolos form CMS dan Zod, dan tidak boleh ada
 * data yang hilang atau berubah bentuk dibanding isi sekarang.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { z } from 'zod';
import { CONTENT_FILES } from '../src/content/schema';
import { sanitizeObject, setMedia, simulateCmsSave, type CmsField, type CmsMedia } from './helpers/pagesCms';

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
      ['about.images', 'about.paragraphs', 'hero.marquee', 'hero.titleLines', 'shoeCare.advantages', 'shoeCare.services', 'studio.taglines'].sort(),
    );
  });

  it('isian lama tanpa field baru tetap bisa disimpan (field list/teks baru tidak boleh membuat Save ditolak)', () => {
    for (const c of config.content) {
      if (c.list) continue;
      const original = JSON.parse(readFileSync(c.path, 'utf8')) as Record<string, unknown>;
      // Field wajib (non-list) memang harus ada; field list yang tidak wajib boleh tidak ada
      const optionalLists = c.fields.filter((f) => f.list && !f.required).map((f) => f.name);
      const stripped = Object.fromEntries(Object.entries(original).filter(([k]) => !optionalLists.includes(k)));
      expect(simulateCmsSave(c, stripped).errors, c.name).toEqual([]);
    }
  });
});

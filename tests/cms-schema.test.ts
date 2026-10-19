/**
 * Pages CMS (.pages.yml) dan skema Zod (src/content/schema.ts) harus sejalan, agar admin sudah dicegah di form CMS
 * dan build tidak gagal karena isian kepanjangan:
 *  - setiap batas panjang teks di Zod (.max) punya options.maxlength yang sama di .pages.yml, dan sebaliknya
 *  - field wajib di Zod (tanpa default, tidak boleh kosong) = required: true di .pages.yml, dan sebaliknya
 *  - setiap field Zod ada di form CMS (kecuali yang diisi otomatis), setiap field CMS dikenal Zod
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { CONTENT_FILES } from '../src/content/schema';

interface ZInfo {
  kind: string;
  required: boolean;
  max?: number;
  children?: Record<string, ZInfo>;
  item?: ZInfo;
}

type Def = { type: string; innerType?: z.ZodType; in?: z.ZodType; options?: z.ZodType[]; element?: z.ZodType; shape?: Record<string, z.ZodType>; values?: unknown[] };
const defOf = (s: z.ZodType) => (s as unknown as { _zod: { def: Def } })._zod.def;

/** Ringkas skema Zod: jenis, wajib/tidak, batas panjang teks, anak (objek) / item (list) */
function info(s: z.ZodType, optional = false): ZInfo {
  const def = defOf(s);
  switch (def.type) {
    case 'optional':
    case 'nullable':
    case 'default':
      return info(def.innerType!, true);
    case 'pipe':
      return info(def.in!, optional);
    case 'union': {
      // string | '' → boleh kosong (tidak wajib)
      const opts = def.options!;
      const empty = opts.some((o) => defOf(o).type === 'literal' && (defOf(o).values ?? []).includes(''));
      const main = opts.find((o) => defOf(o).type !== 'literal') ?? opts[0];
      return info(main, optional || empty);
    }
    case 'string': {
      const max = (s as unknown as { maxLength: number | null }).maxLength ?? undefined;
      return { kind: 'string', required: !optional, max };
    }
    case 'object':
      return { kind: 'object', required: !optional, children: Object.fromEntries(Object.entries(def.shape!).map(([k, v]) => [k, info(v)])) };
    case 'array': {
      const checks = (s as unknown as { _zod: { def: { checks?: { _zod: { def: { check: string; minimum?: number } } }[] } } })._zod.def.checks ?? [];
      const min = checks.find((c) => c._zod.def.check === 'min_length')?._zod.def.minimum ?? 0;
      return { kind: 'array', required: !optional && min > 0, item: info(def.element!) };
    }
    default:
      // enum, number, boolean, literal
      return { kind: def.type, required: !optional };
  }
}

interface CmsField {
  name: string;
  type: string;
  required?: boolean;
  list?: boolean | { min?: number; max?: number };
  options?: { maxlength?: number };
  fields?: CmsField[];
}

/** Field Zod yang sengaja tidak ada di form CMS (diisi otomatis / tidak untuk admin) */
const NOT_IN_CMS = new Set<string>([]);

function compare(path: string, cms: CmsField[], zod: Record<string, ZInfo>, out: string[]) {
  const byName = new Map(cms.map((f) => [f.name, f]));
  for (const [name, z] of Object.entries(zod)) {
    const at = `${path}.${name}`;
    const f = byName.get(name);
    if (!f) {
      if (!NOT_IN_CMS.has(at)) out.push(`${at}: ada di Zod, tidak ada di .pages.yml`);
      continue;
    }
    const cmsRequired = f.required === true;
    if (cmsRequired !== z.required) out.push(`${at}: Zod ${z.required ? 'wajib' : 'opsional'}, CMS required: ${cmsRequired}`);
    // Teks (atau list teks): maxlength harus sama dengan .max di Zod
    const text = z.kind === 'array' ? z.item : z;
    if (text?.kind === 'string' && ['string', 'text'].includes(f.type)) {
      const cmsMax = f.options?.maxlength;
      if (text.max !== cmsMax) out.push(`${at}: Zod max ${text.max ?? '-'}, CMS maxlength ${cmsMax ?? '-'}`);
    }
    const children = z.kind === 'object' ? z.children : z.kind === 'array' && z.item?.kind === 'object' ? z.item.children : undefined;
    if (children && f.fields) compare(at, f.fields, children, out);
  }
  for (const f of cms) if (!(f.name in zod)) out.push(`${path}.${f.name}: ada di .pages.yml, tidak dikenal Zod`);
}

/** Semua ketidaksesuaian Zod ↔ .pages.yml */
export function mismatches(yamlText = readFileSync('.pages.yml', 'utf8')): string[] {
  const config = parse(yamlText) as { content: { name: string; path: string; list?: boolean; fields: CmsField[] }[] };
  const out: string[] = [];
  for (const [file, schema] of Object.entries(CONTENT_FILES)) {
    const entry = config.content.find((c) => c.path === `src/content/${file}`);
    if (!entry) {
      out.push(`${file}: tidak ada koleksi di .pages.yml`);
      continue;
    }
    const root = info(schema as z.ZodType);
    const fields = root.kind === 'array' ? root.item?.children : root.children;
    compare(file, entry.fields, fields ?? {}, out);
  }
  return out;
}

describe('.pages.yml sejalan dengan skema Zod', () => {
  it('batas karakter (maxlength), wajib/opsional, dan daftar field sama', () => {
    expect(mismatches()).toEqual([]);
  });

  it('pemeriksaan ini benar-benar mendeteksi selisih', () => {
    const yamlText = readFileSync('.pages.yml', 'utf8').replace(/(name: message[\s\S]*?maxlength: )160/, '$1170');
    expect(mismatches(yamlText)).toContain('announcements.json.message: Zod max 160, CMS maxlength 170');
  });

  it('setiap field dengan batas karakter menyebut batasnya di deskripsi', () => {
    const config = parse(readFileSync('.pages.yml', 'utf8')) as { content: { name: string; fields: CmsField[] }[] };
    const missing: string[] = [];
    const walk = (path: string, fields: (CmsField & { description?: string })[]) =>
      fields.forEach((f) => {
        const max = f.options?.maxlength;
        if (max && !(f.description ?? '').includes(`Maksimal ${max} karakter`)) missing.push(`${path}.${f.name}`);
        if (f.fields) walk(`${path}.${f.name}`, f.fields);
      });
    config.content.forEach((c) => walk(c.name, c.fields));
    expect(missing).toEqual([]);
  });
});

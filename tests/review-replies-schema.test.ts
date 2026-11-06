import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_FILES, settingsSchema } from '../src/content/schema';
import { REPLY_MAX_LENGTH, worstCaseLength, type ReplyTemplates } from '../src/content/reviewReplies';
import { rawFixture } from './helpers/contentFixture';

const schema = CONTENT_FILES['reviewReplies.json'];
const three = (t: string) => [t, `${t} 2`, `${t} 3`];
const base = (): ReplyTemplates => ({
  templates: { bintang5: three('Halo {nama}'), bintang4: three('B4'), bintang3: three('B3'), bintang12: three('B12'), tanpaTeks: three('TT') },
  keywordRules: [{ keyword: 'fade', sentence: 'Senang fade-nya cocok.' }],
  complaintWords: ['lama'],
});
const issues = (v: unknown) => {
  const r = schema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('reviewRepliesSchema', () => {
  it('data dasar valid', () => expect(issues(base())).toEqual([]));

  it('kata keluhan dihilangkan → default daftar kosong', () => {
    const { complaintWords: _omit, ...rest } = base();
    const r = schema.safeParse(rest);
    expect(r.success && r.data.complaintWords).toEqual([]);
  });

  it('3–6 variasi per kategori, tiap variasi 1–400 karakter', () => {
    for (const cat of ['bintang5', 'bintang4', 'bintang3', 'bintang12', 'tanpaTeks'] as const) {
      const few = base();
      few.templates[cat] = ['a', 'b'];
      expect(issues(few).join('\n'), cat).toContain(`templates.${cat}`);
      const many = base();
      many.templates[cat] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
      expect(issues(many).join('\n'), cat).toContain(`templates.${cat}`);
    }
    const long = base();
    long.templates.bintang5[0] = 'x'.repeat(401);
    expect(issues(long)).not.toEqual([]);
    const empty = base();
    empty.templates.bintang5[0] = '  ';
    expect(issues(empty)).not.toEqual([]);
  });

  it('placeholder tak dikenal ditolak (variasi dan kalimat kata kunci)', () => {
    const a = base();
    a.templates.bintang3[1] = 'Halo {foo}';
    expect(issues(a).join('\n')).toMatch(/templates\.bintang3\.1.*\{foo\}.*\{nama\}/);
    const b = base();
    b.keywordRules[0].sentence = 'Halo {Nama}';
    expect(issues(b).join('\n')).toMatch(/keywordRules\.0\.sentence.*\{Nama\}/);
  });

  it('hasil setelah placeholder diisi tidak boleh melebihi 4.096 karakter', () => {
    const v = base();
    v.templates.bintang5[0] = '{nama}'.repeat(66); // 396 karakter → 6.600 setelah nama 100 karakter
    expect(worstCaseLength(v)).toBeGreaterThan(REPLY_MAX_LENGTH);
    expect(issues(v).join('\n')).toContain('4096');
    expect(worstCaseLength(base())).toBeLessThanOrEqual(REPLY_MAX_LENGTH);
  });

  it('kata keluhan & aturan: batas jumlah dan panjang', () => {
    const none = base();
    none.complaintWords = [];
    expect(issues(none)).toEqual([]);
    const longWord = base();
    longWord.complaintWords = ['x'.repeat(31)];
    expect(issues(longWord)).not.toEqual([]);
    const noKey = base();
    noKey.keywordRules = [{ keyword: '', sentence: 'x' }];
    expect(issues(noKey)).not.toEqual([]);
    const tooMany = base();
    tooMany.keywordRules = Array.from({ length: 31 }, (_, i) => ({ keyword: `k${i}`, sentence: 's' }));
    expect(issues(tooMany)).not.toEqual([]);
    const tooManyWords = base();
    tooManyWords.complaintWords = Array.from({ length: 31 }, (_, i) => `w${i}`);
    expect(issues(tooManyWords)).not.toEqual([]);
  });

  it('isi awal src/content/reviewReplies.json lolos, sopan, tanpa janji/klaim', () => {
    const raw = JSON.parse(readFileSync('src/content/reviewReplies.json', 'utf8')) as unknown;
    expect(issues(raw)).toEqual([]);
    const cfg = raw as ReplyTemplates;
    for (const t of cfg.templates.bintang12) expect(t).toContain('0813-2220-932');
    const all = [...Object.values(cfg.templates).flat(), ...cfg.keywordRules.map((r) => r.sentence)].join('\n');
    expect(all).not.toMatch(/\d+\s*%|gratis|diskon|promo|garansi|rp\s?\d/i);
    expect(all).toMatch(/\bkak\b/i);
  });
});

describe('settings.reviewReplyMode', () => {
  it('default Mati; hanya Mati/Uji/Aktif', () => {
    expect(settingsSchema.parse(structuredClone(rawFixture.settings)).reviewReplyMode).toBe('Mati');
    expect(settingsSchema.parse({ ...rawFixture.settings, reviewReplyMode: 'Aktif' }).reviewReplyMode).toBe('Aktif');
    expect(settingsSchema.safeParse({ ...rawFixture.settings, reviewReplyMode: 'Nyala' }).success).toBe(false);
  });
});

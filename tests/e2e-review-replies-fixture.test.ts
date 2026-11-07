/**
 * Data uji balasan ulasan (e2e): e2e/fixtures/content.ts menimpa src/content/reviewReplies.json dengan nilai tetap,
 * seperti settings.json. Tes e2e ulasan (e2e/review-replies.spec.ts) tidak boleh bergantung pada isi CMS: pemilik
 * bebas mengosongkan/mengubah kata keluhan, template, dan aturan kata kunci tanpa membuat CI merah.
 */
import { describe, expect, it } from 'vitest';
import { applyE2EFixtures } from '../e2e/fixtures/content';
import { CONTENT_FILES } from '../src/content/schema';
import { decideAction, type ReplyTemplates } from '../src/content/reviewReplies';
import { sampleReviews } from '../worker/ulasan/gbp';

const schema = CONTENT_FILES['reviewReplies.json'];
const applied = (cms: unknown) => applyE2EFixtures('reviewReplies.json', cms) as ReplyTemplates;

/** Isi CMS yang berbeda-beda (kata keluhan dikosongkan pemilik, diisi lain, atau file kosong) */
const CMS_STATES: Record<string, unknown> = {
  'kata keluhan dikosongkan': { templates: {}, keywordRules: [], complaintWords: [] },
  'kata keluhan lain': { templates: {}, keywordRules: [{ keyword: 'x', sentence: 'y' }], complaintWords: ['mahal'] },
  'file belum terisi': {},
};

describe('fixture e2e reviewReplies.json', () => {
  it.each(Object.entries(CMS_STATES))('hasilnya tetap sama apa pun isi CMS (%s)', (_name, cms) => {
    expect(applied(cms)).toEqual(applied(CMS_STATES['kata keluhan dikosongkan']));
  });

  it('lolos skema konten (template 3–6 variasi, placeholder sah)', () => {
    const result = schema.safeParse(applied({}));
    expect(result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual([]);
  });

  it('kata keluhan tetap milik tes: "antri", "lama", "kecewa"', () => {
    expect(applied({}).complaintWords).toEqual(['antri', 'lama', 'kecewa']);
  });

  it('mode Aktif + ulasan contoh: bintang 5 bersih terkirim otomatis, bintang 5 berkata keluhan ("antrinya lama") tetap antre', () => {
    const { complaintWords } = applied({});
    const decide = (reviewer: string) => {
      const r = sampleReviews(Date.now()).find((x) => x.reviewer === reviewer)!;
      return decideAction({ mode: 'Aktif', rating: r.rating, text: r.text }, complaintWords);
    };
    expect(decide('Contoh Satu')).toBe('kirim');
    expect(decide('Contoh Dua')).toBe('antre');
    expect(decide('Contoh Tiga')).toBe('antre');
    expect(decide('Contoh Empat')).toBe('antre');
  });
});

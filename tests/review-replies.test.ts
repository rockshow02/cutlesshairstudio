import { describe, expect, it } from 'vitest';
import {
  REPLY_MAX_LENGTH,
  buildDraft,
  categoryFor,
  decideAction,
  fillPlaceholders,
  findUnknownPlaceholders,
  greetingFor,
  hasComplaint,
  type ReplyTemplates,
} from '../src/content/reviewReplies';

/** 05.00 WIB = 22.00 UTC hari sebelumnya */
const wib = (hour: number) => Date.UTC(2026, 10, 6, hour - 7, 0, 0);

const cfg: ReplyTemplates = {
  templates: {
    bintang5: ['{salam_waktu} kak {nama}, terima kasih di Cutless {cabang}!', 'B5 kedua', 'B5 ketiga'],
    bintang4: ['B4 satu', 'B4 dua', 'B4 tiga'],
    bintang3: ['B3 satu', 'B3 dua', 'B3 tiga'],
    bintang12: ['B12 satu', 'B12 dua', 'B12 tiga'],
    tanpaTeks: ['Tanpa teks {nama}', 'TT dua', 'TT tiga'],
  },
  keywordRules: [
    { keyword: 'fade', sentence: 'Senang fade-nya cocok.' },
    { keyword: 'Taper', sentence: 'Senang taper-nya rapi.' },
    { keyword: 'rapi', sentence: 'Terima kasih sudah rapi.' },
  ],
  complaintWords: ['lama', 'antri', 'kecewa'],
};

describe('placeholder', () => {
  it('findUnknownPlaceholders menandai yang tidak dikenal (peka huruf besar-kecil)', () => {
    expect(findUnknownPlaceholders('Halo {nama} {foo} {Cabang}')).toEqual(['foo', 'Cabang']);
    expect(findUnknownPlaceholders('Halo kak, tanpa kurung')).toEqual([]);
  });

  it('fillPlaceholders sekali jalan: nilai berisi {…} tidak diproses ulang', () => {
    expect(fillPlaceholders('Halo {nama}, {cabang}', { nama: '{cabang}', cabang: 'Cibubur', salam_waktu: 'x' })).toBe('Halo {cabang}, Cibubur');
  });

  it('greetingFor mengikuti jam WIB', () => {
    expect(greetingFor(wib(5))).toBe('Selamat pagi');
    expect(greetingFor(wib(12))).toBe('Selamat siang');
    expect(greetingFor(wib(16))).toBe('Selamat sore');
    expect(greetingFor(wib(20))).toBe('Selamat malam');
    expect(greetingFor(wib(2))).toBe('Selamat malam');
  });
});

describe('kategori & kata keluhan', () => {
  it('categoryFor', () => {
    expect(categoryFor(5, '')).toBe('tanpaTeks');
    expect(categoryFor(5, '   ')).toBe('tanpaTeks');
    expect(categoryFor(5, 'mantap')).toBe('bintang5');
    expect(categoryFor(4, 'x')).toBe('bintang4');
    expect(categoryFor(4, '')).toBe('tanpaTeks');
    expect(categoryFor(3, 'x')).toBe('bintang3');
    expect(categoryFor(2, 'x')).toBe('bintang12');
    expect(categoryFor(1, '')).toBe('bintang12');
  });

  it('hasComplaint: substring, tanpa peduli huruf kapital & tanda baca', () => {
    expect(hasComplaint('LAMA banget!!', cfg.complaintWords)).toBe(true);
    expect(hasComplaint('Antrinya cepat', cfg.complaintWords)).toBe(true);
    expect(hasComplaint('Mantap', cfg.complaintWords)).toBe(false);
    expect(hasComplaint('', cfg.complaintWords)).toBe(false);
  });
});

describe('decideAction', () => {
  const words = cfg.complaintWords;
  it('mode Mati & Uji: semua antre, termasuk bintang 5 bersih', () => {
    for (const mode of ['Mati', 'Uji'] as const) expect(decideAction({ mode, rating: 5, text: 'mantap' }, words)).toBe('antre');
  });
  it('mode Aktif: hanya bintang 5 tanpa kata keluhan yang dikirim', () => {
    expect(decideAction({ mode: 'Aktif', rating: 5, text: 'mantap' }, words)).toBe('kirim');
    expect(decideAction({ mode: 'Aktif', rating: 5, text: '' }, words)).toBe('kirim');
    expect(decideAction({ mode: 'Aktif', rating: 5, text: 'bagus tapi LAMA' }, words)).toBe('antre');
  });
  it('tidak ada kiriman otomatis bintang 1–4', () => {
    for (const rating of [1, 2, 3, 4]) for (const text of ['', 'mantap', 'bagus sekali']) expect(decideAction({ mode: 'Aktif', rating, text }, words)).toBe('antre');
  });
});

describe('decideAction, daftar kata keluhan kosong', () => {
  it('hasComplaint: daftar kosong atau hanya spasi tidak pernah cocok', () => {
    expect(hasComplaint('antri lama', [])).toBe(false);
    expect(hasComplaint('antri lama', ['  '])).toBe(false);
  });
  it('mode Aktif: semua bintang 5 dikirim, bintang 1–4 tetap antre', () => {
    expect(decideAction({ mode: 'Aktif', rating: 5, text: 'antri lama' }, [])).toBe('kirim');
    expect(decideAction({ mode: 'Aktif', rating: 4, text: 'antri lama' }, [])).toBe('antre');
    for (const rating of [1, 2, 3]) expect(decideAction({ mode: 'Aktif', rating, text: 'mantap' }, [])).toBe('antre');
  });
  it('mode Uji & Mati: tetap antre', () => {
    for (const mode of ['Uji', 'Mati'] as const) expect(decideAction({ mode, rating: 5, text: 'antri lama' }, [])).toBe('antre');
  });
});

describe('buildDraft', () => {
  const base = { rating: 5, text: 'Potongan rapi', reviewer: 'Budi', branchName: 'Cibubur' };
  it('mengisi placeholder dari template terpilih', () => {
    expect(buildDraft(base, cfg, wib(12), () => 0)).toBe('Selamat siang kak Budi, terima kasih di Cutless Cibubur! Terima kasih sudah rapi.');
  });
  it('menambah maksimal 2 kalimat dari kata kunci (tanpa peduli kapital)', () => {
    const d = buildDraft({ ...base, text: 'FADE dan taper rapi' }, cfg, wib(12), () => 0);
    expect(d).toContain('Senang fade-nya cocok.');
    expect(d).toContain('Senang taper-nya rapi.');
    expect(d).not.toContain('Terima kasih sudah rapi.');
  });
  it('bintang 5 tanpa teks memakai kategori tanpaTeks; nama kosong → kak', () => {
    expect(buildDraft({ ...base, text: '', reviewer: '' }, cfg, wib(12), () => 0)).toBe('Tanpa teks kak');
  });
  it('nama berisi HTML dipakai apa adanya (escape urusan halaman)', () => {
    expect(buildDraft({ ...base, text: '', reviewer: '<script>' }, cfg, wib(12), () => 0)).toBe('Tanpa teks <script>');
  });
  it('hasil tak pernah melebihi batas Google', () => {
    const d = buildDraft({ ...base, text: '', reviewer: 'a'.repeat(5000) }, cfg, wib(12), () => 0);
    expect(d.length).toBeLessThanOrEqual(REPLY_MAX_LENGTH);
  });
});

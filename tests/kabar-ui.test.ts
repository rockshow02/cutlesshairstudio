import { describe, expect, it } from 'vitest';
import { KABAR_ALL_BRANCHES, filterKabar, type KabarArticle, type KabarSummary } from '../src/content/kabarSeo';
import { kabarCtaMessage, kabarWaButtons } from '../src/content/kabarCopy';

/** Data uji tetap (bukan isi CMS) */
const mk = (o: Partial<KabarArticle> & Pick<KabarArticle, 'slug' | 'kind'>): KabarArticle => ({
  title: o.slug,
  summary: 's',
  branches: [KABAR_ALL_BRANCHES],
  publishedAt: '2026-11-01',
  html: '',
  ...o,
});
const slugs = (l: KabarSummary[]) => l.map((k) => k.slug);
const NOW = Date.parse('2026-11-06T12:00:00+07:00');

describe('filterKabar (halaman /kabar/)', () => {
  const semua = mk({ slug: 'semua', kind: 'Kabar' });
  const cibubur = mk({ slug: 'cibubur', kind: 'Promo', branches: ['cibubur'], validUntil: '2026-12-31' });
  const bogor = mk({ slug: 'bogor', kind: 'Promo', branches: ['bogor-bantarjati'], validUntil: '2026-12-31' });
  const acara = mk({ slug: 'acara', kind: 'Acara', branches: ['cibubur', 'bogor-bantarjati'], startsAt: '2026-12-20T10:00', endsAt: '2026-12-20T15:00' });
  const all = [semua, cibubur, bogor, acara];

  it('cabang cibubur memuat item "semua" + cibubur', () => {
    expect(slugs(filterKabar(all, { branch: 'cibubur' }))).toEqual(['semua', 'cibubur', 'acara']);
  });
  it('jenis Promo saja', () => {
    expect(slugs(filterKabar(all, { kind: 'Promo' }))).toEqual(['cibubur', 'bogor']);
  });
  it('gabungan cabang + jenis', () => {
    expect(slugs(filterKabar(all, { branch: 'bogor-bantarjati', kind: 'Promo' }))).toEqual(['bogor']);
  });
  it('tanpa penyaring → semua', () => {
    expect(slugs(filterKabar(all, {}))).toEqual(slugs(all));
  });
});

describe('tombol WhatsApp detail (keputusan 5)', () => {
  const branches = [
    { slug: 'bogor-bantarjati', name: 'Bogor Bantarjati', bookable: true },
    { slug: 'cibubur', name: 'Cibubur', bookable: true },
    { slug: 'depok', name: 'Depok', bookable: false },
  ];
  const promo = mk({ slug: 'p', kind: 'Promo', validUntil: '2026-12-31' });

  it('"semua" → satu tombol tanpa cabang (pemilih cabang)', () => {
    expect(kabarWaButtons(promo, branches, NOW)).toEqual([{ label: 'Booking via WhatsApp' }]);
  });
  it('satu cabang → satu tombol ke cabang itu; teks dari waLabel bila ada', () => {
    expect(kabarWaButtons({ ...promo, branches: ['cibubur'] }, branches, NOW)).toEqual([{ label: 'Booking via WhatsApp', branchSlug: 'cibubur' }]);
    expect(kabarWaButtons({ ...promo, branches: ['cibubur'], waLabel: 'Klaim promo' }, branches, NOW)).toEqual([{ label: 'Klaim promo', branchSlug: 'cibubur' }]);
  });
  it('2+ cabang → satu tombol per cabang (urutan daftar cabang), cabang tanpa booking dilewati', () => {
    const multi = { ...promo, branches: ['cibubur', 'depok', 'bogor-bantarjati'] };
    expect(kabarWaButtons(multi, branches, NOW)).toEqual([
      { label: 'Booking di Bogor Bantarjati', branchSlug: 'bogor-bantarjati' },
      { label: 'Booking di Cibubur', branchSlug: 'cibubur' },
    ]);
    expect(kabarWaButtons({ ...multi, waLabel: 'Klaim promo' }, branches, NOW)[0].label).toBe('Klaim promo (Bogor Bantarjati)');
  });
  it('Promo/Acara berakhir → tanpa tombol; Kabar tidak pernah berakhir', () => {
    expect(kabarWaButtons({ ...promo, validUntil: '2020-01-01' }, branches, NOW)).toEqual([]);
    expect(kabarWaButtons(mk({ slug: 'a', kind: 'Acara', startsAt: '2020-01-01T10:00', endsAt: '2020-01-01T12:00' }), branches, NOW)).toEqual([]);
    expect(kabarWaButtons(mk({ slug: 'k', kind: 'Kabar', publishedAt: '2020-01-01' }), branches, NOW)).toHaveLength(1);
  });
  it('cabang terpilih tidak bisa booking semua → tanpa tombol', () => {
    expect(kabarWaButtons({ ...promo, branches: ['depok'] }, branches, NOW)).toEqual([]);
  });
});

describe('kabarCtaMessage', () => {
  it('judul diisi, {brand} & {branch} diisi saat tombol ditekan; kurung kurawal di judul dibuang', () => {
    expect(kabarCtaMessage('Diskon {50%}')).toBe('Halo Kak! Saya tertarik dengan "Diskon 50%" di {brand} cabang {branch}.');
  });
});

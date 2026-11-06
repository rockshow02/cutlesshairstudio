import { describe, expect, it } from 'vitest';
import {
  KABAR_ALL_BRANCHES,
  KABAR_SLUG,
  bannerItem,
  branchBoxItems,
  filterKabar,
  formatKabarDate,
  formatKabarDateTime,
  groupKabar,
  isKabarActive,
  isKabarEnded,
  kabarBannerVisible,
  kabarEndMs,
  kabarEndedAtMs,
  kabarForBranch,
  kabarPath,
  kabarRedirects,
  kabarStartLabel,
  kabarStartMs,
  kabarStatus,
  kabarVisible,
  mapsUrl,
  parseKabarPath,
  type KabarSummary,
} from '../src/content/kabarSeo';

const base = { summary: 's', branches: [KABAR_ALL_BRANCHES], publishedAt: '2026-11-01' };
const mk = (o: Partial<KabarSummary> & Pick<KabarSummary, 'slug' | 'kind'>): KabarSummary => ({ title: o.slug, ...base, ...o });
const t = (s: string) => Date.parse(s);

describe('kabarStatus', () => {
  const promo = mk({ slug: 'p', kind: 'Promo', validUntil: '2026-12-31' });

  it('promo berlangsung sampai akhir hari validUntil WIB', () => {
    expect(kabarStatus(promo, t('2026-12-31T23:59:59+07:00'))).toBe('berlangsung');
    expect(kabarStatus(promo, t('2027-01-01T00:00:00+07:00'))).toBe('berakhir');
  });

  it('batas hari WIB memakai UTC', () => {
    expect(kabarStatus(promo, t('2026-12-31T17:30:00Z'))).toBe('berakhir');
  });

  it('promo akan datang', () => {
    const p = mk({ slug: 'p', kind: 'Promo', validFrom: '2026-12-10' });
    expect(kabarStatus(p, t('2026-12-09T23:59:59+07:00'))).toBe('akan-datang');
    expect(kabarStatus(p, t('2026-12-10T00:00:00+07:00'))).toBe('berlangsung');
    expect(kabarStatus(promo, t('2020-01-01T00:00:00Z'))).toBe('berlangsung');
    expect(kabarStartLabel(p)).toBe('Mulai 10 Desember 2026');
    expect(kabarStartLabel(promo)).toBeUndefined();
  });

  it('acara tiga status', () => {
    const e = mk({ slug: 'e', kind: 'Acara', startsAt: '2026-12-20T10:00', endsAt: '2026-12-20T15:00' });
    expect(kabarStatus(e, t('2026-12-20T09:59:59+07:00'))).toBe('akan-datang');
    expect(kabarStatus(e, t('2026-12-20T10:00:00+07:00'))).toBe('berlangsung');
    expect(kabarStatus(e, t('2026-12-20T14:59:59+07:00'))).toBe('berlangsung');
    expect(kabarStatus(e, t('2026-12-20T15:00:00+07:00'))).toBe('berakhir');
    expect(kabarStartLabel(e)).toBe('Mulai 20 Desember 2026, 10.00 WIB');
    expect(kabarStartMs(e)).toBe(t('2026-12-20T10:00:00+07:00'));
    expect(kabarEndMs(e)).toBe(t('2026-12-20T15:00:00+07:00'));
  });

  it('acara tanpa endsAt berakhir di akhir hari mulai', () => {
    const e = mk({ slug: 'e', kind: 'Acara', startsAt: '2026-12-20T10:00' });
    expect(kabarStatus(e, t('2026-12-20T23:59:59+07:00'))).toBe('berlangsung');
    expect(kabarStatus(e, t('2026-12-21T00:00:00+07:00'))).toBe('berakhir');
  });

  it('isKabarActive/isKabarEnded; kolom jenis lain diabaikan', () => {
    const e = mk({ slug: 'e', kind: 'Acara', startsAt: '2026-12-20T10:00', endsAt: '2026-12-20T15:00' });
    expect(isKabarActive(e, t('2026-12-20T09:00:00+07:00'))).toBe(true);
    expect(isKabarActive(e, t('2026-12-20T12:00:00+07:00'))).toBe(true);
    expect(isKabarActive(e, t('2026-12-20T16:00:00+07:00'))).toBe(false);
    expect(isKabarEnded(e, t('2026-12-20T16:00:00+07:00'))).toBe(true);
    const p = mk({ slug: 'p', kind: 'Promo', validUntil: '2026-12-31', startsAt: '2026-01-01T10:00', endsAt: '2026-01-01T11:00' });
    expect(kabarStatus(p, t('2026-06-01T00:00:00+07:00'))).toBe('berlangsung');
    expect(kabarStartMs(p)).toBeUndefined();
  });

  it('kabarEndedAtMs: ms pertama berstatus berakhir (batas data-kabar-end saringan pra-paint)', () => {
    const e = mk({ slug: 'e', kind: 'Acara', startsAt: '2026-12-20T10:00', endsAt: '2026-12-20T15:00' });
    const eDay = mk({ slug: 'e2', kind: 'Acara', startsAt: '2026-12-20T10:00' });
    const upcoming = mk({ slug: 'u', kind: 'Promo', validFrom: '2026-12-10', validUntil: '2026-12-31' });
    // Promo: inklusif sampai akhir hari validUntil (kabarEndMs) → berakhir 1 ms sesudahnya
    expect(kabarEndedAtMs(promo)).toBe(t('2026-12-31T23:59:59+07:00') + 1);
    // Acara: eksklusif, tepat pada endsAt
    expect(kabarEndedAtMs(e)).toBe(t('2026-12-20T15:00:00+07:00'));
    expect(kabarEndedAtMs(eDay)).toBe(t('2026-12-20T23:59:59+07:00') + 1);
    expect(kabarEndedAtMs(mk({ slug: 'k', kind: 'Kabar', validUntil: '2020-01-01' }))).toBeUndefined();
    // Sama persis dengan kabarStatus di batas (1 ms sebelum: belum, tepat: berakhir)
    for (const k of [promo, e, eDay, upcoming]) {
      const at = kabarEndedAtMs(k)!;
      expect(kabarStatus(k, at - 1)).not.toBe('berakhir');
      expect(kabarStatus(k, at)).toBe('berakhir');
    }
  });

  it('kabar tidak pernah lewat', () => {
    const k = mk({ slug: 'k', kind: 'Kabar', validUntil: '2020-01-01' });
    expect(kabarStatus(k, t('2030-01-01T00:00:00Z'))).toBe('berlangsung');
    expect(kabarEndMs(k)).toBeUndefined();
  });
});

describe('pengelompokan & filter', () => {
  const now = t('2026-12-15T12:00:00+07:00');
  const evLate = mk({ slug: 'ev-late', kind: 'Acara', startsAt: '2026-12-28T10:00', endsAt: '2026-12-28T12:00' });
  const evSoon = mk({ slug: 'ev-soon', kind: 'Acara', startsAt: '2026-12-20T10:00', endsAt: '2026-12-20T12:00' });
  const promoA = mk({ slug: 'promo-a', kind: 'Promo', validUntil: '2026-12-31' });
  const promoB = mk({ slug: 'promo-b', kind: 'Promo', validFrom: '2026-12-18', validUntil: '2027-01-31', branches: ['bandung'] });
  const promoOld = mk({ slug: 'promo-old', kind: 'Promo', validUntil: '2026-12-01' });
  const evOld = mk({ slug: 'ev-old', kind: 'Acara', publishedAt: '2026-11-20', startsAt: '2026-12-01T10:00', endsAt: '2026-12-01T12:00' });
  const newsNew = mk({ slug: 'news-new', kind: 'Kabar', publishedAt: '2026-12-10' });
  const newsOld = mk({ slug: 'news-old', kind: 'Kabar', publishedAt: '2026-10-10', branches: ['jakarta'] });
  const all = [promoOld, newsOld, promoB, evLate, newsNew, promoA, evSoon, evOld];
  const slugs = (l: KabarSummary[]) => l.map((k) => k.slug);

  it('groupKabar: acara dulu, lalu promo; kabar terbaru dulu; lewat di ended (terbaru terbit dulu)', () => {
    const g = groupKabar(all, now);
    expect(slugs(g.active)).toEqual(['ev-soon', 'ev-late', 'promo-a', 'promo-b']);
    expect(slugs(g.news)).toEqual(['news-new', 'news-old']);
    expect(slugs(g.ended)).toEqual(['ev-old', 'promo-old']); // publishedAt turun, bukan waktu berakhir
  });

  it('kabarForBranch', () => {
    expect(slugs(kabarForBranch(all, 'bandung'))).toContain('promo-b');
    expect(slugs(kabarForBranch(all, 'bandung'))).not.toContain('news-old');
    expect(slugs(kabarForBranch(all, 'jakarta'))).toContain('news-old');
    expect(slugs(kabarForBranch(all, 'jakarta'))).toContain('promo-a');
    expect(slugs(kabarForBranch(all, 'jakarta'))).not.toContain('promo-b');
  });

  it('branchBoxItems: tanpa kabar & berakhir, dengan akan-datang', () => {
    expect(slugs(branchBoxItems(all, 'bandung', now))).toEqual(['ev-soon', 'ev-late', 'promo-a', 'promo-b']);
    expect(slugs(branchBoxItems(all, 'jakarta', now))).toEqual(['ev-soon', 'ev-late', 'promo-a']);
  });

  it('bannerItem', () => {
    expect(bannerItem(all, now)?.slug).toBe('ev-soon');
    expect(bannerItem([newsNew, promoOld, evOld], now)).toBeUndefined();
    expect(bannerItem([], now)).toBeUndefined();
  });

  it('filterKabar', () => {
    expect(filterKabar(all, {})).toHaveLength(all.length);
    expect(filterKabar(all, { kind: 'Promo' }).every((k) => k.kind === 'Promo')).toBe(true);
    expect(slugs(filterKabar(all, { branch: 'bandung', kind: 'Promo' }))).toEqual(['promo-old', 'promo-b', 'promo-a']);
    expect(slugs(filterKabar(all, { branch: 'jakarta', kind: 'Kabar' }))).toEqual(['news-old', 'news-new']);
  });
});

describe('visibilitas & URL', () => {
  it('kabarRedirects', () => {
    expect(kabarRedirects(false)).toEqual(['/kabar    /   301', '/kabar/*  /   301']);
    expect(kabarRedirects(true)).toEqual([]);
  });

  it('kabarVisible & kabarBannerVisible', () => {
    expect(kabarVisible({ showKabar: null })).toBe(false);
    expect(kabarVisible({ showKabar: true })).toBe(true);
    expect(kabarBannerVisible({ showKabar: false, showKabarBanner: true })).toBe(false);
    expect(kabarBannerVisible({ showKabar: true, showKabarBanner: true })).toBe(true);
    expect(kabarBannerVisible({ showKabar: true })).toBe(false);
  });

  it('kabarPath, slug, parseKabarPath', () => {
    expect(kabarPath('promo-akhir-tahun')).toBe('/kabar/promo-akhir-tahun/');
    expect(KABAR_SLUG.test('promo-1')).toBe(true);
    expect(KABAR_SLUG.test('Promo_1')).toBe(false);
    expect(parseKabarPath('/kabar')).toEqual({ kind: 'index' });
    expect(parseKabarPath('/kabar/')).toEqual({ kind: 'index' });
    expect(parseKabarPath('/kabar/index.html')).toEqual({ kind: 'index' });
    expect(parseKabarPath('/kabar/promo-1')).toEqual({ kind: 'item', slug: 'promo-1' });
    expect(parseKabarPath('/kabar/promo-1/')).toEqual({ kind: 'item', slug: 'promo-1' });
    expect(parseKabarPath('/kabar/Promo_1/')).toBeUndefined();
    expect(parseKabarPath('/kabar/a/b/')).toBeUndefined();
    expect(parseKabarPath('/tips/')).toBeUndefined();
  });

  it('mapsUrl & format tanggal', () => {
    expect(mapsUrl('Mall A', 'Jl. B 1')).toBe('https://www.google.com/maps/search/?api=1&query=Mall%20A%20Jl.%20B%201');
    expect(formatKabarDate('2026-12-12')).toBe('12 Desember 2026');
    expect(formatKabarDateTime('2026-12-12T10:00')).toBe('12 Desember 2026, 10.00 WIB');
    expect(formatKabarDateTime('2026-12-12 09:05')).toBe('12 Desember 2026, 09.05 WIB');
  });
});

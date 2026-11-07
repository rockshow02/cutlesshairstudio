/**
 * Pipeline build Kabar, Promo & Acara (scripts/kabar.ts): validasi, JSON-LD, head, ringkasan statis, sitemap, llms.txt.
 * Data uji saja (file ditulis di sini), tidak membaca src/content/kabar/ maupun data CMS.
 */
import { describe, expect, it } from 'vitest';
import { branchBoxBody, kabarBannerBody, kabarBody, kabarDataTag, kabarHead, kabarIndexBody, kabarIndexHead, kabarJsonLd, kabarLlmsLines, kabarPrepaintScript, kabarPrepaintTag, kabarSitemapEntries, kabarSummaryOf, processKabar, readKabarFiles, type KabarFile } from '../scripts/kabar';
import { kabarEndedAtMs, type KabarArticle } from '../src/content/kabarSeo';
import { contentFixture } from './helpers/contentFixture';
import { requiredEventProps } from './helpers/eventJsonLd';

const SITE = { siteUrl: 'https://cutlesshairstudio.com', siteName: 'Cutless Hair Studio' };
const bundle = contentFixture();
const NOW = Date.parse('2026-11-06T10:00:00+07:00');

const file = (name: string, fm: Record<string, unknown>, body = 'Isi uji.\n'): KabarFile => ({
  file: name,
  source: `---\n${Object.entries(fm)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `\n${v.map((x) => `  - ${JSON.stringify(x)}`).join('\n')}` : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`,
});

const COMMON = { publishedAt: '2026-11-01', branches: ['semua'], summary: 'Ringkasan uji.', status: 'Terbit' };
const KABAR = { ...COMMON, title: 'Kabar Uji', slug: 'kabar-uji', kind: 'Kabar' };
const PROMO = { ...COMMON, title: 'Promo Uji', slug: 'promo-uji', kind: 'Promo', validFrom: '2026-12-01', validUntil: '2026-12-31' };
const ACARA = { ...COMMON, title: 'Acara Uji', slug: 'acara-uji', kind: 'Acara', branches: ['cibubur'], startsAt: '2026-12-20T10:00', endsAt: '2026-12-20T15:00', locationType: 'Di cabang' };
const ACARA_LAIN = { ...ACARA, slug: 'acara-lain', title: 'Acara Lain', locationType: 'Tempat lain', venueName: 'Gedung Uji', venueAddress: 'Jl. Uji No. 5' };

const opts = { exists: () => true, meta: {}, bundle };
const run = (files: KabarFile[], o: Partial<typeof opts> = {}) => processKabar(files, { ...opts, ...o });
const publish = (fm: Record<string, unknown>, body?: string): KabarArticle => {
  const r = run([file(`${fm.slug as string}.md`, fm, body)]);
  expect(r.errors).toEqual([]);
  return r.published[0];
};

describe('processKabar', () => {
  it('Draf tidak masuk published tetapi tetap divalidasi', () => {
    const ok = run([file('a.md', { ...KABAR, status: 'Draf' })]);
    expect(ok.published).toEqual([]);
    expect(ok.drafts).toBe(1);
    const bad = run([file('b.md', { ...PROMO, status: 'Draf', validUntil: 'ngawur' })]);
    expect(bad.errors.length).toBeGreaterThan(0);
    expect(bad.errors[0]).toContain('kabar/b.md');
  });

  it('Draf setengah terisi tidak menggagalkan build; Terbit dengan kolom wajib kosong gagal dengan pesan Indonesia', () => {
    const setengah = [
      file('p.md', { ...PROMO, slug: 'p', status: 'Draf', validUntil: '' }),
      file('a.md', { ...ACARA, slug: 'a', status: 'Draf', startsAt: '', endsAt: '', locationType: '' }),
      file('t.md', { ...ACARA_LAIN, slug: 't', status: 'Draf', venueName: '', venueAddress: '' }),
    ];
    const r = run(setengah);
    expect(r.errors).toEqual([]);
    expect(r.published).toEqual([]);
    expect(r.drafts).toBe(3);
    const terbit = run([file('p.md', { ...PROMO, slug: 'p', validUntil: '' }), file('a.md', { ...ACARA, slug: 'a', startsAt: '' }), file('t.md', { ...ACARA_LAIN, slug: 't', venueName: '' })]);
    expect(terbit.errors.join('|')).toContain('kabar/p.md');
    expect(terbit.errors.join('|')).toContain('Berlaku sampai wajib diisi untuk jenis Promo');
    expect(terbit.errors.join('|')).toContain('Mulai wajib diisi untuk jenis Acara');
    expect(terbit.errors.join('|')).toContain('Nama tempat wajib diisi untuk lokasi Tempat lain');
  });

  it('slug ganda ditolak; slug cadangan = nama file', () => {
    const dup = run([file('a.md', KABAR), file('b.md', { ...PROMO, slug: 'kabar-uji' })]);
    expect(dup.errors.join('\n')).toMatch(/slug "kabar-uji" sudah dipakai kabar\/a\.md/);
    const r = run([file('promo-akhir-tahun.md', { ...PROMO, slug: '' })]);
    expect(r.errors).toEqual([]);
    expect(r.published[0].slug).toBe('promo-akhir-tahun');
  });

  it('gambar tidak ada → error; ada → ikut di artikel', () => {
    const fm = { ...KABAR, image: '/uploads/kabar/x.webp', imageAlt: 'Foto uji' };
    expect(run([file('a.md', fm)], { exists: () => false }).errors.join('\n')).toContain('gambar tidak ditemukan di public/uploads/kabar/x.webp');
    expect(run([file('a.md', fm)]).published[0].image).toBe('/uploads/kabar/x.webp');
    expect(run([file('a.md', KABAR)]).published[0]).not.toHaveProperty('image');
  });

  it('cabang tidak dikenal → pesan memuat file dan pilihan', () => {
    const r = run([file('a.md', { ...PROMO, branches: ['bandung'] })]);
    expect(r.errors).toEqual(['  • kabar/a.md: cabang "bandung" tidak ada di branches.json (pilihan: bogor-bantarjati, cibubur)']);
    expect(run([file('a.md', { ...PROMO, branches: ['cibubur'] })]).errors).toEqual([]);
  });

  it('frontmatter rusak dilaporkan; kolom jenis lain diabaikan', () => {
    expect(run([{ file: 'x.md', source: 'tanpa frontmatter' }]).errors[0]).toContain('kabar/x.md');
    const a = publish({ ...KABAR, validUntil: '2026-12-31', startsAt: '2026-12-20T10:00', venueName: 'X', linkUrl: 'https://a.test' });
    expect(a).not.toHaveProperty('validUntil');
    expect(a).not.toHaveProperty('startsAt');
    expect(a).not.toHaveProperty('venueName');
    expect(a).not.toHaveProperty('linkUrl');
  });

  it('terbit diurut terbaru dulu', () => {
    const r = run([file('a.md', { ...KABAR, publishedAt: '2026-10-01' }), file('b.md', { ...PROMO, publishedAt: '2026-11-02' })]);
    expect(r.published.map((p) => p.slug)).toEqual(['promo-uji', 'kabar-uji']);
  });

  it('<script> dan javascript: di isi tidak dieksekusi', () => {
    const a = publish(KABAR, 'Halo\n\n<script>window.__x = 1</script>\n\n[klik](javascript:alert(1))\n');
    expect(a.html).not.toContain('<script');
    expect(a.html).toContain('&lt;script&gt;');
    expect(a.html).not.toContain('javascript:');
    expect(kabarBody(a, bundle.branches, NOW)).not.toContain('<script');
  });
});

describe('readKabarFiles', () => {
  it('folder tidak ada → []; fixtures → data uji E2E', async () => {
    expect(await readKabarFiles('Z:/tidak/ada')).toEqual([]);
    expect(Array.isArray(await readKabarFiles('Z:/tidak/ada', true))).toBe(true);
  });
});

describe('kabarJsonLd', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON-LD uji dibaca bertingkat
  const ld = (a: KabarArticle, branches = bundle.branches) => kabarJsonLd(a, SITE, branches, {}) as Record<string, any>;

  it('Acara "Di cabang": Event dengan Place per cabang, tanpa offers', () => {
    const e = ld(publish(ACARA));
    expect(e['@type']).toBe('Event');
    expect(e.startDate).toBe('2026-12-20T10:00:00+07:00');
    expect(e.endDate).toBe('2026-12-20T15:00:00+07:00');
    expect(e.eventStatus).toBe('https://schema.org/EventScheduled');
    expect(e.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode');
    expect(e.location).toHaveLength(1);
    expect(e.location[0]['@type']).toBe('Place');
    expect(e.location[0].name).toContain('Cibubur');
    expect(e.location[0].address['@type']).toBe('PostalAddress');
    expect(e.organizer['@type']).toBe('Organization');
    expect(e).not.toHaveProperty('offers');
    expect(requiredEventProps(e)).toEqual([]);
  });

  it('Acara untuk "semua": cabang beroperasi (bukan Segera Dibuka), Tutup Sementara ikut', () => {
    const [a, b] = bundle.branches;
    const br = (x: typeof a, slug: string, status: typeof a.status) => ({ ...x, slug, name: slug, status });
    const semua = publish({ ...ACARA, branches: ['semua'] });
    expect(ld(semua, [a, b, br(a, 'baru', 'Segera Dibuka')]).location).toHaveLength(2);
    // Tutup Sementara tetap termasuk
    expect(ld(semua, [br(a, 'x', 'Aktif'), br(b, 'y', 'Tutup Sementara'), br(a, 'z', 'Segera Dibuka')]).location).toHaveLength(2);
    // Tanpa Aktif: Tutup Sementara + Segera Dibuka → hanya Tutup Sementara
    expect(ld(semua, [br(a, 'y', 'Tutup Sementara'), br(b, 'z', 'Segera Dibuka')]).location).toHaveLength(1);
    // Semua Segera Dibuka → jatuh ke semua cabang
    expect(ld(semua, [br(a, 'y', 'Segera Dibuka'), br(b, 'z', 'Segera Dibuka')]).location).toHaveLength(2);
  });

  it('location Event tidak pernah kosong: slug tak dikenal → cabang beroperasi; tanpa cabang → BlogPosting', () => {
    const e = ld(publish({ ...ACARA, branches: ['cibubur'] }), [bundle.branches[0]]);
    expect(e.location).toHaveLength(1);
    expect(requiredEventProps(e)).toEqual([]);
    expect(ld(publish(ACARA), [])['@type']).toBe('BlogPosting');
  });

  it('Acara "Tempat lain": Place{name, PostalAddress{streetAddress}} tanpa kota/kode pos', () => {
    const e = ld(publish(ACARA_LAIN));
    expect(e.location.name).toBe('Gedung Uji');
    expect(e.location.address['@type']).toBe('PostalAddress');
    expect(e.location.address.streetAddress).toBe('Jl. Uji No. 5');
    expect(e.location.address).not.toHaveProperty('addressLocality');
    expect(e.location.address).not.toHaveProperty('postalCode');
    expect(requiredEventProps(e)).toEqual([]);
  });

  it('gambar ikut hanya bila ada', () => {
    expect(ld(publish(ACARA))).not.toHaveProperty('image');
    const e = ld(publish({ ...ACARA, image: '/uploads/kabar/x.webp', imageAlt: 'Foto' }));
    expect(e.image).toEqual(['https://cutlesshairstudio.com/uploads/kabar/x.webp']);
  });

  it('Promo & Kabar: BlogPosting', () => {
    for (const fm of [PROMO, KABAR]) {
      const b = ld(publish(fm));
      expect(b['@type']).toBe('BlogPosting');
      expect(b.headline).toBe(fm.title);
      expect(b.datePublished).toBe('2026-11-01');
      expect(b.publisher['@type']).toBe('Organization');
      expect(b).not.toHaveProperty('image');
      expect(b).not.toHaveProperty('offers');
    }
    expect(ld(publish({ ...PROMO, image: '/uploads/kabar/x.webp', imageAlt: 'Foto' })).image).toEqual(['https://cutlesshairstudio.com/uploads/kabar/x.webp']);
  });
});

describe('head & body', () => {
  const list = [publish(ACARA), publish(PROMO), publish(KABAR)].map(kabarSummaryOf);

  it('kabarSummaryOf membuang isi dan kolom detail', () => {
    const s = kabarSummaryOf(publish(ACARA_LAIN, 'Isi'));
    expect(s).not.toHaveProperty('html');
    expect(s).not.toHaveProperty('venueName');
    expect(s.startsAt).toBe('2026-12-20T10:00');
  });

  it('kabarIndexHead: title/description <=160, canonical, CollectionPage + ItemList', () => {
    const head = kabarIndexHead(list, SITE, '/og.png');
    const title = /<title>(.*?)<\/title>/.exec(head)![1];
    const desc = /<meta name="description" content="(.*?)"/.exec(head)![1];
    expect(title.length).toBeLessThanOrEqual(160);
    expect(desc.length).toBeLessThanOrEqual(160);
    expect(head).toContain('<link rel="canonical" href="https://cutlesshairstudio.com/kabar/" />');
    const blocks = [...head.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const col = blocks.find((b) => b['@type'] === 'CollectionPage');
    expect(col.mainEntity['@type']).toBe('ItemList');
    expect(col.mainEntity.itemListElement).toHaveLength(3);
    expect(blocks.some((b) => b['@type'] === 'BreadcrumbList')).toBe(true);
  });

  it('kabarHead: canonical, OG, JSON-LD Event + Breadcrumb', () => {
    const head = kabarHead(publish(ACARA), SITE, bundle.branches, {});
    expect(head).toContain('<link rel="canonical" href="https://cutlesshairstudio.com/kabar/acara-uji/" />');
    expect(head).toContain('"@type":"Event"');
    expect(head).toContain('"@type":"BreadcrumbList"');
  });

  it('kabarSitemapEntries: /kabar/ dan semua detail, lastmod = publishedAt', () => {
    const ended = kabarSummaryOf(publish({ ...PROMO, slug: 'lama', validFrom: '', validUntil: '2020-01-01', publishedAt: '2019-12-01' }));
    const entries = kabarSitemapEntries([...list, ended]);
    expect(entries[0].path).toBe('/kabar/');
    expect(entries.find((e) => e.path === '/kabar/lama/')?.lastmod).toBe('2019-12-01');
    expect(entries.find((e) => e.path === '/kabar/promo-uji/')?.lastmod).toBe('2026-11-01');
    expect(kabarSitemapEntries([])).toEqual([{ path: '/kabar/' }]);
  });

  it('kabarLlmsLines: hanya promo/acara belum berakhir', () => {
    const ended = kabarSummaryOf(publish({ ...PROMO, slug: 'lama', title: 'Promo Lama', validFrom: '', validUntil: '2020-01-01' }));
    const text = kabarLlmsLines([...list, ended], SITE.siteUrl, NOW).join('\n');
    expect(text).toContain('[Promo Uji](https://cutlesshairstudio.com/kabar/promo-uji/)');
    expect(text).toContain('[Acara Uji]');
    expect(text).not.toContain('Promo Lama');
    expect(text).not.toContain('Kabar Uji');
    expect(kabarLlmsLines(list.filter((k) => k.kind === 'Kabar'), SITE.siteUrl, NOW)).toEqual([]);
  });

  it('kabarBody: label berakhir / akan datang / lokasi', () => {
    const ended = publish({ ...PROMO, validFrom: '', validUntil: '2020-01-01' });
    expect(kabarBody(ended, bundle.branches, NOW)).toContain('Promo telah berakhir');
    const upcoming = kabarBody(publish(PROMO), bundle.branches, NOW);
    expect(upcoming).toContain('Mulai 1 Desember 2026');
    expect(upcoming).not.toContain('Promo telah berakhir');
    const past = kabarBody(publish(ACARA), bundle.branches, Date.parse('2027-01-01T00:00:00+07:00'));
    expect(past).toContain('Acara telah selesai');
    expect(past).toContain('Cibubur');
    const lain = kabarBody(publish(ACARA_LAIN), bundle.branches, NOW);
    expect(lain).toContain('Gedung Uji');
    expect(lain).toContain('https://www.google.com/maps/search/?api=1&amp;query=');
    expect(kabarBody(publish(KABAR), bundle.branches, NOW)).not.toMatch(/berakhir|selesai/);
  });

  it('kabarIndexBody: tiga grup, atribut pra-paint, pesan kosong', () => {
    const html = kabarIndexBody(list, NOW);
    expect(html).toContain('class="prerender"');
    expect(html).toContain('Sedang berlangsung &amp; akan datang');
    expect(html).toContain('Kabar terbaru');
    expect(html).toContain(`data-kabar-start="${Date.parse('2026-12-20T10:00:00+07:00')}"`);
    expect(html).toContain(`data-kabar-end="${Date.parse('2026-12-20T15:00:00+07:00')}"`);
    expect(kabarIndexBody([], NOW)).toContain('Belum ada kabar, promo, atau acara.');
  });

  it('branchBoxBody: kosong = "", berisi data-kabar-box + atribut item', () => {
    expect(branchBoxBody([], NOW)).toBe('');
    const html = branchBoxBody(list.filter((k) => k.kind !== 'Kabar'), NOW);
    expect(html).toContain('data-kabar-box');
    expect(html).toContain('Promo &amp; acara');
    expect(html).toContain(`data-kabar-start="${Date.parse('2026-12-01T00:00:00+07:00')}"`);
    expect(html).toContain('href="/kabar/promo-uji/"');
    // data-kabar-end = ms pertama berstatus berakhir (Promo: 00:00:00.000 WIB sesudah hari validUntil)
    expect(html).toContain(`data-kabar-end="${Date.parse('2027-01-01T00:00:00+07:00')}"`);
    // Saringan pra-paint ada di <head> (kabarPrepaintTag), bukan di fragmen
    expect(html.endsWith('</section>')).toBe(true);
    expect(html).not.toContain('<script');
  });

  it('kabarBannerBody: satu tautan ke detail, atribut pra-paint, label "Mulai" bila akan datang; tanpa item = ""', () => {
    expect(kabarBannerBody(undefined, NOW)).toBe('');
    const promo = list.find((k) => k.kind === 'Promo')!;
    const html = kabarBannerBody(promo, NOW);
    expect(html).toContain('data-kabar-banner');
    expect(html).toContain('href="/kabar/promo-uji/"');
    expect(html).toContain('Promo Uji');
    expect(html).toContain('Mulai 1 Desember 2026');
    expect(html).toContain(`data-kabar-end="${kabarEndedAtMs(promo)}"`);
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).not.toContain('<script');
    expect(kabarBannerBody(promo, Date.parse('2026-12-05T10:00:00+07:00'))).not.toContain('Mulai');
  });

  it('kabarDataTag: JSON aman', () => {
    const tag = kabarDataTag(publish(KABAR, 'x </script> y'));
    expect(tag).toContain('id="kabar-item"');
    expect(tag.match(/<\/script>/g)).toHaveLength(1);
  });
});

/**
 * Saringan pra-paint dijalankan pada DOM tiruan kecil (tanpa jsdom/happy-dom di devDependencies): hanya
 * querySelectorAll ([atribut] / nama tag), getAttribute, setAttribute, hasAttribute yang dipakai skrip.
 */
describe('kabarPrepaintScript', () => {
  class El {
    attrs = new Map<string, string>();
    constructor(public tag: string, attrs: Record<string, string | number> = {}, public children: El[] = []) {
      for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, String(v));
    }
    getAttribute(n: string) { return this.attrs.get(n) ?? null; }
    setAttribute(n: string, v: string) { this.attrs.set(n, v); }
    removeAttribute(n: string) { this.attrs.delete(n); }
    hasAttribute(n: string) { return this.attrs.has(n); }
    get hidden() { return this.attrs.has('hidden'); }
    all(): El[] { return this.children.flatMap((c) => [c, ...c.all()]); }
    querySelectorAll(sel: string): El[] {
      const attr = sel.match(/^\[([a-z-]+)\]$/)?.[1];
      return this.all().filter((e) => (attr ? e.attrs.has(attr) : e.tag === sel));
    }
  }
  const END = Date.parse('2026-11-06T15:00:00+07:00');
  const li = (end?: number, start?: number) => new El('li', { ...(end !== undefined ? { 'data-kabar-end': end } : {}), ...(start !== undefined ? { 'data-kabar-start': start } : {}) });
  const box = (...items: El[]) => new El('section', { 'data-kabar-box': '' }, [new El('h2'), new El('ul', {}, items)]);
  const run = (now: number, ...nodes: El[]) => {
    const doc = new El('#document', {}, nodes);
    new Function('document', 'Date', kabarPrepaintScript())(doc, { now: () => now });
  };

  it('item lewat disembunyikan, aktif & akan datang tetap tampil; kotak campuran tetap', () => {
    const lewat = li(END - 1000);
    const aktif = li(END + 1000);
    const akanDatang = li(END + 10_000, END + 5000);
    const b = box(lewat, aktif, akanDatang);
    run(END, b);
    expect([lewat.hidden, aktif.hidden, akanDatang.hidden, b.hidden]).toEqual([true, false, false, false]);
  });

  it('semua item lewat → kotak disembunyikan', () => {
    const a = li(END - 1);
    const b = li(END - 5000);
    const k = box(a, b);
    run(END, k);
    expect([a.hidden, b.hidden, k.hidden]).toEqual([true, true, true]);
  });

  it('batas: tepat pada data-kabar-end hilang, 1 ms sebelumnya tampil', () => {
    const tepat = li(END);
    run(END, box(tepat));
    expect(tepat.hidden).toBe(true);
    const sebelum = li(END);
    const k = box(sebelum);
    run(END - 1, k);
    expect([sebelum.hidden, k.hidden]).toEqual([false, false]);
  });

  it('batas promo dari kabarEndedAtMs: hari terakhir sampai 23:59:59.999 WIB tampil, 00:00:00.000 WIB esok hilang', () => {
    const promo = kabarSummaryOf(publish(PROMO));
    const end = kabarEndedAtMs(promo)!;
    for (const [at, hidden] of [
      ['2026-12-31T23:59:59.000+07:00', false],
      ['2026-12-31T23:59:59.999+07:00', false],
      ['2027-01-01T00:00:00.000+07:00', true],
    ] as const) {
      const item = li(end);
      run(Date.parse(at), box(item));
      expect(item.hidden, at).toBe(hidden);
    }
  });

  it('kotak yang baru sebagian ter-parse: tanpa <li> tidak disembunyikan; disembunyikan terlalu dini → dibuka lagi', () => {
    const kosong = box();
    run(END, kosong);
    expect(kosong.hidden).toBe(false);
    const aktif = li(END + 1000);
    const k = box(li(END - 1000), aktif);
    k.setAttribute('hidden', '');
    run(END, k);
    expect([aktif.hidden, k.hidden]).toEqual([false, false]);
  });

  it('banner (tanpa kotak) disembunyikan bila lewat', () => {
    const banner = new El('p', { 'data-kabar-banner': '', 'data-kabar-end': END });
    run(END, banner);
    expect(banner.hidden).toBe(true);
  });

  it('kecil & aman: tanpa eval, innerHTML, Function, atau "<" (tidak bisa menutup tag script)', () => {
    const js = kabarPrepaintScript();
    expect(js).toContain('data-kabar-end');
    expect(js).not.toMatch(/eval|innerHTML|Function|</);
    expect(js.length).toBeLessThan(800);
    expect(kabarPrepaintTag()).toBe(`<script>${js}</script>`);
  });
});

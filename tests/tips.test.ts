/**
 * Tips & Trik (scripts/tips.ts, src/content/tipsSeo.ts): skema frontmatter, slug unik, Draf tidak di-build, waktu
 * baca, render Markdown aman, JSON-LD, sitemap & llms.txt, sinkron pilihan CMS, kompres gambar di .md.
 * Data uji saja (artikel ditulis di sini / e2e/fixtures), tidak membaca artikel CMS di src/content/tips/.
 */
import { describe, expect, it } from 'vitest';
import { barberSchema, tipSchema } from '../src/content/schema';
import { parseTipsPath, readingMinutes, relatedTips, slugify, tipLastModified, tipsPageCount, tipsPagePath, tipsRedirects, tipsVisible, type TipSummary } from '../src/content/tipsSeo';
import { tipCtaMessage, tipsCopy } from '../src/content/tipsCopy';
import { fillTemplate, withBranchPlaceholder } from '../src/lib/whatsapp';
import { whatsappShareUrl } from '../src/lib/tips';
import { processTips, renderMarkdown, splitFrontmatter, tipBody, tipFaqJsonLd, tipHead, tipJsonLd, tipsCollectionJsonLd, tipsIndexBody, tipsIndexHead, tipsLlmsLines, tipsSitemapEntries, type TipFile } from '../scripts/tips';
import { llmsTxt, sitemap } from '../scripts/vite-content-plugin';
import { E2E_TIPS, e2eTipFiles } from '../e2e/fixtures/content';
// @ts-expect-error modul JS tanpa deklarasi tipe
import { syncNameOptions } from '../scripts/sync-pages-config.mjs';
// @ts-expect-error modul JS tanpa deklarasi tipe
import { replaceImagePath } from '../scripts/optimize-images.mjs';
import { contentFixture } from './helpers/contentFixture';

const SITE = { siteUrl: 'https://cutlesshairstudio.com', siteName: 'Cutless Hair Studio' };
const FM = {
  title: 'Cara Merawat Rambut Ikal',
  summary: 'Ringkasan uji.',
  category: 'Hair Care',
  cover: '/uploads/tips/uji.webp',
  coverAlt: 'Foto uji',
  publishedAt: '2026-10-20',
  status: 'Terbit',
  body: 'Isi uji.',
};

/** File artikel uji: frontmatter (YAML) + isi */
const file = (name: string, fm: Record<string, unknown>, body = 'Paragraf uji.\n'): TipFile => ({
  file: name,
  source: `---\n${Object.entries(fm)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `\n${v.map((x) => `  - ${JSON.stringify(x)}`).join('\n')}` : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`,
});
const { body: _b, ...frontmatter } = FM;
const bundle = contentFixture({
  barbers: [{ name: 'Barber Uji', role: 'Hairstylist' }] as never,
  services: [{ name: 'Haircut' }] as never,
});
const run = (files: TipFile[], exists = (_url: string) => true) => processTips(files, { exists, bundle });

describe('skema frontmatter artikel', () => {
  const issues = (v: Record<string, unknown>) => {
    const r = tipSchema.safeParse(v);
    return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  };

  it('artikel lengkap lolos; tanggal YAML (Date) dirapikan jadi YYYY-MM-DD', () => {
    expect(issues(FM)).toEqual([]);
    expect(tipSchema.parse({ ...FM, publishedAt: new Date('2026-10-20T00:00:00Z') }).publishedAt).toBe('2026-10-20');
  });

  it('judul ≤ 70, ringkasan ≤ 160, tidak boleh kosong; kategori & status dari pilihan', () => {
    expect(issues({ ...FM, title: 'x'.repeat(71) })[0]).toMatch(/^title: maksimal 70/);
    expect(issues({ ...FM, title: '  ' })[0]).toMatch(/^title: judul wajib diisi/);
    expect(issues({ ...FM, summary: 'x'.repeat(161) })[0]).toMatch(/^summary: maksimal 160/);
    expect(issues({ ...FM, summary: '' })[0]).toMatch(/^summary: ringkasan wajib diisi/);
    expect(issues({ ...FM, category: 'Jenggot' })[0]).toMatch(/^category: kategori harus salah satu/);
    expect(issues({ ...FM, status: 'Published' })[0]).toMatch(/^status: status harus Draf atau Terbit/);
  });

  it('sampul wajib JPG/PNG/WebP di /uploads/tips/ + deskripsi foto', () => {
    expect(issues({ ...FM, cover: '' })[0]).toMatch(/^cover: harus file JPG, PNG, atau WebP di \/uploads\/tips\//);
    expect(issues({ ...FM, cover: '/uploads/gallery/a.webp' })[0]).toMatch(/^cover:/);
    expect(issues({ ...FM, cover: '/uploads/tips/a.gif' })[0]).toMatch(/^cover:/);
    expect(issues({ ...FM, cover: '/uploads/tips/A.JPG' })).toEqual([]);
    expect(issues({ ...FM, coverAlt: '' })[0]).toMatch(/^coverAlt: deskripsi foto sampul wajib diisi/);
  });

  it('Terbit wajib berisi; Draf boleh kosong; diperbarui ≥ terbit; slug format & bukan "halaman"', () => {
    expect(issues({ ...FM, body: '  \n' })[0]).toMatch(/^body: isi artikel wajib diisi sebelum diterbitkan/);
    expect(issues({ ...FM, status: 'Draf', body: '' })).toEqual([]);
    expect(issues({ ...FM, updatedAt: '2026-10-19' })[0]).toMatch(/^updatedAt: tanggal diperbarui tidak boleh sebelum/);
    expect(issues({ ...FM, updatedAt: '' })).toEqual([]);
    expect(issues({ ...FM, publishedAt: '20-10-2026' })[0]).toMatch(/^publishedAt: format tanggal harus YYYY-MM-DD/);
    expect(issues({ ...FM, slug: 'Cara Rambut' })[0]).toMatch(/^slug: slug hanya huruf kecil/);
    expect(issues({ ...FM, slug: 'halaman' })[0]).toMatch(/^slug: slug "halaman" dipakai halaman daftar/);
  });
});

describe('muat & validasi artikel', () => {
  it('slug = nama file (dibuat Pages CMS dari judul); Slug di frontmatter menimpanya', () => {
    const r = run([file('cara-merawat-rambut-ikal.md', frontmatter), file('lain.md', { ...frontmatter, title: 'Lain', slug: 'slug-khusus' })]);
    expect(r.errors).toEqual([]);
    expect(r.published.map((t) => t.slug).sort()).toEqual(['cara-merawat-rambut-ikal', 'slug-khusus']);
  });

  it('slug ganda → error yang menyebut kedua file', () => {
    const r = run([file('a.md', { ...frontmatter, slug: 'sama' }), file('b.md', { ...frontmatter, slug: 'sama' })]);
    expect(r.errors).toEqual(['  • tips/b.md: slug: slug "sama" sudah dipakai tips/a.md; ubah Slug salah satunya']);
  });

  it('nama file bukan slug valid (mis. huruf besar) → minta isi Slug, dengan saran dari judul', () => {
    expect(run([file('Cara Rambut.md', frontmatter)]).errors[0]).toMatch(/nama file "Cara Rambut\.md" bukan slug yang valid.*cara-merawat-rambut-ikal/);
  });

  it('Draf divalidasi tapi tidak di-build; Terbit urut terbaru dulu', () => {
    const r = run([
      file('lama.md', { ...frontmatter, title: 'Lama', publishedAt: '2026-01-01' }),
      file('baru.md', { ...frontmatter, title: 'Baru', publishedAt: '2026-10-28' }),
      file('draf.md', { ...frontmatter, title: 'Draf', status: 'Draf' }, ''),
    ]);
    expect(r.errors).toEqual([]);
    expect(r.drafts).toBe(1);
    expect(r.published.map((t) => t.slug)).toEqual(['baru', 'lama']);
    // Draf yang salah tetap dilaporkan (admin tahu sebelum menerbitkan)
    expect(run([file('draf.md', { ...frontmatter, status: 'Draf', category: 'Salah' })]).errors[0]).toMatch(/^ {2}• tips\/draf\.md: category:/);
  });

  it('gambar sampul & gambar di isi harus ada; penulis = nama Barber; layanan = nama kartu Layanan', () => {
    const missing = run([file('a.md', { ...frontmatter, author: 'Budi', services: ['Pijat'] }, '![x](/uploads/tips/hilang.webp)\n')], (url) => url !== '/uploads/tips/hilang.webp' && url !== FM.cover);
    expect(missing.errors).toEqual([
      '  • tips/a.md: cover: gambar tidak ditemukan di public/uploads/tips/uji.webp',
      '  • tips/a.md: author: "Budi" tidak ada di daftar Barber',
      '  • tips/a.md: services: layanan "Pijat" tidak ada di kartu Layanan',
      '  • tips/a.md: body: gambar tidak ditemukan di public/uploads/tips/hilang.webp',
    ]);
    expect(run([file('a.md', { ...frontmatter, author: 'Barber Uji', services: ['Haircut'] })]).errors).toEqual([]);
  });

  it('file tanpa frontmatter → pesan jelas', () => {
    expect(run([{ file: 'a.md', source: '# Judul\n\nIsi' }]).errors[0]).toMatch(/frontmatter \(--- \.\.\. ---\) di awal file tidak ditemukan/);
    expect(splitFrontmatter('---\ntitle: "A"\n---\nIsi').body).toBe('Isi');
  });

  it('artikel uji e2e semuanya valid: 13 Terbit, 1 Draf', () => {
    const r = processTips(e2eTipFiles(), { exists: () => true, bundle: contentFixture({ barbers: [{ name: E2E_TIPS.withToc.author }] as never, services: [{ name: E2E_TIPS.withToc.service }] as never }) });
    expect(r.errors).toEqual([]);
    expect(r.published).toHaveLength(E2E_TIPS.publishedCount);
    expect(r.drafts).toBe(1);
    expect(r.published.some((t) => t.slug === E2E_TIPS.draft.slug)).toBe(false);
  });
});

describe('render Markdown & waktu baca', () => {
  it('H2 diberi id unik (daftar isi), H1 di isi jadi H2 (H1 = judul halaman)', () => {
    const r = renderMarkdown('# Atas\n\n## Cara **Cepat**\n\n## Cara Cepat\n\n### Detail\n');
    expect(r.headings).toEqual([
      { id: 'atas', text: 'Atas' },
      { id: 'cara-cepat', text: 'Cara Cepat' },
      { id: 'cara-cepat-2', text: 'Cara Cepat' },
    ]);
    expect(r.html).toContain('<h2 id="cara-cepat">Cara <strong>Cepat</strong></h2>');
    expect(r.html).toContain('<h3>Detail</h3>');
  });

  it('HTML mentah tidak dieksekusi; link javascript: dibuang; link luar tab baru', () => {
    const r = renderMarkdown('<script>alert(1)</script>\n\nTeks <img src=x onerror=alert(1)> [a](javascript:alert(1)) [b](https://contoh.id)\n');
    expect(r.html).not.toMatch(/<script|<img src=x|href="javascript/i);
    expect(r.html).toContain('&lt;script&gt;');
    expect(r.html).toContain('<a href="https://contoh.id" target="_blank" rel="noopener noreferrer">b</a>');
  });

  it('gambar di isi: lazy, ukuran asli (tanpa layout shift), .webp & srcset bila ada', () => {
    const meta = { '/uploads/tips/a.webp': { width: 1600, height: 900 }, '/uploads/tips/a-600.webp': { width: 600, height: 338 } };
    const { html } = renderMarkdown('![Foto uji](/uploads/tips/a.jpg)', meta);
    expect(html).toContain('src="/uploads/tips/a.webp"');
    expect(html).toContain('width="1600" height="900" loading="lazy" decoding="async"');
    expect(html).toContain('srcset="/uploads/tips/a-600.webp 600w, /uploads/tips/a.webp 1600w"');
  });

  it('waktu baca ±200 kata/menit, dibulatkan ke atas, minimal 1', () => {
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes('kata '.repeat(200))).toBe(1);
    expect(readingMinutes('kata '.repeat(201))).toBe(2);
    const r = run([file('a.md', frontmatter, `${'kata '.repeat(900)}\n`)]);
    expect(r.published[0].readingMinutes).toBe(5);
  });

  it('slug otomatis dari judul: huruf kecil, kata dipisah strip', () => {
    expect(slugify('Cara Merawat Rambut Ikal!')).toBe('cara-merawat-rambut-ikal');
    expect(slugify('Pomade & Clay: Mana yang Cocok?')).toBe('pomade-dan-clay-mana-yang-cocok');
    expect(slugify('Gaya Rambut Pria 2026 — Édisi Baru')).toBe('gaya-rambut-pria-2026-edisi-baru');
  });
});

const summary = (over: Partial<TipSummary>): TipSummary => ({
  slug: 'a', title: 'A', summary: 'S', category: 'Hair Care', cover: '/uploads/tips/a.webp', coverAlt: 'alt', publishedAt: '2026-10-01', readingMinutes: 2, services: [], ...over,
});

describe('artikel terkait, daftar isi, paginasi', () => {
  it('3 artikel terkait: kategori sama dulu, lalu layanan sama, lalu terbaru; tanpa artikel itu sendiri', () => {
    const current = summary({ slug: 'ini', category: 'Grooming', services: ['Shaving'] });
    const all = [
      summary({ slug: 'baru-lain' }),
      current,
      summary({ slug: 'layanan-sama', services: ['Shaving'] }),
      summary({ slug: 'kategori-sama', category: 'Grooming' }),
      summary({ slug: 'lama-lain' }),
    ];
    expect(relatedTips(all, current).map((t) => t.slug)).toEqual(['kategori-sama', 'layanan-sama', 'baru-lain']);
  });

  it('daftar isi hanya bila ≥ 3 subjudul H2', () => {
    const [withToc] = run([file('a.md', frontmatter, '## Satu\n\nx\n\n## Dua\n\nx\n\n## Tiga\n\nx\n')]).published;
    const [noToc] = run([file('a.md', frontmatter, '## Satu\n\nx\n\n## Dua\n\nx\n')]).published;
    expect(tipBody(withToc, [])).toContain('<p>Daftar isi</p><ol><li><a href="#satu">Satu</a></li>');
    expect(tipBody(noToc, [])).not.toContain('Daftar isi');
  });

  it('lebih dari 12 artikel → halaman 2 (teks paginasi sama dengan halaman React)', () => {
    const tips = Array.from({ length: 13 }, (_, i) => summary({ slug: `t-${i}`, title: `T ${i}` }));
    expect(tipsPageCount(12)).toBe(1);
    expect(tipsPageCount(13)).toBe(2);
    expect(tipsIndexBody(tips, 1)).toContain('<p>Halaman 1 dari 2</p> <a href="/tips/halaman/2/">Berikutnya</a>');
    expect(tipsIndexBody(tips, 2)).toContain('<a href="/tips/">Sebelumnya</a>');
    expect(tipsIndexBody(tips, 2).match(/<li><p>Hair Care<\/p>/g)).toHaveLength(1);
    expect(tipsIndexBody(tips.slice(0, 12), 1)).not.toContain('Halaman 1 dari');
  });
});

describe('JSON-LD', () => {
  const [tip] = run([file('cara.md', { ...frontmatter, author: 'Barber Uji', updatedAt: '2026-10-25' })]).published;

  it('BlogPosting: headline, description, image, tanggal, author Person, publisher Organization', () => {
    const ld = tipJsonLd(tip, SITE, { name: 'Barber Uji', role: 'Hairstylist' });
    expect(ld).toMatchObject({
      '@type': 'BlogPosting',
      headline: FM.title,
      description: FM.summary,
      image: ['https://cutlesshairstudio.com/uploads/tips/uji.webp'],
      datePublished: '2026-10-20',
      dateModified: '2026-10-25',
      mainEntityOfPage: 'https://cutlesshairstudio.com/tips/cara/',
      author: { '@type': 'Person', name: 'Barber Uji', jobTitle: 'Hairstylist' },
      publisher: { '@type': 'Organization', '@id': 'https://cutlesshairstudio.com/#organization', name: SITE.siteName },
    });
  });

  it('tanpa penulis → author = Organization; tanpa tanggal diperbarui → dateModified = terbit', () => {
    const [plain] = run([file('cara.md', frontmatter)]).published;
    expect(tipJsonLd(plain, SITE).author).toMatchObject({ '@type': 'Organization', name: SITE.siteName });
    expect(tipJsonLd(plain, SITE).dateModified).toBe('2026-10-20');
    expect(tipLastModified({ publishedAt: '2026-10-20', updatedAt: '2026-10-25' })).toBe('2026-10-25');
  });

  it('/tips/: CollectionPage + ItemList (posisi berlanjut di halaman 2)', () => {
    const tips = Array.from({ length: 13 }, (_, i) => summary({ slug: `t-${i}`, title: `T ${i}` }));
    const page2 = tipsCollectionJsonLd(tips, SITE, 2);
    expect(page2).toMatchObject({ '@type': 'CollectionPage', url: 'https://cutlesshairstudio.com/tips/halaman/2/' });
    expect(page2.mainEntity).toMatchObject({ '@type': 'ItemList', numberOfItems: 13 });
    expect(page2.mainEntity.itemListElement).toEqual([{ '@type': 'ListItem', position: 13, url: 'https://cutlesshairstudio.com/tips/t-12/', name: 'T 12' }]);
  });
});

describe('toggle, sitemap & llms.txt', () => {
  const tips = [summary({ slug: 'cara', title: 'Cara', summary: 'Ringkasan cara.', publishedAt: '2026-10-20', updatedAt: '2026-10-25' })];
  const site = (showTips: boolean) => contentFixture({ settings: { ...contentFixture().settings, showTips } });

  it('mati (default): /tips & /tips/* 301 ke beranda, tidak di sitemap & llms.txt', () => {
    expect(contentFixture().settings.showTips).toBe(false);
    expect(tipsVisible({ showTips: null })).toBe(false);
    expect(tipsRedirects(false).map((r) => r.split(/\s+/))).toEqual([
      ['/tips', '/', '301'],
      ['/tips/*', '/', '301'],
    ]);
    expect(sitemap(site(false), tips)).not.toContain('/tips');
    expect(llmsTxt(site(false), tips)).not.toContain('Tips');
  });

  it('aktif: /tips/ & artikel di sitemap (lastmod = diperbarui/terbit), llms.txt memuat judul + link + ringkasan', () => {
    expect(tipsRedirects(true)).toEqual([]);
    const xml = sitemap(site(true), tips);
    expect(xml).toContain('<loc>https://cutlesshairstudio.com/tips/</loc><lastmod>2026-10-25</lastmod>');
    expect(xml).toContain('<loc>https://cutlesshairstudio.com/tips/cara/</loc><lastmod>2026-10-25</lastmod>');
    const llms = llmsTxt(site(true), tips);
    expect(llms).toContain('- [Tips & Trik](https://cutlesshairstudio.com/tips/)');
    expect(llms).toContain('## Tips & Trik\n\n- [Cara](https://cutlesshairstudio.com/tips/cara/): Ringkasan cara.');
    expect(tipsLlmsLines([], SITE.siteUrl)).toEqual([]);
  });
});

describe('Pages CMS: pilihan penulis & layanan, gambar di Markdown', () => {
  it('blok @barber-options diisi nama Barber (urut "Urutan", tanpa duplikat)', () => {
    const yaml = 'a:\n  # @barber-options-start\n  values:\n    - name: "Lama"\n  # @barber-options-end\nb: 1';
    const { text, count, blocks } = syncNameOptions(yaml, 'barber', [{ name: 'Dua', order: 20 }, { name: 'Satu', order: 10 }, { name: 'Satu', order: 30 }, { name: ' ' }]);
    expect({ count, blocks }).toEqual({ count: 2, blocks: 1 });
    expect(text).toBe('a:\n  # @barber-options-start\n  values:\n    - name: "Satu"\n      label: "Satu"\n    - name: "Dua"\n      label: "Dua"\n  # @barber-options-end\nb: 1');
    expect(syncNameOptions(text, 'barber', [{ name: 'Satu', order: 10 }, { name: 'Dua', order: 20 }]).text).toBe(text);
  });

  it('foto .jpg dikompres ke .webp → path di frontmatter & ![alt](…) artikel ikut diganti (path utuh saja)', () => {
    const md = 'cover: /uploads/tips/a.jpg\n---\n![x](/uploads/tips/a.jpg) /uploads/tips/a.jpg-lama.jpg';
    expect(replaceImagePath(md, '/uploads/tips/a.jpg', '/uploads/tips/a.webp', true)).toBe('cover: /uploads/tips/a.webp\n---\n![x](/uploads/tips/a.webp) /uploads/tips/a.jpg-lama.jpg');
    expect(replaceImagePath('{"image":"/uploads/a.jpg"}', '/uploads/a.jpg', '/uploads/a.webp')).toBe('{"image":"/uploads/a.webp"}');
  });
});

describe('E-E-A-T: poin penting, FAQ artikel, kotak penulis', () => {
  const issues = (v: Record<string, unknown>) => {
    const r = tipSchema.safeParse({ ...FM, ...v });
    return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  };
  const faq = [{ question: 'Berapa lama fade bertahan?', answer: 'Sekitar 2–3 minggu.' }];

  it('Poin penting: kosong atau 2–5 butir, masing-masing ≤ 140 karakter', () => {
    expect(issues({ keyPoints: [] })).toEqual([]);
    expect(issues({ keyPoints: ['Satu.', 'Dua.'] })).toEqual([]);
    expect(issues({ keyPoints: ['Satu.'] })[0]).toMatch(/^keyPoints: isi minimal 2 poin penting, atau kosongkan/);
    expect(issues({ keyPoints: ['1', '2', '3', '4', '5', '6'] })[0]).toMatch(/^keyPoints: maksimal 5 poin penting/);
    expect(issues({ keyPoints: ['x'.repeat(141), 'Dua.'] })[0]).toMatch(/^keyPoints\.0: maksimal 140 karakter/);
  });

  it('FAQ artikel: maks. 5, pertanyaan ≤ 120 & jawaban ≤ 400, keduanya wajib', () => {
    expect(issues({ faq })).toEqual([]);
    expect(issues({ faq: Array(6).fill(faq[0]) })[0]).toMatch(/^faq: maksimal 5 pertanyaan/);
    expect(issues({ faq: [{ question: 'x'.repeat(121), answer: 'a' }] })[0]).toMatch(/^faq\.0\.question: maksimal 120/);
    expect(issues({ faq: [{ question: 'q', answer: 'x'.repeat(401) }] })[0]).toMatch(/^faq\.0\.answer: maksimal 400/);
    expect(issues({ faq: [{ question: 'q', answer: '' }] })[0]).toMatch(/^faq\.0\.answer: jawaban wajib diisi/);
  });

  it('Barber: bio singkat ≤ 200 & pengalaman ≤ 60 (opsional)', () => {
    const barber = { name: 'A', photo: '/uploads/barbers/a.webp', branchSlug: 'x' };
    expect(barberSchema.safeParse(barber).success).toBe(true);
    expect(barberSchema.safeParse({ ...barber, bio: 'x'.repeat(200), experience: 'x'.repeat(60) }).success).toBe(true);
    expect(barberSchema.safeParse({ ...barber, bio: 'x'.repeat(201) }).success).toBe(false);
    expect(barberSchema.safeParse({ ...barber, experience: 'x'.repeat(61) }).success).toBe(false);
  });

  const author = { name: 'Barber Uji', role: 'Hairstylist', photo: '/uploads/barbers/uji.jpg', specialty: 'Fade, Crop', bio: 'Bio uji.', experience: '8 tahun' };
  const [tip] = run([file('cara.md', { ...frontmatter, author: 'Barber Uji', keyPoints: ['Poin satu.', 'Poin dua.'], faq })]).published;

  it('ringkasan statis memuat poin penting, FAQ (dt/dd), dan kotak penulis (jabatan, nama → kartu kapster, pengalaman, keahlian, bio)', () => {
    const html = tipBody(tip, [], author);
    expect(html).toContain('<h2>Poin penting</h2><ul><li>Poin satu.</li><li>Poin dua.</li></ul>');
    expect(html).toContain('<h2>Tanya jawab</h2><dl><dt>Berapa lama fade bertahan?</dt><dd>Sekitar 2–3 minggu.</dd></dl>');
    expect(html).toContain('<h2>Tentang penulis</h2><p>Hairstylist</p><p><a href="/#hairstylist">Barber Uji</a></p><p><span>Pengalaman</span> <span>8 tahun</span></p><p>Keahlian</p><ul><li>Fade</li><li>Crop</li></ul><p>Bio uji.</p>');
    const [plain] = run([file('a.md', frontmatter)]).published;
    expect(tipBody(plain, [])).not.toMatch(/Poin penting|Tanya jawab|Tentang penulis/);
  });

  it('JSON-LD: author Person lengkap (jobTitle, image .webp, url, bio, keahlian) & FAQPage artikel', () => {
    expect(tipJsonLd(tip, SITE, author).author).toEqual({
      '@type': 'Person',
      name: 'Barber Uji',
      jobTitle: 'Hairstylist',
      image: 'https://cutlesshairstudio.com/uploads/barbers/uji.webp',
      description: 'Bio uji.',
      knowsAbout: ['Fade', 'Crop'],
      url: 'https://cutlesshairstudio.com/#hairstylist',
      worksFor: { '@id': 'https://cutlesshairstudio.com/#organization' },
    });
    expect(tipFaqJsonLd(tip, SITE)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': 'https://cutlesshairstudio.com/tips/cara/#faq',
      url: 'https://cutlesshairstudio.com/tips/cara/',
      mainEntity: [{ '@type': 'Question', name: faq[0].question, acceptedAnswer: { '@type': 'Answer', text: faq[0].answer } }],
    });
    expect(tipHead(tip, SITE, {}, author)).toContain('"@type":"FAQPage"');
    const [plain] = run([file('a.md', frontmatter)]).published;
    expect(tipFaqJsonLd(plain, SITE)).toBeUndefined();
    expect(tipHead(plain, SITE)).not.toContain('FAQPage');
  });
});

describe('CTA & bagikan', () => {
  it('pesan CTA menyebut judul artikel; judul terpanjang + nama usaha & cabang terpanjang tetap ≤ 500 karakter', () => {
    expect(tipCtaMessage('Cara Merawat Jenggot')).toBe('Halo {brand} cabang {branch}, saya baca tips "Cara Merawat Jenggot" di website, mau konsultasi soal rambut saya.');
    // Seperti useBooking: {brand} = nama usaha (maks. 80), {branch} = nama cabang (maks. 80)
    const longest = fillTemplate(withBranchPlaceholder(tipCtaMessage('x'.repeat(70))), { brand: 'b'.repeat(80), branch: 'c'.repeat(80) });
    expect(longest.length).toBeLessThanOrEqual(500);
    // Kurung kurawal di judul tidak dianggap placeholder
    expect(tipCtaMessage('Tips {brand} hemat')).toContain('"Tips brand hemat"');
  });

  it('Bagikan ke WhatsApp: wa.me/?text=judul + link (tanpa nomor)', () => {
    expect(whatsappShareUrl('Cara Fade & Crop', 'https://cutlesshairstudio.com/tips/cara/')).toBe(
      'https://wa.me/?text=Cara%20Fade%20%26%20Crop%20https%3A%2F%2Fcutlesshairstudio.com%2Ftips%2Fcara%2F',
    );
  });
});

describe('halaman kategori /tips/kategori/<slug>/', () => {
  const tips = [
    ...Array.from({ length: 13 }, (_, i) => summary({ slug: `g-${i}`, title: `G ${i}`, category: 'Grooming', publishedAt: `2026-09-${String(i + 1).padStart(2, '0')}` })),
    summary({ slug: 'h', title: 'H', category: 'Hair Care', publishedAt: '2026-10-20', updatedAt: '2026-10-25' }),
  ];

  it('URL → halaman: daftar, kategori (+ halaman ke-n), artikel; kategori tak dikenal & slug cadangan ditolak', () => {
    expect(parseTipsPath('/tips/')).toEqual({ kind: 'index', page: 1 });
    expect(parseTipsPath('/tips/halaman/2/')).toEqual({ kind: 'index', page: 2 });
    expect(parseTipsPath('/tips/kategori/hair-care')).toEqual({ kind: 'index', category: 'Hair Care', page: 1 });
    expect(parseTipsPath('/tips/kategori/tips-barbershop/halaman/3/index.html')).toEqual({ kind: 'index', category: 'Tips Barbershop', page: 3 });
    expect(parseTipsPath('/tips/cara-merawat/')).toEqual({ kind: 'article', slug: 'cara-merawat' });
    expect(parseTipsPath('/tips/kategori/jenggot/')).toBeUndefined();
    expect(parseTipsPath('/tips/kategori/')).toBeUndefined();
    expect(parseTipsPath('/produk/')).toBeUndefined();
    expect(tipsPagePath(2, 'Hair Care')).toBe('/tips/kategori/hair-care/halaman/2/');
  });

  it('eyebrow /tips/ berbeda dengan judul; halaman kategori: judul = kategori, deskripsi sendiri', () => {
    expect(tipsCopy.heading.kicker).toBe('Dari kursi barber');
    expect(tipsCopy.heading.kicker).not.toBe(tipsCopy.heading.title);
    const body = tipsIndexBody(tips, 1, 'Hair Care');
    expect(body).toContain(`<p>Tips &amp; Trik</p><h1>Hair Care</h1><p>${tipsCopy.categoryIntro['Hair Care']}</p>`);
    expect(tipsIndexBody(tips, 1)).toContain('<p>Dari kursi barber</p><h1>Tips &amp; Trik</h1>');
  });

  it('chip kategori = link ke halaman kategori (tanpa JavaScript), kategori aktif aria-current', () => {
    const body = tipsIndexBody(tips, 1, 'Grooming');
    // Urutan = urutan pilihan Kategori di CMS
    expect(body).toContain('<li><a href="/tips/">Semua</a></li><li><a href="/tips/kategori/hair-care/">Hair Care</a></li><li><a href="/tips/kategori/grooming/" aria-current="page">Grooming</a></li>');
    expect(body).not.toContain('?kategori=');
  });

  it('paginasi per kategori (12 per halaman); head: title, description, canonical, CollectionPage + BreadcrumbList', () => {
    expect(tipsIndexBody(tips, 1, 'Grooming')).toContain('<p>Halaman 1 dari 2</p> <a href="/tips/kategori/grooming/halaman/2/">Berikutnya</a>');
    expect(tipsIndexBody(tips, 2, 'Grooming').match(/<h2>/g)).toHaveLength(1);
    const head = tipsIndexHead(tips, SITE, 2, '', 'Grooming');
    expect(head).toContain('<title>Grooming: Tips &amp; Trik (Halaman 2) | Cutless Hair Studio</title>');
    expect(head).toContain(`<meta name="description" content="${tipsCopy.categoryIntro.Grooming}" />`);
    expect(head).toContain('<link rel="canonical" href="https://cutlesshairstudio.com/tips/kategori/grooming/halaman/2/" />');
    expect(head).toContain('{"@type":"ListItem","position":3,"name":"Grooming","item":"https://cutlesshairstudio.com/tips/kategori/grooming/"}');
    const ld = tipsCollectionJsonLd(tips, SITE, 2, 'Grooming');
    expect(ld).toMatchObject({ '@type': 'CollectionPage', url: 'https://cutlesshairstudio.com/tips/kategori/grooming/halaman/2/' });
    expect(ld.mainEntity).toMatchObject({ numberOfItems: 13 });
    expect(ld.mainEntity.itemListElement).toHaveLength(1);
  });

  it('sitemap: halaman kategori (lastmod terbaru kategori itu) hanya untuk kategori berartikel', () => {
    const paths = tipsSitemapEntries(tips);
    expect(paths).toEqual(
      expect.arrayContaining([
        { path: '/tips/kategori/grooming/', lastmod: '2026-09-13' },
        { path: '/tips/kategori/grooming/halaman/2/', lastmod: '2026-09-13' },
        { path: '/tips/kategori/hair-care/', lastmod: '2026-10-25' },
      ]),
    );
    expect(paths.some((p) => p.path.includes('/kategori/produk/'))).toBe(false);
  });
});

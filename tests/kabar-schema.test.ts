/**
 * Skema Kabar, Promo & Acara (src/content/kabar/*.md) + toggle Pengaturan Situs.
 * Kolom milik jenis lain DIABAIKAN (dibuang dari hasil), bukan ditolak: Pages CMS menampilkan semua kolom untuk semua
 * jenis, dan menolak berarti build produksi gagal tanpa admin tahu sebabnya. Data uji di sini, bukan isi CMS.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT_FILES, kabarSchema } from '../src/content/schema';
import { rawFixture } from './helpers/contentFixture';

const kabar = () => ({
  title: 'Kabar Terbaru Studio',
  publishedAt: '2026-11-01',
  kind: 'Kabar',
  branches: ['semua'],
  summary: 'Ringkasan singkat kabar.',
  status: 'Terbit',
  body: 'Isi kabar.',
});
const promo = () => ({ ...kabar(), kind: 'Promo', validUntil: '2026-12-31' });
const acara = () => ({
  ...kabar(),
  kind: 'Acara',
  startsAt: '2026-12-20T10:00',
  endsAt: '2026-12-20T12:00',
  locationType: 'Di cabang',
});
const tempatLain = () => ({ ...acara(), locationType: 'Tempat lain', venueName: 'Balai Warga', venueAddress: 'Jl. Contoh No. 1' });

const ok = (v: unknown) => kabarSchema.safeParse(v).success;
const messages = (v: unknown) => {
  const r = kabarSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('kabarSchema: jenis valid', () => {
  it('Kabar, Promo, Acara valid', () => {
    expect(ok(kabar())).toBe(true);
    expect(ok(promo())).toBe(true);
    expect(ok({ ...promo(), validFrom: '2026-12-01' })).toBe(true);
    expect(ok(acara())).toBe(true);
    expect(ok(tempatLain())).toBe(true);
  });

  it('Promo: validUntil wajib; validFrom > validUntil ditolak, sama diterima', () => {
    expect(ok({ ...promo(), validUntil: undefined })).toBe(false);
    expect(ok({ ...promo(), validUntil: '' })).toBe(false);
    expect(ok({ ...promo(), validFrom: '2027-01-01' })).toBe(false);
    expect(ok({ ...promo(), validFrom: '2026-12-31' })).toBe(true);
  });

  it('Acara: startsAt/endsAt/locationType wajib, format YYYY-MM-DDTHH:mm', () => {
    expect(ok({ ...acara(), startsAt: undefined })).toBe(false);
    expect(ok({ ...acara(), endsAt: undefined })).toBe(false);
    expect(ok({ ...acara(), locationType: undefined })).toBe(false);
    expect(ok({ ...acara(), startsAt: '2026-12-20' })).toBe(false);
    expect(ok({ ...acara(), endsAt: '2026-12-20' })).toBe(false);
  });

  it('Acara: endsAt < startsAt ditolak, endsAt = startsAt diterima', () => {
    expect(ok({ ...acara(), endsAt: '2026-12-20T09:59' })).toBe(false);
    expect(ok({ ...acara(), endsAt: '2026-12-20T10:00' })).toBe(true);
  });

  it('Acara: Tempat lain wajib nama & alamat, batas 80 / 200; Di cabang dengan venueName = diabaikan', () => {
    expect(ok({ ...tempatLain(), venueAddress: undefined })).toBe(false);
    expect(ok({ ...tempatLain(), venueName: undefined })).toBe(false);
    expect(ok({ ...tempatLain(), venueName: 'x'.repeat(80) })).toBe(true);
    expect(ok({ ...tempatLain(), venueName: 'x'.repeat(81) })).toBe(false);
    expect(ok({ ...tempatLain(), venueAddress: 'x'.repeat(200) })).toBe(true);
    expect(ok({ ...tempatLain(), venueAddress: 'x'.repeat(201) })).toBe(false);
    const diCabang = kabarSchema.parse({ ...acara(), venueName: 'Sisa lama' });
    expect(diCabang).not.toHaveProperty('venueName');
  });

  it('linkUrl hanya https://, hanya untuk Acara', () => {
    expect(ok({ ...acara(), linkUrl: 'https://contoh.id/daftar' })).toBe(true);
    expect(ok({ ...acara(), linkUrl: 'http://contoh.id/daftar' })).toBe(false);
    expect(kabarSchema.parse({ ...acara(), linkUrl: 'https://contoh.id' }).linkUrl).toBe('https://contoh.id');
    expect(kabarSchema.parse({ ...promo(), linkUrl: 'http://tidak-dicek' })).not.toHaveProperty('linkUrl');
  });
});

describe('kabarSchema: pesan kolom wajib per jenis (bahasa Indonesia, label CMS)', () => {
  const kosong = [undefined, null, ''];
  it.each(kosong)('Promo tanpa validUntil (%s)', (v) => {
    expect(messages({ ...promo(), validUntil: v })).toEqual(['validUntil: Berlaku sampai wajib diisi untuk jenis Promo']);
  });
  it.each(kosong)('Acara tanpa startsAt / endsAt / locationType (%s)', (v) => {
    expect(messages({ ...acara(), startsAt: v })).toEqual(['startsAt: Mulai wajib diisi untuk jenis Acara']);
    expect(messages({ ...acara(), endsAt: v })).toEqual(['endsAt: Selesai wajib diisi untuk jenis Acara']);
    expect(messages({ ...acara(), locationType: v })).toEqual(['locationType: Lokasi wajib diisi untuk jenis Acara']);
  });
  it.each(kosong)('Tempat lain tanpa venueName / venueAddress (%s)', (v) => {
    expect(messages({ ...tempatLain(), venueName: v })).toEqual(['venueName: Nama tempat wajib diisi untuk lokasi Tempat lain']);
    expect(messages({ ...tempatLain(), venueAddress: v })).toEqual(['venueAddress: Alamat tempat wajib diisi untuk lokasi Tempat lain']);
  });
  it('beberapa kolom kosong sekaligus dilaporkan semuanya', () => {
    expect(messages({ ...acara(), startsAt: undefined, endsAt: undefined })).toEqual([
      'startsAt: Mulai wajib diisi untuk jenis Acara',
      'endsAt: Selesai wajib diisi untuk jenis Acara',
    ]);
  });
  it('tanggal YAML tanpa tanda kutip (Date) diterima dan dinormalkan; nilai output di-trim', () => {
    const r = kabarSchema.parse({ ...promo(), validFrom: new Date('2026-12-01'), validUntil: new Date('2026-12-31') });
    expect(r).toMatchObject({ validFrom: '2026-12-01', validUntil: '2026-12-31' });
    expect(kabarSchema.parse({ ...acara(), linkUrl: '  https://contoh.id  ' }).linkUrl).toBe('https://contoh.id');
    expect(kabarSchema.parse({ ...promo(), validFrom: ' 2026-12-01 ' })).toMatchObject({ validFrom: '2026-12-01' });
  });
});

describe('kabarSchema: Draf boleh setengah terisi, Terbit wajib lengkap', () => {
  const draf = { status: 'Draf' };
  it('Draf Promo tanpa validUntil valid; Terbit tanpa validUntil ditolak dengan pesan Indonesia', () => {
    expect(ok({ ...promo(), ...draf, validUntil: undefined })).toBe(true);
    expect(messages({ ...promo(), validUntil: undefined })).toEqual(['validUntil: Berlaku sampai wajib diisi untuk jenis Promo']);
  });
  it('Draf Acara tanpa startsAt/endsAt/locationType valid; Terbit ditolak', () => {
    const kosong = { startsAt: undefined, endsAt: null, locationType: '' };
    expect(ok({ ...acara(), ...draf, ...kosong })).toBe(true);
    expect(messages({ ...acara(), ...kosong })).toEqual([
      'startsAt: Mulai wajib diisi untuk jenis Acara',
      'endsAt: Selesai wajib diisi untuk jenis Acara',
      'locationType: Lokasi wajib diisi untuk jenis Acara',
    ]);
  });
  it('Draf Tempat lain tanpa venueName/venueAddress valid; Terbit ditolak', () => {
    const kosong = { venueName: undefined, venueAddress: '' };
    expect(ok({ ...tempatLain(), ...draf, ...kosong })).toBe(true);
    expect(messages({ ...tempatLain(), ...kosong })).toEqual([
      'venueName: Nama tempat wajib diisi untuk lokasi Tempat lain',
      'venueAddress: Alamat tempat wajib diisi untuk lokasi Tempat lain',
    ]);
  });
  it('Draf tetap memeriksa format/batas kolom yang terisi', () => {
    expect(ok({ ...acara(), ...draf, startsAt: '2026-12-20' })).toBe(false);
    expect(ok({ ...acara(), ...draf, endsAt: '2026-12-20T09:00' })).toBe(false);
    expect(ok({ ...acara(), ...draf, endsAt: undefined, startsAt: '2026-12-20T10:00' })).toBe(true);
    expect(ok({ ...promo(), ...draf, validFrom: '2027-01-01' })).toBe(false);
    expect(ok({ ...promo(), ...draf, validUntil: 'ngawur' })).toBe(false);
    expect(ok({ ...tempatLain(), ...draf, venueName: 'x'.repeat(81) })).toBe(false);
    expect(ok({ ...acara(), ...draf, linkUrl: 'http://salah' })).toBe(false);
  });
  it('transform Draf tidak melempar dan tidak membawa kolom kosong', () => {
    const r = kabarSchema.parse({ ...acara(), ...draf, startsAt: undefined, endsAt: undefined, locationType: undefined });
    expect(r).not.toHaveProperty('startsAt');
    expect(kabarSchema.parse({ ...promo(), ...draf, validUntil: undefined })).not.toHaveProperty('validUntil');
  });
});

describe('kabarSchema: kolom jenis lain diabaikan', () => {
  const EVENT = ['startsAt', 'endsAt', 'locationType', 'venueName', 'venueAddress', 'linkUrl'];
  const PROMO = ['validFrom', 'validUntil'];

  it('Promo dengan kolom acara terisi = valid, kolom acara dibuang', () => {
    const r = kabarSchema.safeParse({
      ...promo(),
      startsAt: 'bukan tanggal',
      endsAt: '2020-01-01T00:00',
      locationType: 'Tempat lain',
      venueName: 'x'.repeat(500),
      linkUrl: 'http://salah',
    });
    expect(r.success).toBe(true);
    for (const k of EVENT) expect(r.data).not.toHaveProperty(k);
    expect(r.data).toHaveProperty('validUntil', '2026-12-31');
  });

  it('Acara dengan kolom promo terisi = valid, kolom promo dibuang', () => {
    const r = kabarSchema.safeParse({ ...acara(), validUntil: '2020-01-01', validFrom: 'ngawur' });
    expect(r.success).toBe(true);
    for (const k of PROMO) expect(r.data).not.toHaveProperty(k);
    expect(r.data).toHaveProperty('startsAt', '2026-12-20T10:00');
  });

  it('Kabar dengan kolom promo/acara terisi (termasuk endsAt < startsAt) = valid, semuanya dibuang', () => {
    const r = kabarSchema.safeParse({
      ...kabar(),
      validFrom: '2027-01-01',
      validUntil: '2026-01-01',
      startsAt: '2026-12-20T10:00',
      endsAt: '2026-12-19T10:00',
      locationType: 'Tempat lain',
      venueName: 'Tempat',
      venueAddress: 'Alamat',
      linkUrl: 'https://contoh.id',
    });
    expect(r.success).toBe(true);
    for (const k of [...EVENT, ...PROMO]) expect(r.data).not.toHaveProperty(k);
  });

  it('nilai kosong/null kolom jenis sendiri dianggap tidak ada', () => {
    expect(ok({ ...promo(), validFrom: null })).toBe(true);
    expect(ok({ ...tempatLain(), linkUrl: '' })).toBe(true);
  });
});

describe('kabarSchema: kolom umum', () => {
  it('batas judul 80, ringkasan 160', () => {
    expect(ok({ ...kabar(), title: 'x'.repeat(80) })).toBe(true);
    expect(ok({ ...kabar(), title: 'x'.repeat(81) })).toBe(false);
    expect(ok({ ...kabar(), summary: 'x'.repeat(160) })).toBe(true);
    expect(ok({ ...kabar(), summary: 'x'.repeat(161) })).toBe(false);
  });

  it('waLabel maksimal 40', () => {
    expect(ok({ ...kabar(), waLabel: 'x'.repeat(40) })).toBe(true);
    expect(ok({ ...kabar(), waLabel: 'x'.repeat(41) })).toBe(false);
  });

  it('gambar: /uploads/kabar/ webp/jpg/png, alt wajib bila ada gambar, alt tanpa gambar diterima', () => {
    const img = { image: '/uploads/kabar/a.webp', imageAlt: 'Suasana studio' };
    expect(ok({ ...kabar(), ...img })).toBe(true);
    expect(ok({ ...kabar(), image: '/uploads/kabar/a.jpg', imageAlt: 'x' })).toBe(true);
    expect(ok({ ...kabar(), image: '/uploads/kabar/a.png', imageAlt: 'x' })).toBe(true);
    expect(messages({ ...kabar(), image: img.image }).join()).toMatch(/imageAlt/);
    expect(ok({ ...kabar(), image: img.image, imageAlt: '' })).toBe(false);
    expect(ok({ ...kabar(), ...img, imageAlt: 'x'.repeat(151) })).toBe(false);
    expect(ok({ ...kabar(), imageAlt: 'Alt tanpa gambar' })).toBe(true);
    expect(ok({ ...kabar(), image: '/uploads/kabar/a.gif', imageAlt: 'x' })).toBe(false);
    expect(ok({ ...kabar(), image: '/uploads/tips/a.webp', imageAlt: 'x' })).toBe(false);
    expect(ok({ ...kabar(), image: '', imageAlt: '' })).toBe(true);
  });

  it('branches: tidak boleh kosong; semua harus sendirian; slug cabang diterima', () => {
    expect(ok({ ...kabar(), branches: [] })).toBe(false);
    expect(ok({ ...kabar(), branches: ['semua', 'cibubur'] })).toBe(false);
    expect(ok({ ...kabar(), branches: ['cibubur', 'bogor-bantarjati'] })).toBe(true);
    expect(ok({ ...kabar(), branches: ['semua'] })).toBe(true);
    expect(ok({ ...kabar(), branches: ['Cibubur Raya'] })).toBe(false);
  });

  it('Terbit wajib punya isi; Draf boleh kosong', () => {
    expect(ok({ ...kabar(), body: '' })).toBe(false);
    expect(ok({ ...kabar(), body: undefined })).toBe(false);
    expect(ok({ ...kabar(), status: 'Draf', body: '' })).toBe(true);
  });

  it('kind & status di luar pilihan ditolak; publishedAt wajib YYYY-MM-DD; slug opsional', () => {
    expect(ok({ ...kabar(), kind: 'Berita' })).toBe(false);
    expect(ok({ ...kabar(), status: 'Publik' })).toBe(false);
    expect(ok({ ...kabar(), publishedAt: '01-11-2026' })).toBe(false);
    expect(ok({ ...kabar(), slug: 'promo-akhir-tahun' })).toBe(true);
    expect(ok({ ...kabar(), slug: '' })).toBe(true);
    expect(ok({ ...kabar(), slug: 'Salah Slug' })).toBe(false);
  });
});

describe('toggle Pengaturan Situs', () => {
  it('showKabar dan showKabarBanner default false bila kuncinya tidak ada', () => {
    const { showKabar: _k, showKabarBanner: _b, ...tanpa } = { ...rawFixture.settings, showKabar: true, showKabarBanner: true };
    const parsed = (CONTENT_FILES['settings.json'] as unknown as { parse: (v: unknown) => Record<string, unknown> }).parse(tanpa);
    expect(parsed.showKabar).toBe(false);
    expect(parsed.showKabarBanner).toBe(false);
  });
});

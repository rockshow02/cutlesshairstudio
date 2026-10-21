/**
 * Data tetap untuk E2E (build `vite build --mode e2e`, lihat .env.e2e), agar perubahan dari Pages CMS
 * (mis. cabang diubah "Segera Dibuka", nomor WhatsApp diganti) tidak membuat tes gagal.
 *
 * Cabang uji ditimpa/ditambahkan ke data asli: dua cabang Aktif di dua kota, buka setiap hari, nomor WhatsApp
 * berbeda. Cabang lain dari CMS dibiarkan apa adanya (relasi barber/harga/promo ke cabang itu tetap valid).
 * Dipakai build (scripts/vite-content-plugin.ts) dan tes (e2e/*.spec.ts) sehingga keduanya membaca data yang sama.
 *
 * Barber diganti seluruhnya dengan dua barber uji di cabang Bogor (satu bernomor WhatsApp sendiri, satu memakai
 * nomor cabang). Fotonya meminjam gambar yang sudah ada di public/uploads (tidak ada file uji yang ikut ter-deploy).
 * Logo Partner diganti 5 partner uji (lihat E2E_PARTNERS). Partner Cuci Sepatu dinyalakan dengan data uji (E2E_SHOE_CARE).
 * Daftar Harga diganti daftar uji 3 kategori (E2E_PRICING): format "K" & "Start from".
 */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

type Json = Record<string, unknown>;

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const openEveryDay = DAYS.map((day) => ({ day, openTime: '09:00', closeTime: '21:00', isClosed: false }));

export const E2E_BRANCHES = {
  bogor: {
    slug: 'bogor-bantarjati',
    name: 'Bogor Bantarjati',
    city: 'Bogor',
    province: 'Jawa Barat',
    whatsappNumber: '6281100000101',
    timezone: 'Asia/Jakarta',
    openingHours: openEveryDay,
    status: 'Aktif',
    order: 10,
  },
  cibubur: {
    slug: 'cibubur',
    name: 'Cibubur',
    city: 'Cibubur',
    province: 'Jawa Barat',
    whatsappNumber: '6281100000202',
    timezone: 'Asia/Jakarta',
    openingHours: openEveryDay,
    status: 'Aktif',
    order: 20,
  },
} as const;

export const E2E_BARBERS = [
  { name: 'Barber Uji Satu', role: 'Hairstylist', branchSlug: 'bogor-bantarjati', whatsappNumber: '6281100000303', order: 10, isActive: true },
  { name: 'Barber Uji Dua', role: 'Hairstylist', branchSlug: 'bogor-bantarjati', whatsappNumber: '', order: 20, isActive: true },
] as const;

/** Gambar .webp pertama yang ada di public/uploads (utamakan foto barber) */
function existingPhoto(): string {
  const uploads = path.resolve('public', 'uploads');
  for (const dir of ['barbers', 'gallery', 'branches', 'about', 'hero', 'cta']) {
    const abs = path.join(uploads, dir);
    if (!existsSync(abs)) continue;
    const file = readdirSync(abs).find((f) => /\.webp$/i.test(f) && !/-\d+\.webp$/i.test(f));
    if (file) return `/uploads/${dir}/${file}`;
  }
  throw new Error('E2E: tidak ada gambar .webp di public/uploads untuk foto barber uji');
}

/**
 * Pita logo partner: 5 partner uji (nama fiktif). 3 memakai logo situs yang sudah ada (latar transparan),
 * 2 tanpa logo (nama tampil sebagai teks). Satu berlink https.
 */
export const E2E_PARTNERS = [
  { name: 'Partner Uji Satu', withLogo: true, url: 'https://example.com/partner-satu' },
  { name: 'Partner Uji Dua', withLogo: false, url: '' },
  { name: 'Partner Uji Tiga', withLogo: true, url: '' },
  { name: 'Partner Uji Empat', withLogo: false, url: '' },
  { name: 'Partner Uji Lima', withLogo: true, url: '' },
] as const;
export const E2E_PARTNER_LABEL = 'Partner & Kolaborasi';

/** Logo .webp/.png yang sudah ada di public/uploads/site (logo situs) */
function existingLogo(): string {
  const dir = path.resolve('public', 'uploads', 'site');
  const file = existsSync(dir) ? readdirSync(dir).find((f) => /\.(webp|png)$/i.test(f)) : undefined;
  if (!file) throw new Error('E2E: tidak ada logo di public/uploads/site untuk logo partner uji');
  return `/uploads/site/${file}`;
}

/** Partner Cuci Sepatu uji (nama fiktif, tanpa harga) di cabang Bogor, nomor WhatsApp partner sendiri */
export const E2E_SHOE_CARE = {
  name: 'Cuci Sepatu Uji',
  branchSlug: 'bogor-bantarjati',
  whatsappNumber: '6281100000505',
  services: [
    { name: 'Deep Clean Uji', description: 'Pembersihan menyeluruh bagian luar dan dalam.', estimate: '±2 hari', icon: 'wash' },
    { name: 'Fast Clean Uji', description: 'Pembersihan bagian luar.', estimate: '±30 menit', icon: 'clock' },
    { name: 'Unyellowing Uji', description: 'Mengurangi warna kuning pada sol.', estimate: '' },
  ],
  menuUrl: 'https://drive.google.com/file/d/uji-daftar-menu/view',
} as const;

function shoeCareFixture(): Json {
  const photo = existingPhoto();
  return {
    enabled: true,
    showTeaser: true,
    branchSlug: E2E_SHOE_CARE.branchSlug,
    name: E2E_SHOE_CARE.name,
    logo: '',
    tagline: 'Tagline uji cuci sepatu.',
    description: 'Deskripsi uji layanan cuci sepatu partner.',
    heroImage: '',
    aboutTitle: 'Tentang partner uji',
    aboutParagraphs: ['Paragraf About Us uji pertama.', 'Paragraf About Us uji kedua.'],
    aboutImage: '',
    aboutImageAlt: '',
    menuUrl: E2E_SHOE_CARE.menuUrl,
    advantages: [
      { title: 'Keunggulan uji satu', description: 'Deskripsi keunggulan satu.', icon: 'check' },
      { title: 'Keunggulan uji dua', description: 'Deskripsi keunggulan dua.', icon: 'clock' },
      { title: 'Keunggulan uji tiga', description: 'Deskripsi keunggulan tiga.', icon: 'wash' },
    ],
    services: E2E_SHOE_CARE.services.map((s, i) => ({ ...s, isActive: true, order: (i + 1) * 10 })),
    photos: [
      { image: photo, alt: 'Foto hasil uji satu' },
      { image: photo, alt: 'Foto hasil uji dua' },
    ],
    notes: ['Catatan uji pertama.', 'Catatan uji kedua.'],
    whatsappNumber: E2E_SHOE_CARE.whatsappNumber,
    messageTemplate: 'Halo {partner}, saya mau pesan {service} di Cutless Hair Studio cabang {branch}. (via website Cutless)',
  };
}

/** Daftar Harga uji: 3 kategori aktif (urutan tampil), item lama nonaktif */
export const E2E_PRICING = [
  { name: 'White Grooming Uji', category: 'Haircut', description: 'Haircut + Hair Wash', price: 100000, priceFrom: false },
  { name: 'Black Grooming Uji', category: 'Haircut', price: 175000, priceFrom: false },
  { name: 'Coloring Fashion Uji', category: 'Special Treatment', description: 'Fashion / trend hair coloring', price: 400000, priceFrom: true },
  { name: 'Dreadlock Uji', category: 'Special Treatment', price: 1500000, priceFrom: true },
  { name: 'Woman Haircut Uji', category: 'Woman Haircut & Treatment', description: 'Haircut + Hair Wash', price: 150000, priceFrom: false },
  { name: 'Item Lama Uji', category: 'Coloring', price: 450000, priceFrom: false, isActive: false },
] as const;

/** branches.json asli → cabang uji menimpa cabang dengan slug sama (field lain, mis. alamat & foto, tetap), sisanya utuh */
function fixtureBranches(real: unknown): Json[] {
  const list = Array.isArray(real) ? (real as Json[]) : [];
  const fixtures = Object.values(E2E_BRANCHES) as unknown as Json[];
  const merged = list.map((b) => {
    const f = fixtures.find((x) => x.slug === b.slug);
    return f ? { ...b, ...f } : b;
  });
  for (const f of fixtures) if (!merged.some((b) => b.slug === f.slug)) merged.push({ ...f });
  return merged;
}

/** Terapkan data uji pada isi satu file src/content/<file> */
export function applyE2EFixtures(file: string, data: unknown): unknown {
  if (file === 'branches.json') return fixtureBranches(data);
  if (file === 'barbers.json') return E2E_BARBERS.map((b) => ({ ...b, photo: existingPhoto() }));
  if (file === 'shoeCare.json') return shoeCareFixture();
  if (file === 'pricing.json') return E2E_PRICING.map((p, i) => ({ isActive: true, ...p, order: (i + 1) * 10 }));
  if (file === 'partners.json') {
    return {
      enabled: true,
      label: E2E_PARTNER_LABEL,
      logos: E2E_PARTNERS.map((p, i) => ({ name: p.name, logo: p.withLogo ? existingLogo() : '', url: p.url, isActive: true, order: (i + 1) * 10 })),
    };
  }
  return data;
}

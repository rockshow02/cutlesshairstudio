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
 * Logo Partner diganti 5 partner uji (lihat E2E_PARTNERS). Partner Cuci Sepatu dinyalakan dengan data uji (E2E_SHOE_CARE);
 * file uji yang ikut build E2E (PDF daftar menu, logo hero) ada di e2e/fixtures/public (tidak pernah ke public/).
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

/**
 * Partner Cuci Sepatu uji (nama fiktif) di cabang Bogor, nomor WhatsApp partner sendiri. 5 layanan berharga (termasuk
 * rentang yang ditulis "70-120k" → tampil "70–120K"). Daftar menu: PDF uji (e2e/fixtures/public, hanya disalin ke dist/
 * build E2E) DAN link; PDF harus menang.
 */
export const E2E_SHOE_CARE = {
  name: 'Cuci Sepatu Uji',
  branchSlug: 'bogor-bantarjati',
  whatsappNumber: '6281100000505',
  services: [
    { name: 'Deep Clean Uji', description: 'Pembersihan menyeluruh bagian luar dan dalam.', price: '45K', shownPrice: '45K', estimate: '±2 hari', icon: 'wash' },
    { name: 'Unyellowing Uji', description: 'Mengurangi warna kuning pada sol.', price: '50K', shownPrice: '50K', estimate: '' },
    { name: 'Suede Uji', description: 'Perawatan bahan suede yang kusam agar terlihat seperti baru lagi.', price: '50K', shownPrice: '50K', estimate: '' },
    { name: 'Kids Uji', description: 'Sepatu anak.', price: '30K', shownPrice: '30K', estimate: '' },
    { name: 'Gunung Uji', description: 'Sepatu gunung, harga menyesuaikan ukuran.', price: '70-120k', shownPrice: '70–120K', estimate: '' },
  ],
  menuFile: '/uploads/shoe-care/daftar-menu-uji.pdf',
  heroLogo: '/uploads/shoe-care/logo-hero-uji.svg',
  heroKicker: 'Partner Cuci Sepatu Uji',
  aboutLogo: '/uploads/shoe-care/logo-about-uji.svg',
  menuUrl: 'https://drive.google.com/file/d/uji-daftar-menu/view',
} as const;

/** Cuci Sepatu uji. variant "uniform": tanpa Logo hero (judul hero = nama partner sebagai teks) */
function shoeCareFixture(variant?: string): Json {
  const photo = existingPhoto();
  return {
    enabled: true,
    showTeaser: true,
    branchSlug: E2E_SHOE_CARE.branchSlug,
    name: E2E_SHOE_CARE.name,
    // Teks kecil hero: kustom (bawaan) / dikosongkan (uniform → kicker tidak tampil)
    heroKicker: variant === 'uniform' ? '' : E2E_SHOE_CARE.heroKicker,
    // Logo kecil: folder media shoe-care (sama dengan form CMS) → logo uji SVG putih di e2e/fixtures/public
    logo: E2E_SHOE_CARE.heroLogo,
    // Logo hero uji (SVG putih 1200 × 240) di e2e/fixtures/public: hanya disalin ke dist/ build E2E
    heroLogo: variant === 'uniform' ? '' : E2E_SHOE_CARE.heroLogo,
    tagline: 'Tagline uji cuci sepatu.',
    description: 'Deskripsi uji layanan cuci sepatu partner.',
    heroImage: '',
    aboutTitle: 'Tentang partner uji',
    aboutParagraphs: ['Paragraf About Us uji pertama.', 'Paragraf About Us uji kedua.'],
    // About Us: foto berbingkai (bawaan) / logo SVG transparan tanpa bingkai (uniform)
    aboutImage: variant === 'uniform' ? E2E_SHOE_CARE.aboutLogo : photo,
    aboutImageAlt: variant === 'uniform' ? 'Logo About Us uji' : 'Foto About Us uji',
    aboutImagePlain: variant === 'uniform',
    menuFile: E2E_SHOE_CARE.menuFile,
    menuUrl: E2E_SHOE_CARE.menuUrl,
    advantages: [
      { title: 'Keunggulan uji satu', description: 'Deskripsi keunggulan satu.', icon: 'check' },
      { title: 'Keunggulan uji dua', description: 'Deskripsi keunggulan dua.', icon: 'clock' },
      { title: 'Keunggulan uji tiga', description: 'Deskripsi keunggulan tiga.', icon: 'wash' },
    ],
    services: E2E_SHOE_CARE.services.map(({ shownPrice: _shown, ...s }, i) => ({ ...s, isActive: true, order: (i + 1) * 10 })),
    photos: [
      { image: photo, alt: 'Foto hasil uji satu' },
      { image: photo, alt: 'Foto hasil uji dua' },
    ],
    notes: ['Catatan uji pertama.', 'Catatan uji kedua.'],
    whatsappNumber: E2E_SHOE_CARE.whatsappNumber,
    messageTemplate: 'Halo {partner}, saya mau pesan {service} di Cutless Hair Studio cabang {branch}. (via website Cutless)',
  };
}

/**
 * Daftar Harga uji: 3 kategori aktif (urutan tampil), item lama nonaktif. Harga per cabang (build E2E bawaan):
 * Black Grooming Uji berharga lain di Cibubur, Hanya Bogor Uji hanya tersedia di Bogor → pemilih cabang tampil.
 * Varian "uniform" (E2E_VARIANT=uniform, .env.e2e-uniform): daftar yang sama tanpa harga per cabang & "Tersedia di
 * cabang" → semua cabang sama, pemilih tersembunyi. Varian ini juga: Cuci Sepatu tanpa Logo hero (judul = teks), teks
 * kecil hero dikosongkan, dan About Us berisi logo SVG tanpa bingkai.
 */
export const E2E_CIBUBUR_PRICE = { name: 'Black Grooming Uji', price: 185000, shown: '185K', base: '175K' } as const;
export const E2E_BOGOR_ONLY = 'Hanya Bogor Uji';
export const E2E_PRICING = [
  { name: 'White Grooming Uji', category: 'Haircut', description: 'Haircut + Hair Wash', price: 100000, priceFrom: false },
  { name: 'Black Grooming Uji', category: 'Haircut', price: 175000, priceFrom: false, branchPrices: [{ branchSlug: 'cibubur', price: E2E_CIBUBUR_PRICE.price }] },
  { name: E2E_BOGOR_ONLY, category: 'Haircut', price: 120000, priceFrom: false, branchSlugs: ['bogor-bantarjati'] },
  { name: 'Coloring Fashion Uji', category: 'Special Treatment', description: 'Fashion / trend hair coloring', price: 400000, priceFrom: true },
  { name: 'Dreadlock Uji', category: 'Special Treatment', price: 1500000, priceFrom: true },
  { name: 'Woman Haircut Uji', category: 'Woman Haircut & Treatment', description: 'Haircut + Hair Wash', price: 150000, priceFrom: false },
  { name: 'Item Lama Uji', category: 'Coloring', price: 450000, priceFrom: false, isActive: false },
] as const;

/** branches.json asli → cabang uji menimpa cabang dengan slug sama (field lain, mis. alamat & foto, tetap), sisanya utuh */
function fixtureBranches(real: unknown): Json[] {
  // Hanya cabang uji: cabang yang ditambah admin di CMS tidak ikut. Field tampilan lain (alamat, foto, peta) boleh
  // dari cabang asli dengan slug sama; tes tidak memeriksa isinya.
  const list = Array.isArray(real) ? (real as Json[]) : [];
  return (Object.values(E2E_BRANCHES) as unknown as Json[]).map((f) => ({ ...(list.find((b) => b.slug === f.slug) ?? {}), ...f }));
}

/**
 * Produk uji (katalog /produk/, pesan lewat WhatsApp). Tampilkan Produk: mati di build bawaan (/produk → 301 ke beranda,
 * tidak di sitemap), aktif di varian uniform (/produk/ tampil & masuk sitemap).
 */
export const E2E_PRODUCTS = [
  { name: 'Pomade Uji', category: 'Pomade', price: 85000, size: '100 gr', description: 'Pomade uji untuk tes.' },
  { name: 'Hair Clay Uji', category: 'Hair Clay', price: 95000, size: '80 gr', description: 'Hair clay uji untuk tes.' },
] as const;

/**
 * FAQ uji: aktif di build bawaan (2 item tampil; 1 nonaktif & 1 aktif tanpa jawaban harus tersembunyi), mati di varian
 * uniform (bagian & JSON-LD FAQPage tidak ada).
 */
export const E2E_FAQ = {
  title: 'FAQ Uji',
  shown: [
    { question: 'Pertanyaan uji satu?', answer: 'Jawaban uji satu.' },
    { question: 'Pertanyaan uji dua?', answer: 'Jawaban uji dua.' },
  ],
  hidden: ['Pertanyaan nonaktif uji?', 'Pertanyaan tanpa jawaban uji?'],
} as const;

/**
 * Video uji: aktif di build bawaan (2 tampil, urut "Urutan"; link m./tanpa www./reels/?igsh=... dirapikan; 1 nonaktif
 * tersembunyi), mati di varian uniform (bagian tidak ada).
 */
export const E2E_VIDEOS = {
  title: 'Video Uji',
  shown: [
    { url: 'https://www.instagram.com/reel/UjiReelSatu/', caption: 'Video uji satu' },
    { url: 'https://www.instagram.com/p/UjiPostDua/', caption: 'Video uji dua' },
  ],
  hidden: 'Video nonaktif uji',
} as const;

/** Nama usaha (Pages CMS → Pengaturan Situs → Nama usaha) */
export const E2E_SITE_NAME = 'Cutless Hair Studio';

/** Kartu Layanan uji (kategori sama dengan Daftar Harga uji → tombol "Lihat harga") */
const E2E_SERVICES = [
  { name: 'Haircut', description: 'Potong rambut uji.', icon: 'scissors', pricingCategory: 'Haircut' },
  { name: 'Coloring', description: 'Pewarnaan rambut uji.', icon: 'color', pricingCategory: 'Special Treatment' },
  { name: 'Woman Haircut', description: 'Potong rambut wanita uji.', icon: 'scissors', pricingCategory: 'Woman Haircut & Treatment' },
];

/** Pengumuman uji (varian uniform): khusus Cibubur lebih dulu, lalu untuk semua cabang */
export const E2E_ANNOUNCEMENTS = [
  { message: 'Pengumuman uji khusus Cibubur.', type: 'Info', branchSlugs: ['cibubur'] },
  { message: 'Pengumuman uji untuk semua cabang.', type: 'Info' },
] as const;

/** Label tombol utama hero (Pages CMS → Hero bisa mengubahnya kapan saja) */
export const E2E_HERO_CTA = 'Booking Hero Uji';

/** Sampul uji (e2e/fixtures/public, hanya disalin ke dist/ build E2E) */
export const E2E_TIP_COVER = '/uploads/tips/sampul-uji.webp';

/**
 * Artikel Tips & Trik uji (src/content/tips/*.md diganti seluruhnya saat build E2E): 13 artikel Terbit (lebih dari
 * 12 → paginasi /tips/halaman/2/) + 1 Draf yang tidak boleh tampil. Tampil hanya di varian uniform (Tampilkan Tips &
 * Trik aktif); build bawaan: mati → /tips/ 301 ke beranda.
 * - `withToc`: 3 subjudul H2 (daftar isi), penulis Barber Uji Satu, layanan Haircut, gambar di isi artikel
 * - `noToc`: 2 subjudul (tanpa daftar isi), tanpa penulis
 */
export const E2E_TIPS = {
  withToc: {
    slug: 'cara-uji-merawat-rambut',
    title: 'Cara Uji Merawat Rambut',
    summary: 'Ringkasan uji artikel dengan daftar isi.',
    category: 'Hair Care',
    author: 'Barber Uji Satu',
    headings: ['Langkah uji pertama', 'Langkah uji kedua', 'Langkah uji ketiga'],
    service: 'Haircut',
  },
  noToc: { slug: 'gaya-uji-tanpa-daftar-isi', title: 'Gaya Uji Tanpa Daftar Isi', summary: 'Ringkasan uji artikel tanpa daftar isi.', category: 'Hair Style' },
  draft: { slug: 'draf-uji-tidak-tampil', title: 'Draf Uji Tidak Tampil' },
  /** Artikel Terbit seluruhnya (withToc + noToc + 11 artikel "Grooming") */
  publishedCount: 13,
} as const;

const tipFile = (fm: Record<string, unknown>, body: string) => ({
  file: `${fm.slug as string}.md`,
  source: `---\n${Object.entries(fm)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `\n${v.map((x) => `  - ${JSON.stringify(x)}`).join('\n')}` : JSON.stringify(v)}`)
    .join('\n')}\n---\n${body}`,
});

export function e2eTipFiles(): { file: string; source: string }[] {
  const t = E2E_TIPS;
  const base = { cover: E2E_TIP_COVER, coverAlt: 'Foto sampul uji', status: 'Terbit' };
  const words = (n: number) => Array.from({ length: n }, (_, i) => `kata${i}`).join(' ');
  return [
    tipFile(
      { ...base, slug: t.withToc.slug, title: t.withToc.title, summary: t.withToc.summary, category: t.withToc.category, author: t.withToc.author, publishedAt: '2026-10-20', updatedAt: '2026-10-25', services: [t.withToc.service] },
      // ±600 kata → 3 menit baca
      `Paragraf pembuka uji yang langsung menjawab. ${words(600)}\n\n${t.withToc.headings.map((h) => `## ${h}\n\nIsi ${h.toLowerCase()}.`).join('\n\n')}\n\n![Gambar isi uji](${E2E_TIP_COVER})\n\n<script>window.__tipXss = true</script>\n`,
    ),
    tipFile(
      { ...base, slug: t.noToc.slug, title: t.noToc.title, summary: t.noToc.summary, category: t.noToc.category, publishedAt: '2026-10-21' },
      `Paragraf pembuka uji.\n\n## Subjudul uji satu\n\nIsi satu.\n\n## Subjudul uji dua\n\nIsi dua.\n`,
    ),
    ...Array.from({ length: t.publishedCount - 2 }, (_, i) =>
      tipFile(
        { ...base, slug: `grooming-uji-${i + 1}`, title: `Grooming Uji ${i + 1}`, summary: `Ringkasan grooming uji ${i + 1}.`, category: 'Grooming', publishedAt: `2026-09-${String(i + 1).padStart(2, '0')}` },
        `Isi grooming uji ${i + 1}.\n`,
      ),
    ),
    tipFile({ ...base, slug: t.draft.slug, title: t.draft.title, summary: 'Draf uji.', category: 'Produk', publishedAt: '2026-10-28', status: 'Draf' }, 'Belum selesai.\n'),
  ];
}

/** Daftar Harga tanpa harga per cabang & "Tersedia di cabang" (varian uniform) */
const uniformPricing = () => E2E_PRICING.map(({ branchPrices: _bp, branchSlugs: _bs, ...p }: Json) => p);

/** Terapkan data uji pada isi satu file src/content/<file>. variant "uniform" = Daftar Harga sama di semua cabang */
export function applyE2EFixtures(file: string, data: unknown, variant?: string): unknown {
  if (file === 'branches.json') return fixtureBranches(data);
  if (file === 'barbers.json') return E2E_BARBERS.map((b) => ({ ...b, photo: existingPhoto() }));
  if (file === 'shoeCare.json') return shoeCareFixture(variant);
  if (file === 'faq.json') {
    return {
      enabled: variant !== 'uniform',
      kicker: 'FAQ',
      title: E2E_FAQ.title,
      items: [
        { ...E2E_FAQ.shown[1], isActive: true, order: 20 },
        { ...E2E_FAQ.shown[0], isActive: true, order: 10 },
        { question: E2E_FAQ.hidden[0], answer: 'Tidak boleh tampil.', isActive: false, order: 30 },
        { question: E2E_FAQ.hidden[1], isActive: true, order: 40 },
      ],
    };
  }
  if (file === 'videos.json') {
    return {
      enabled: variant !== 'uniform',
      kicker: 'Video',
      title: E2E_VIDEOS.title,
      items: [
        { url: 'https://m.instagram.com/p/UjiPostDua?igsh=uji123', image: existingPhoto(), caption: E2E_VIDEOS.shown[1].caption, isActive: true, order: 20 },
        { url: 'https://instagram.com/reels/UjiReelSatu/', image: existingPhoto(), caption: E2E_VIDEOS.shown[0].caption, isActive: true, order: 10 },
        { url: 'https://www.instagram.com/reel/UjiNonaktif/', image: existingPhoto(), caption: E2E_VIDEOS.hidden, isActive: false, order: 30 },
      ],
    };
  }
  if (file === 'hero.json') return { ...(data as Json), primaryCtaLabel: E2E_HERO_CTA };
  if (file === 'settings.json') {
    // Toggle & nama usaha tetap (tata letak beranda & selector tidak ikut berubah saat admin mengubahnya di CMS)
    return { ...(data as Json), siteName: E2E_SITE_NAME, showProducts: variant === 'uniform', showTips: variant === 'uniform', showTestimonials: false, showBeforeAfter: false, enablePreloader: true, preloaderVideo: '' };
  }
  // Promo bertanggal (tampil/tidak tergantung jam) → tidak ada di build uji. Pengumuman tanpa tanggal hanya di varian
  // uniform (e2e/announcement.spec.ts); build bawaan tanpa bar pengumuman.
  if (file === 'promos.json') return [];
  if (file === 'announcements.json') return variant === 'uniform' ? E2E_ANNOUNCEMENTS.map((a) => ({ ...a, isActive: true })) : [];
  if (file === 'gallery.json') return [1, 2, 3, 4].map((n) => ({ image: existingPhoto(), altText: `Foto galeri uji ${n}`, caption: `Galeri uji ${n}`, styleCategory: 'Lainnya', focalPoint: 'atas', showInMarquee: true, isActive: true, order: n * 10 }));
  if (file === 'services.json') return E2E_SERVICES.map((c, i) => ({ ...c, isActive: true, order: (i + 1) * 10 }));
  if (file === 'products.json') return E2E_PRODUCTS.map((p, i) => ({ ...p, image: existingPhoto(), inStock: true, isActive: true, order: (i + 1) * 10 }));
  if (file === 'pricing.json') return (variant === 'uniform' ? uniformPricing() : [...E2E_PRICING]).map((p, i) => ({ isActive: true, ...p, order: (i + 1) * 10 }));
  if (file === 'partners.json') {
    return {
      enabled: true,
      label: E2E_PARTNER_LABEL,
      logos: E2E_PARTNERS.map((p, i) => ({ name: p.name, logo: p.withLogo ? existingLogo() : '', url: p.url, isActive: true, order: (i + 1) * 10 })),
    };
  }
  return data;
}

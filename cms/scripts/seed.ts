/**
 * Seed awal: impor konten statis dari frontend/src/content ke Strapi (termasuk upload gambar),
 * supaya pemilik tidak perlu input ulang.
 *
 *   npm run seed            → buat data yang belum ada (data yang sudah ada TIDAK diubah)
 *   npm run seed -- --force → timpa data yang sudah ada dengan isi file statis
 *
 * Aman dijalankan berulang: setiap entri dicocokkan dengan kunci alami
 * (harga: nama+kategori, barber: nama, galeri: alt text, file: nama file), jadi tidak ada data ganda.
 * Jalankan dari folder cms/. Strapi tidak perlu dalam keadaan running (script memuat Strapi sendiri),
 * tapi hentikan `npm run develop` dulu bila memakai SQLite agar database tidak terkunci.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileStrapi, createStrapi, type Core } from '@strapi/strapi';

import { pricing } from '../../frontend/src/content/pricing';
import { barbers } from '../../frontend/src/content/barbers';
import { gallery } from '../../frontend/src/content/gallery';
import { site } from '../../frontend/src/content/site';
import { socials } from '../../frontend/src/content/socials';
import { locations } from '../../frontend/src/content/locations';
import type { GalleryStyle, OpeningHour } from '../../frontend/src/types';

const FORCE = process.argv.includes('--force');
const FRONTEND_DIR = path.resolve(process.cwd(), process.env.SEED_FRONTEND_DIR ?? '../frontend');
const PUBLIC_DIR = path.join(FRONTEND_DIR, 'public');

const UID = {
  pricing: 'api::pricing-item.pricing-item',
  barber: 'api::barber.barber',
  gallery: 'api::gallery-item.gallery-item',
  settings: 'api::site-setting.site-setting',
} as const;

type Uid = (typeof UID)[keyof typeof UID];
type Data = Record<string, unknown>;
type Result = 'created' | 'updated' | 'skipped';

const stats: Record<string, Record<Result, number>> = {};
const count = (group: string, r: Result) => {
  stats[group] ??= { created: 0, updated: 0, skipped: 0 };
  stats[group][r] += 1;
};

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/* ---------- Media ---------- */

interface UploadedFile {
  id: number;
  name: string;
}

/** Upload gambar dari frontend/public. Dilewati bila file dengan nama sama sudah ada di Media Library. */
async function uploadImage(app: Core.Strapi, publicPath: string, alt: string): Promise<UploadedFile> {
  const abs = path.join(PUBLIC_DIR, publicPath.replace(/^\//, ''));
  const name = path.basename(abs);
  const existing = (await app.db.query('plugin::upload.file').findOne({ where: { name } })) as UploadedFile | null;
  if (existing) {
    count('media', 'skipped');
    return existing;
  }
  if (!fs.existsSync(abs)) throw new Error(`Gambar tidak ditemukan: ${abs}`);

  // Salin ke folder sementara: provider upload boleh memindahkan/menghapus file sumber
  const tmp = path.join(os.tmpdir(), `cutless-seed-${Date.now()}-${name}`);
  fs.copyFileSync(abs, tmp);
  const size = fs.statSync(tmp).size;
  const mimetype = MIME[path.extname(name).toLowerCase()] ?? 'application/octet-stream';

  try {
    const uploaded = (await app
      .plugin('upload')
      .service('upload')
      .upload({
        data: { fileInfo: { name, alternativeText: alt, caption: alt } },
        files: { filepath: tmp, originalFilename: name, originalFileName: name, mimetype, size },
      })) as UploadedFile[];
    count('media', 'created');
    return uploaded[0];
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/* ---------- Dokumen ---------- */

async function upsert(app: Core.Strapi, group: string, uid: Uid, filters: Data, data: Data): Promise<Result> {
  const docs = app.documents(uid);
  const found = (await docs.findFirst({ filters } as never)) as { documentId: string } | null;
  if (found && !FORCE) {
    count(group, 'skipped');
    return 'skipped';
  }
  if (found) {
    await docs.update({ documentId: found.documentId, data } as never);
    count(group, 'updated');
    return 'updated';
  }
  await docs.create({ data } as never);
  count(group, 'created');
  return 'created';
}

/* ---------- Seeder per konten ---------- */

async function seedPricing(app: Core.Strapi) {
  let order = 10;
  for (const category of pricing.categories) {
    for (const item of category.items) {
      await upsert(app, 'pricing', UID.pricing, { name: item.name, category: category.id }, {
        name: item.name,
        category: category.id,
        price: item.price,
        priceFrom: item.priceFrom ?? false,
        description: item.description ?? null,
        badge: item.badge ?? null,
        order,
        isActive: true,
      });
      order += 10;
    }
  }
  for (const pkg of pricing.packages) {
    await upsert(app, 'pricing', UID.pricing, { name: pkg.name, category: 'Paket' }, {
      name: pkg.name,
      category: 'Paket',
      price: pkg.price,
      priceFrom: false,
      // Isi paket: satu baris per poin (dibaca frontend sebagai daftar fitur)
      description: pkg.features.join('\n'),
      badge: pkg.badge ?? (pkg.featured ? 'Best Seller' : null),
      order,
      isActive: true,
    });
    order += 10;
  }
}

async function seedBarbers(app: Core.Strapi) {
  let order = 10;
  for (const barber of barbers.items) {
    const photo = await uploadImage(app, barber.photo.src, barber.photo.alt);
    await upsert(app, 'barbers', UID.barber, { name: barber.name }, {
      name: barber.name,
      role: barber.role ?? null,
      photo: photo.id,
      specialty: barber.specialties.join(', '),
      whatsappNumber: barber.whatsappNumber ?? null,
      instagram: barber.instagram ?? null,
      order,
      isActive: true,
    });
    order += 10;
  }
}

function guessStyle(text: string): GalleryStyle {
  if (/fade|taper/i.test(text)) return 'Fade';
  if (/pompadour/i.test(text)) return 'Pompadour';
  if (/crop/i.test(text)) return 'Crop';
  if (/colou?r/i.test(text)) return 'Coloring';
  if (/perm/i.test(text)) return 'Perming';
  return 'Lainnya';
}

async function seedGallery(app: Core.Strapi) {
  let order = 10;
  for (const item of gallery.items) {
    const image = await uploadImage(app, item.image.src, item.image.alt);
    await upsert(app, 'gallery', UID.gallery, { altText: item.image.alt }, {
      image: image.id,
      altText: item.image.alt,
      caption: item.caption ?? null,
      styleCategory: item.styleCategory ?? guessStyle(`${item.caption ?? ''} ${item.image.alt}`),
      order,
      isActive: true,
    });
    order += 10;
  }
}

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABEL: Record<number, string> = { 0: 'Minggu', 1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu' };
const toTime = (t?: string) => (t ? `${t}:00.000` : null);

async function seedSettings(app: Core.Strapi) {
  const primary = locations.items[0];
  const hours = [...(primary?.hours ?? [])].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
  const a = primary?.address;
  const address = a ? [a.street, a.area, `${a.city}, ${a.province} ${a.postalCode}`].filter(Boolean).join(', ') : null;
  const url = (platform: string) => socials.find((s) => s.platform === platform)?.url ?? null;
  const logo = await uploadImage(app, site.logo.stacked.src, site.logo.stacked.alt);

  const data: Data = {
    siteName: site.brandName,
    logo: logo.id,
    mainWhatsappNumber: site.whatsapp.number,
    defaultWaMessage: site.whatsapp.templates.general,
    instagramUrl: url('instagram'),
    tiktokUrl: url('tiktok'),
    googleMapsUrl: primary?.map.directionsUrl ?? url('google'),
    address,
    footerText: site.footer.description,
    openingHours: hours.map((h: OpeningHour) => ({
      day: DAY_LABEL[h.day],
      openTime: h.closed ? null : toTime(h.open),
      closeTime: h.closed ? null : toTime(h.close),
      isClosed: Boolean(h.closed),
    })),
  };

  const docs = app.documents(UID.settings);
  const existing = (await docs.findFirst({} as never)) as { documentId: string } | null;
  if (existing && !FORCE) return count('settings', 'skipped');
  if (existing) {
    await docs.update({ documentId: existing.documentId, data } as never);
    return count('settings', 'updated');
  }
  await docs.create({ data } as never);
  count('settings', 'created');
}

/* ---------- Main ---------- */

async function main() {
  console.log(`Seed Cutless CMS${FORCE ? ' (--force: menimpa data yang ada)' : ''}`);
  console.log(`Sumber gambar: ${PUBLIC_DIR}`);

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    await seedSettings(app);
    await seedPricing(app);
    await seedBarbers(app);
    await seedGallery(app);
  } finally {
    await app.destroy();
  }

  console.table(stats);
  console.log('Selesai. Data yang sudah ada dilewati; jalankan dengan --force untuk menimpa.');
}

main().catch((error) => {
  console.error('Seed gagal:', error);
  process.exit(1);
});

import type { Core } from '@strapi/strapi';
import { OPENING_HOUR_COMPONENT, UID } from './uids';

/**
 * Label, bantuan, dan placeholder field di panel admin (Content Manager) dalam bahasa Indonesia,
 * plus kolom yang tampil di daftar dan field utama. Disinkronkan setiap start.
 * (Strapi menyimpan label tampilan di konfigurasi Content Manager, bukan di schema.json.)
 */
interface FieldText {
  label: string;
  description?: string;
  placeholder?: string;
}

interface ViewConfig {
  mainField: string;
  defaultSortBy?: string;
  defaultSortOrder?: 'ASC' | 'DESC';
  listColumns: string[];
  fields: Record<string, FieldText>;
}

const ORDER: FieldText = { label: 'Urutan', description: 'Angka kecil tampil lebih dulu (1, 2, 3, ...).' };
const ACTIVE: FieldText = { label: 'Tampilkan di website', description: 'Matikan untuk menyembunyikan tanpa menghapus.' };
const WA: FieldText = {
  label: 'Nomor WhatsApp',
  description: 'Format 62xxxxxxxxxx, tanpa +, spasi, atau strip. Contoh: 6281234567890',
  placeholder: '6281234567890',
};

const VIEWS: Record<string, ViewConfig> = {
  [UID.pricing]: {
    mainField: 'name',
    defaultSortBy: 'order',
    defaultSortOrder: 'ASC',
    listColumns: ['name', 'category', 'price', 'badge', 'isActive'],
    fields: {
      name: { label: 'Nama layanan', placeholder: 'Signature Haircut' },
      category: { label: 'Kategori', description: 'Pilih "Paket" untuk paket/membership (tampil sebagai kartu).' },
      price: { label: 'Harga (Rupiah)', description: 'Angka saja, tanpa titik/Rp. Contoh: 75000', placeholder: '75000' },
      priceFrom: { label: 'Harga mulai', description: 'Aktifkan bila harga bisa lebih tinggi (tampil "mulai Rp ...").' },
      description: {
        label: 'Keterangan',
        description: 'Opsional. Untuk kategori Paket: tulis isi paket, satu baris per poin.',
      },
      badge: { label: 'Label khusus', description: 'Opsional: Best Seller, Baru, atau Promo.' },
      order: ORDER,
      isActive: ACTIVE,
    },
  },
  [UID.barber]: {
    mainField: 'name',
    defaultSortBy: 'order',
    defaultSortOrder: 'ASC',
    listColumns: ['photo', 'name', 'role', 'specialty', 'isActive'],
    fields: {
      name: { label: 'Nama panggilan', placeholder: 'Raka' },
      role: { label: 'Jabatan', description: 'Opsional, mis. Head Hairstylist.', placeholder: 'Senior Hairstylist' },
      photo: { label: 'Foto', description: 'Wajib. Potret tegak (rasio 3:4), min. 900 px tinggi.' },
      specialty: { label: 'Spesialisasi', description: 'Pisahkan dengan koma.', placeholder: 'Skin fade, Pompadour' },
      whatsappNumber: { ...WA, label: 'WhatsApp pribadi', description: `${WA.description}. Kosongkan untuk memakai nomor utama.` },
      instagram: { label: 'Link Instagram', placeholder: 'https://instagram.com/namabarber' },
      order: ORDER,
      isActive: ACTIVE,
    },
  },
  [UID.gallery]: {
    mainField: 'altText',
    defaultSortBy: 'order',
    defaultSortOrder: 'ASC',
    listColumns: ['image', 'altText', 'styleCategory', 'isActive'],
    fields: {
      image: { label: 'Foto', description: 'Wajib. Foto tegak tampil tinggi, foto lebar tampil lebar (otomatis).' },
      altText: {
        label: 'Deskripsi foto',
        description: 'Wajib. Jelaskan isi foto untuk pengguna tunanetra & Google.',
        placeholder: 'Mid fade dengan textured crop',
      },
      styleCategory: { label: 'Gaya rambut' },
      caption: { label: 'Keterangan singkat', description: 'Opsional, tampil saat foto dibuka.' },
      order: ORDER,
      isActive: ACTIVE,
    },
  },
  [UID.promo]: {
    mainField: 'title',
    defaultSortBy: 'startDate',
    defaultSortOrder: 'DESC',
    listColumns: ['title', 'startDate', 'endDate', 'isActive'],
    fields: {
      title: { label: 'Judul promo', placeholder: 'Diskon 20% Haircut Weekday' },
      description: { label: 'Deskripsi', description: 'Syarat & ketentuan singkat.' },
      image: { label: 'Gambar', description: 'Opsional. Rasio lebar (16:10) paling bagus.' },
      ctaLabel: { label: 'Teks tombol', placeholder: 'Ambil Promo' },
      waMessage: {
        label: 'Pesan WhatsApp',
        description: 'Pesan otomatis saat tombol diklik. Boleh pakai {brand} dan {promo}. Kosong = pesan booking umum.',
        placeholder: 'Halo {brand}, saya mau pakai promo {promo} untuk [hari/jam].',
      },
      startDate: { label: 'Mulai', description: 'Waktu sesuai zona komputer Anda (WIB bila di Indonesia).' },
      endDate: { label: 'Selesai', description: 'Harus setelah tanggal mulai. Promo hilang otomatis setelah ini.' },
      isActive: ACTIVE,
    },
  },
  [UID.announcement]: {
    mainField: 'message',
    defaultSortBy: 'updatedAt',
    defaultSortOrder: 'DESC',
    listColumns: ['message', 'type', 'startDate', 'endDate', 'isActive'],
    fields: {
      message: {
        label: 'Pesan',
        description: 'Maks. 160 karakter.',
        placeholder: 'Studio tutup Senin, 20 Okt untuk renovasi. Buka lagi Selasa jam 10.00.',
      },
      type: { label: 'Jenis', description: 'Info, Tutup (lebih menonjol), atau Jam Khusus.' },
      startDate: { label: 'Mulai tampil', description: 'Opsional. Kosong = langsung tampil setelah dipublikasikan.' },
      endDate: { label: 'Selesai tampil', description: 'Opsional. Kosong = tampil sampai dimatikan.' },
      isActive: ACTIVE,
    },
  },
  [UID.settings]: {
    mainField: 'siteName',
    listColumns: ['siteName'],
    fields: {
      logo: { label: 'Logo', description: 'Logo footer (PNG transparan, versi putih).' },
      siteName: { label: 'Nama usaha', placeholder: 'Cutless Hair Studio' },
      mainWhatsappNumber: { ...WA, label: 'Nomor WhatsApp utama', description: `${WA.description}. Dipakai semua tombol booking.` },
      defaultWaMessage: {
        label: 'Pesan booking default',
        description: 'Boleh pakai {brand}. Contoh: Halo {brand}, saya mau booking haircut untuk [hari/jam].',
      },
      instagramUrl: { label: 'Link Instagram', description: 'Kosongkan untuk menyembunyikan ikon.', placeholder: 'https://instagram.com/cutlesshairstudio' },
      tiktokUrl: { label: 'Link TikTok', description: 'Kosongkan untuk menyembunyikan ikon.', placeholder: 'https://tiktok.com/@cutlesshairstudio' },
      googleMapsUrl: { label: 'Link Google Maps', description: 'Dipakai tombol "Petunjuk Arah".' },
      address: { label: 'Alamat lengkap' },
      footerText: { label: 'Teks footer', description: 'Kalimat singkat di bawah logo footer.' },
      openingHours: { label: 'Jam buka', description: 'Satu baris per hari, urut Senin–Minggu.' },
    },
  },
};

const COMPONENT_FIELDS: Record<string, FieldText> = {
  day: { label: 'Hari' },
  openTime: { label: 'Jam buka' },
  closeTime: { label: 'Jam tutup' },
  isClosed: { label: 'Tutup seharian' },
};

type Metadata = { edit?: Record<string, unknown>; list?: Record<string, unknown> };
interface Configuration {
  settings: Record<string, unknown>;
  metadatas: Record<string, Metadata>;
  layouts: { list: string[]; edit: unknown };
}
interface ConfigService {
  findContentType?(uid: string): { uid: string } | null;
  findComponent?(uid: string): { uid: string } | null;
  findConfiguration(model: { uid: string }): Promise<Configuration>;
  updateConfiguration(model: { uid: string }, config: Partial<Configuration>): Promise<unknown>;
}

function withLabels(metadatas: Record<string, Metadata>, fields: Record<string, FieldText>): Record<string, Metadata> {
  const next = { ...metadatas };
  for (const [field, text] of Object.entries(fields)) {
    const current = next[field] ?? {};
    next[field] = {
      ...current,
      edit: {
        ...current.edit,
        label: text.label,
        description: text.description ?? '',
        placeholder: text.placeholder ?? '',
      },
      list: { ...current.list, label: text.label },
    };
  }
  return next;
}

export async function ensureAdminLabels(strapi: Core.Strapi) {
  const contentTypes = strapi.plugin('content-manager').service('content-types') as unknown as ConfigService;
  const components = strapi.plugin('content-manager').service('components') as unknown as ConfigService;

  for (const [uid, view] of Object.entries(VIEWS)) {
    const model = contentTypes.findContentType?.(uid);
    if (!model) continue;
    const config = await contentTypes.findConfiguration(model);
    await contentTypes.updateConfiguration(model, {
      settings: {
        ...config.settings,
        mainField: view.mainField,
        ...(view.defaultSortBy ? { defaultSortBy: view.defaultSortBy, defaultSortOrder: view.defaultSortOrder ?? 'ASC' } : {}),
      },
      metadatas: withLabels(config.metadatas, view.fields),
      layouts: { ...config.layouts, list: view.listColumns },
    });
  }

  const component = components.findComponent?.(OPENING_HOUR_COMPONENT);
  if (component) {
    const config = await components.findConfiguration(component);
    await components.updateConfiguration(component, {
      settings: { ...config.settings, mainField: 'day' },
      metadatas: withLabels(config.metadatas, COMPONENT_FIELDS),
    });
  }
}

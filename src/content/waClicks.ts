/**
 * Hitungan klik tombol WhatsApp: aturan bersama browser (src/lib/waClickTracking.ts), build (daftar yang diizinkan,
 * dist/klik-wa.json), dan Worker (worker/waClicks.ts, worker/stats.ts). Tanpa DOM.
 * Yang dicatat hanya: jenis tombol, cabang, kapster, halaman asal, asal kunjungan (kelompok domain), per hari.
 * TIDAK ada IP, nomor HP, isi pesan, cookie, atau ID pengunjung.
 */

export const WA_CLICK_ENDPOINT = '/api/klik-wa';
/** Daftar cabang, kapster, & halaman yang diizinkan (dibuat saat build oleh scripts/vite-content-plugin.ts) */
export const WA_CLICK_ALLOWLIST_PATH = '/klik-wa.json';
/** Batas ukuran kiriman (byte); kiriman normal ±120 byte */
export const WA_CLICK_MAX_BYTES = 512;
/** Halaman asal yang tidak ada di daftar (mis. halaman baru sebelum daftar diperbarui) */
export const OTHER_PAGE = 'lainnya';

export const WA_CLICK_KINDS = {
  umum: 'Booking umum',
  cabang: 'Tombol cabang',
  kapster: 'Booking kapster',
  tips: 'CTA artikel Tips',
  'cuci-sepatu': 'Partner Cuci Sepatu',
  produk: 'Pesan produk',
  promo: 'Promo',
} as const;
export type WaClickKind = keyof typeof WA_CLICK_KINDS;

/** Asal kunjungan: domain referrer dikelompokkan; yang disimpan hanya id kelompok */
export const REFERRER_SOURCES: readonly { id: string; label: string; hosts: RegExp }[] = [
  { id: 'google', label: 'Google', hosts: /(^|\.)google(\.[a-z]{2,3}){1,2}$/ },
  { id: 'instagram', label: 'Instagram', hosts: /(^|\.)instagram\.com$/ },
  { id: 'facebook', label: 'Facebook', hosts: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/ },
  { id: 'tiktok', label: 'TikTok', hosts: /(^|\.)tiktok\.com$/ },
  { id: 'youtube', label: 'YouTube', hosts: /(^|\.)(youtube\.com|youtu\.be)$/ },
  { id: 'whatsapp', label: 'WhatsApp', hosts: /(^|\.)(whatsapp\.com|wa\.me)$/ },
  { id: 'x', label: 'X (Twitter)', hosts: /(^|\.)(x\.com|twitter\.com|t\.co)$/ },
  { id: 'threads', label: 'Threads', hosts: /(^|\.)threads\.(net|com)$/ },
  { id: 'bing', label: 'Bing', hosts: /(^|\.)bing\.com$/ },
  { id: 'yahoo', label: 'Yahoo', hosts: /(^|\.)yahoo\.com$/ },
  { id: 'duckduckgo', label: 'DuckDuckGo', hosts: /(^|\.)duckduckgo\.com$/ },
  { id: 'chatgpt', label: 'ChatGPT', hosts: /(^|\.)(chatgpt\.com|openai\.com)$/ },
];
export const SOURCE_LABELS: Record<string, string> = {
  ...Object.fromEntries(REFERRER_SOURCES.map((s) => [s.id, s.label])),
  langsung: 'Langsung / aplikasi',
  lainnya: 'Situs lain',
};

/** Domain referrer → id kelompok ('' = langsung, tak dikenal = lainnya) */
export function referrerSource(host: string): string {
  const h = host.trim().toLowerCase().replace(/\.$/, '');
  if (!h) return 'langsung';
  if (!/^[a-z0-9.-]{1,253}$/.test(h)) return 'lainnya';
  return REFERRER_SOURCES.find((s) => s.hosts.test(h))?.id ?? 'lainnya';
}

/** Kunci kapster dari nama (stabil walau urutan kapster di CMS berubah), mis. "Soemardi(erte)" → soemardi-erte */
export const barberKey = (name: string): string =>
  name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** Kiriman browser → Worker (nama pendek agar kecil) */
export interface WaClickPayload {
  /** jenis tombol */
  k: string;
  /** slug cabang */
  b?: string;
  /** kunci kapster */
  s?: string;
  /** path halaman asal */
  p: string;
  /** host referrer kunjungan ('' = langsung) */
  r?: string;
}

/** dist/klik-wa.json */
export interface WaClickAllowlist {
  /** slug → nama cabang */
  branches: Record<string, string>;
  /** kunci → nama kapster */
  barbers: Record<string, string>;
  /** path halaman yang ada di situs */
  pages: string[];
}

/** Satu klik yang sudah divalidasi (kolom tabel wa_clicks, tanpa day & clicks) */
export interface WaClickRow {
  kind: WaClickKind;
  branch: string;
  barber: string;
  page: string;
  source: string;
}

/** Path halaman → bentuk kanonis (/cabang/cibubur → /cabang/cibubur/) */
export function normalizePage(path: string): string {
  const p = path.split(/[?#]/)[0].toLowerCase().replace(/\/{2,}/g, '/');
  const withSlash = p.startsWith('/') ? p : `/${p}`;
  return withSlash.endsWith('/') || /\.[a-z0-9]+$/.test(withSlash) ? withSlash : `${withSlash}/`;
}

const KEYS = new Set(['k', 'b', 's', 'p', 'r']);
const has = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key);

/**
 * Kiriman → baris yang aman disimpan, atau null (ditolak). Hanya nilai dari daftar yang diizinkan:
 * jenis tombol (WA_CLICK_KINDS), cabang & kapster (klik-wa.json), halaman (klik-wa.json, selain itu "lainnya"),
 * asal kunjungan (REFERRER_SOURCES, selain itu "lainnya"). Kunci lain / nilai bukan teks / terlalu panjang = ditolak.
 */
export function validateWaClick(input: unknown, allow: WaClickAllowlist): WaClickRow | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  if (Object.keys(o).some((k) => !KEYS.has(k))) return null;
  const str = (v: unknown, max: number) => (v === undefined ? '' : typeof v === 'string' && v.length <= max ? v : null);
  const [kind, branch, barber, page, ref] = [str(o.k, 20), str(o.b, 80), str(o.s, 80), str(o.p, 200), str(o.r, 253)];
  if (kind === null || branch === null || barber === null || page === null || ref === null) return null;
  if (!has(WA_CLICK_KINDS, kind) || !page.startsWith('/')) return null;
  if (branch && !has(allow.branches, branch)) return null;
  if (barber && !has(allow.barbers, barber)) return null;
  if (kind === 'kapster' && !barber) return null;
  const path = normalizePage(page);
  return { kind: kind as WaClickKind, branch, barber, page: allow.pages.includes(path) ? path : OTHER_PAGE, source: referrerSource(ref) };
}

/** Tanggal WIB (UTC+7, tanpa musim panas) dari waktu epoch ms → YYYY-MM-DD */
export const dayWIB = (ms: number): string => new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10);

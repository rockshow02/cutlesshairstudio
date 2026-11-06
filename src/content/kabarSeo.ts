import { parseWIB } from '../lib/dates';

/**
 * Halaman Kabar, Promo & Acara (/kabar/ & /kabar/<slug>/) mengikuti Pengaturan Situs → Tampilkan Kabar saat build,
 * sama seperti /tips/: mati → HTML /kabar/ tidak ikut di-build, /kabar & /kabar/* dialihkan 301 ke beranda.
 * Fungsi murni tanpa Zod: dipakai plugin build dan kode browser. Semua perbandingan waktu dalam WIB (parseWIB),
 * bukan zona waktu mesin (CI berjalan di UTC).
 */
export const KABAR_PATH = '/kabar/';

export const KABAR_KINDS = ['Kabar', 'Promo', 'Acara'] as const;
export type KabarKind = (typeof KABAR_KINDS)[number];

export const KABAR_STATUSES = ['Draf', 'Terbit'] as const;

/** Nilai "Cabang" yang berarti semua cabang */
export const KABAR_ALL_BRANCHES = 'semua';

export const KABAR_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const KABAR_LOCATION_TYPES = ['Di cabang', 'Tempat lain'] as const;
export type KabarLocationType = (typeof KABAR_LOCATION_TYPES)[number];

export const kabarVisible = (settings: { showKabar?: boolean | null }): boolean => settings.showKabar === true;

/** Banner hanya tampil bila halaman Kabar sendiri menyala */
export const kabarBannerVisible = (settings: { showKabar?: boolean | null; showKabarBanner?: boolean | null }): boolean =>
  kabarVisible(settings) && settings.showKabarBanner === true;

/** Aturan _redirects (Cloudflare Workers static assets) saat halaman Kabar mati */
export function kabarRedirects(visible: boolean): string[] {
  return visible ? [] : ['/kabar    /   301', '/kabar/*  /   301'];
}

export const kabarPath = (slug: string): string => `${KABAR_PATH}${slug}/`;

export type KabarRoute = { kind: 'index' } | { kind: 'item'; slug: string };

/** URL → halaman Kabar: /kabar/ (juga /kabar & /kabar/index.html) atau /kabar/<slug>/. Selain itu → undefined. */
export function parseKabarPath(pathname: string): KabarRoute | undefined {
  const path = pathname.replace(/index\.html$/, '').replace(/\/?$/, '/');
  if (path === KABAR_PATH) return { kind: 'index' };
  const m = path.match(/^\/kabar\/([a-z0-9-]+)\/$/);
  return m && KABAR_SLUG.test(m[1]) ? { kind: 'item', slug: m[1] } : undefined;
}

/** Data ringkas satu item terbit (kartu, kotak cabang, banner, sitemap, llms.txt) */
export interface KabarSummary {
  slug: string;
  title: string;
  summary: string;
  kind: KabarKind;
  /** Slug cabang, atau 'semua' */
  branches: string[];
  /** YYYY-MM-DD */
  publishedAt: string;
  image?: string;
  imageAlt?: string;
  /** Promo: YYYY-MM-DD */
  validFrom?: string;
  validUntil?: string;
  /** Acara: YYYY-MM-DDTHH:mm (WIB) */
  startsAt?: string;
  endsAt?: string;
}

/** Item lengkap (halaman detail): isi sudah HTML hasil render Markdown saat build */
export interface KabarArticle extends KabarSummary {
  html: string;
  waLabel?: string;
  locationType?: KabarLocationType;
  venueName?: string;
  venueAddress?: string;
  linkUrl?: string;
}

export type KabarStatus = 'akan-datang' | 'berlangsung' | 'berakhir';

/** Epoch ms mulai; hanya kolom milik jenisnya (Promo: validFrom, Acara: startsAt) */
export function kabarStartMs(k: KabarSummary): number | undefined {
  const v = k.kind === 'Promo' ? k.validFrom : k.kind === 'Acara' ? k.startsAt : undefined;
  return v ? parseWIB(v) : undefined;
}

/**
 * Epoch ms berakhir. Promo: akhir hari validUntil. Acara: endsAt, atau akhir hari startsAt bila endsAt kosong.
 * Kabar: tidak pernah.
 */
export function kabarEndMs(k: KabarSummary): number | undefined {
  if (k.kind === 'Promo') return k.validUntil ? parseWIB(k.validUntil, true) : undefined;
  if (k.kind === 'Acara') {
    if (k.endsAt) return parseWIB(k.endsAt);
    return k.startsAt ? parseWIB(k.startsAt.slice(0, 10), true) : undefined;
  }
  return undefined;
}

/**
 * Epoch ms PERTAMA berstatus berakhir (batas eksklusif; atribut data-kabar-end untuk saringan pra-paint).
 * Promo/Acara tanpa endsAt: aktif sepanjang hari itu (sampai 23:59:59.999 WIB) → berakhir 00:00:00.000 WIB esok hari
 * (kabarEndMs = 23:59:59.000 WIB, + 1000 ms). Acara dengan endsAt: tepat pada endsAt.
 */
export function kabarEndedAtMs(k: KabarSummary): number | undefined {
  const end = kabarEndMs(k);
  if (end === undefined) return undefined;
  return k.kind === 'Acara' && k.endsAt ? end : end + 1000;
}

/** Promo: berakhir 00:00 WIB sesudah hari validUntil (hari itu inklusif). Acara: berakhir tepat pada endsAt (eksklusif). */
export function kabarStatus(k: KabarSummary, now: number): KabarStatus {
  const start = kabarStartMs(k);
  if (start !== undefined && now < start) return 'akan-datang';
  const endedAt = kabarEndedAtMs(k);
  if (endedAt !== undefined && now >= endedAt) return 'berakhir';
  return 'berlangsung';
}

export const isKabarActive = (k: KabarSummary, now: number): boolean => kabarStatus(k, now) !== 'berakhir';
export const isKabarEnded = (k: KabarSummary, now: number): boolean => kabarStatus(k, now) === 'berakhir';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "2026-12-12" → "12 Desember 2026" (tanpa Intl: hasil build & browser sama persis) */
export function formatKabarDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2026-12-12T10:00" (WIB) → "12 Desember 2026, 10.00 WIB" */
export function formatKabarDateTime(wib: string): string {
  const time = wib.trim().replace(' ', 'T').slice(11, 16).replace(':', '.');
  return `${formatKabarDate(wib)}, ${time} WIB`;
}

/** "Mulai <tanggal>" untuk Promo (validFrom) / Acara (startsAt); undefined bila tidak ada tanggal mulai */
export function kabarStartLabel(k: KabarSummary): string | undefined {
  if (k.kind === 'Promo' && k.validFrom) return `Mulai ${formatKabarDate(k.validFrom)}`;
  if (k.kind === 'Acara' && k.startsAt) return `Mulai ${formatKabarDateTime(k.startsAt)}`;
  return undefined;
}

const byPublished = (a: KabarSummary, b: KabarSummary) => b.publishedAt.localeCompare(a.publishedAt) || a.title.localeCompare(b.title, 'id');

/** Acara dulu (startsAt terdekat), lalu promo (validUntil terdekat, tanpa batas paling akhir), seri → terbaru dulu */
function byActiveOrder(a: KabarSummary, b: KabarSummary): number {
  const rank = (k: KabarSummary) => (k.kind === 'Acara' ? 0 : 1);
  const when = (k: KabarSummary) => (k.kind === 'Acara' ? kabarStartMs(k) : kabarEndMs(k)) ?? Infinity;
  const wa = when(a);
  const wb = when(b);
  return rank(a) - rank(b) || (wa === wb ? 0 : wa < wb ? -1 : 1) || byPublished(a, b);
}

/**
 * active: Promo/Acara belum berakhir (termasuk akan datang), news: Kabar biasa (terbaru dulu),
 * ended: Promo/Acara yang sudah berakhir (terbaru terbit dulu, seperti news).
 */
export function groupKabar(list: KabarSummary[], now: number): { active: KabarSummary[]; news: KabarSummary[]; ended: KabarSummary[] } {
  const news = list.filter((k) => k.kind === 'Kabar').sort(byPublished);
  const timed = list.filter((k) => k.kind !== 'Kabar');
  const active = timed.filter((k) => isKabarActive(k, now)).sort(byActiveOrder);
  const ended = timed.filter((k) => isKabarEnded(k, now)).sort(byPublished);
  return { active, news, ended };
}

const forBranch = (k: KabarSummary, branchSlug: string): boolean => k.branches.includes(branchSlug) || k.branches.includes(KABAR_ALL_BRANCHES);

/** Item untuk cabang itu atau 'semua' */
export const kabarForBranch = (list: KabarSummary[], branchSlug: string): KabarSummary[] => list.filter((k) => forBranch(k, branchSlug));

/** Saringan daftar: cabang (cabang itu atau 'semua') dan/atau jenis; tanpa opsi = semua */
export function filterKabar(list: KabarSummary[], opts: { branch?: string; kind?: KabarKind }): KabarSummary[] {
  return list.filter((k) => (!opts.branch || forBranch(k, opts.branch)) && (!opts.kind || k.kind === opts.kind));
}

/** Kotak di halaman cabang: Promo/Acara aktif (termasuk akan datang) untuk cabang itu, urutan grup aktif */
export const branchBoxItems = (list: KabarSummary[], branchSlug: string, now: number): KabarSummary[] =>
  groupKabar(kabarForBranch(list, branchSlug), now).active;

/** Banner beranda: item aktif pertama (acara terdekat dulu, lalu promo); tidak ada → undefined */
export const bannerItem = (list: KabarSummary[], now: number): KabarSummary | undefined => groupKabar(list, now).active[0];

export const mapsUrl = (venueName: string, address: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venueName} ${address}`)}`;

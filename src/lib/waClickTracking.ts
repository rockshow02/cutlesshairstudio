import { WA_CLICK_ENDPOINT, type WaClickKind, type WaClickPayload } from '@/content/waClicks';

/**
 * Pencatat klik tombol WhatsApp (satu titik untuk semua tombol): satu listener klik di dokumen untuk setiap link wa.me
 * bernomor, ditambah pemilih cabang (useBooking, window.open). Konteks tombol (jenis, cabang, kapster) dicatat saat
 * link dibuat (rememberWaClick). Kiriman lewat navigator.sendBeacon (cadangan: fetch keepalive): tidak ditunggu,
 * tidak mencegah/menunda link, dan error apa pun diabaikan, jadi WhatsApp tetap terbuka walau endpoint gagal/lambat.
 * Tanpa cookie: asal kunjungan (host referrer saja) disimpan di sessionStorage tab ini, hilang saat tab ditutup.
 */
export interface WaClickContext {
  kind: WaClickKind;
  branch?: string;
  barber?: string;
}

/** Link click-to-chat bernomor (link bagikan wa.me/?text= tidak dihitung) */
const WA_HREF = /^https:\/\/wa\.me\/\d{6,}/;
const REF_KEY = 'cutless:ref';
const MAX_CONTEXTS = 300;
const contexts = new Map<string, WaClickContext>();

/** Link identik (nomor & pesan sama, mis. navbar & tombol hero di halaman cabang): yang dicatat jenis paling spesifik */
const specificity = (kind: WaClickKind) => (kind === 'umum' ? 0 : kind === 'cabang' ? 1 : 2);

/** Catat konteks tombol untuk link ini; mengembalikan href apa adanya */
export function rememberWaClick(href: string, context: WaClickContext): string {
  const known = contexts.get(href);
  if (known && specificity(known.kind) > specificity(context.kind)) return href;
  if (!known && contexts.size >= MAX_CONTEXTS) contexts.delete(contexts.keys().next().value!);
  contexts.set(href, context);
  return href;
}

/** Konteks link; tanpa catatan: halaman cabang → tombol cabang, selain itu booking umum */
export function contextFor(href: string, pathname: string): WaClickContext {
  const known = contexts.get(href);
  if (known) return known;
  const branch = pathname.match(/^\/cabang\/([a-z0-9-]+)\/?$/)?.[1];
  return branch ? { kind: 'cabang', branch } : { kind: 'umum' };
}

/**
 * Asal kunjungan tab ini: host referrer luar saat datang (mis. www.google.com), '' = langsung.
 * Pindah halaman di situs sendiri tidak mengubahnya.
 */
export function rememberLanding(referrer: string, ownHost: string): void {
  try {
    let host = '';
    try {
      host = referrer ? new URL(referrer).hostname : '';
    } catch {
      host = '';
    }
    const stored = sessionStorage.getItem(REF_KEY);
    if (host && host !== ownHost) sessionStorage.setItem(REF_KEY, host);
    else if (stored === null) sessionStorage.setItem(REF_KEY, '');
  } catch {
    // sessionStorage diblokir: asal kunjungan = langsung
  }
}

function landingHost(): string {
  try {
    return sessionStorage.getItem(REF_KEY) ?? '';
  } catch {
    return '';
  }
}

export function waClickPayload(context: WaClickContext, pathname: string, referrerHost: string): WaClickPayload {
  return {
    k: context.kind,
    ...(context.branch ? { b: context.branch } : {}),
    ...(context.barber ? { s: context.barber } : {}),
    p: pathname,
    ...(referrerHost ? { r: referrerHost } : {}),
  };
}

/** Kirim tanpa menunggu. Tidak pernah melempar error. */
export function sendWaClick(payload: WaClickPayload): void {
  try {
    const body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon?.(WA_CLICK_ENDPOINT, new Blob([body], { type: 'text/plain' }))) return;
    } catch {
      // sendBeacon ditolak browser: pakai fetch
    }
    void fetch(WA_CLICK_ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => undefined);
  } catch {
    // Pencatatan tidak boleh mengganggu pembukaan WhatsApp
  }
}

/** Catat satu klik ke link wa.me (diabaikan bila bukan link click-to-chat bernomor) */
export function trackWaClick(href: string): void {
  try {
    if (!WA_HREF.test(href)) return;
    sendWaClick(waClickPayload(contextFor(href, location.pathname), location.pathname, landingHost()));
  } catch {
    // abaikan
  }
}

let installed = false;

/** Pasang sekali per halaman (SiteShell): klik kiri/tengah & Enter pada link wa.me mana pun */
export function installWaClickTracking(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  rememberLanding(document.referrer, location.hostname);
  const onClick = (event: MouseEvent) => {
    if (event.type === 'auxclick' && event.button !== 1) return;
    const link = (event.target as Element | null)?.closest?.('a[href]');
    if (link instanceof HTMLAnchorElement) trackWaClick(link.href);
  };
  document.addEventListener('click', onClick, { capture: true, passive: true });
  document.addEventListener('auxclick', onClick, { capture: true, passive: true });
}

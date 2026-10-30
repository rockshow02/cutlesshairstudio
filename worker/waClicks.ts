import { dayWIB, validateWaClick, WA_CLICK_ALLOWLIST_PATH, WA_CLICK_MAX_BYTES, type WaClickAllowlist, type WaClickRow } from '../src/content/waClicks';
import type { D1Database, Env } from './env';

/**
 * POST /api/klik-wa: satu klik tombol WhatsApp → penghitung harian di D1 (UPSERT, clicks + 1). Balasan 204.
 * Ditolak: selain POST (405), Origin bukan situs (403), kiriman > 512 byte (413), isian di luar daftar yang
 * diizinkan (400). Tidak membaca/menyimpan IP, header lain, cookie, nomor HP, atau isi pesan.
 */

export const UPSERT_CLICK = `INSERT INTO wa_clicks (day, kind, branch, barber, page, source, clicks) VALUES (?, ?, ?, ?, ?, ?, 1)
ON CONFLICT (day, kind, branch, barber, page, source) DO UPDATE SET clicks = clicks + 1`;

export const recordClick = (db: D1Database, row: WaClickRow, now = Date.now()) =>
  db.prepare(UPSERT_CLICK).bind(dayWIB(now), row.kind, row.branch, row.barber, row.page, row.source).run();

const ALLOWLIST_TTL_MS = 5 * 60_000;
let cached: { at: number; value: WaClickAllowlist } | undefined;

/** dist/klik-wa.json lewat binding ASSETS (disimpan 5 menit per isolate) */
export async function loadAllowlist(env: Env, requestUrl: string, now = Date.now()): Promise<WaClickAllowlist | null> {
  if (cached && now - cached.at < ALLOWLIST_TTL_MS) return cached.value;
  try {
    const res = await env.ASSETS.fetch(new Request(new URL(WA_CLICK_ALLOWLIST_PATH, requestUrl)));
    if (!res.ok) return null;
    const value = (await res.json()) as WaClickAllowlist;
    cached = { at: now, value };
    return value;
  } catch {
    return null;
  }
}

/** Untuk tes: kosongkan cache daftar */
export const resetAllowlistCache = () => {
  cached = undefined;
};

export const allowedOrigins = (env: Env) =>
  (env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);

const empty = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

export async function handleWaClick(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return empty(405, { Allow: 'POST' });
  const origin = request.headers.get('Origin') ?? '';
  if (!origin || !allowedOrigins(env).includes(origin)) return empty(403);
  if (Number(request.headers.get('Content-Length') ?? 0) > WA_CLICK_MAX_BYTES) return empty(413);
  const body = await request.text();
  if (new TextEncoder().encode(body).length > WA_CLICK_MAX_BYTES) return empty(413);
  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    return empty(400);
  }
  const allow = await loadAllowlist(env, request.url);
  if (!allow) return empty(503);
  const row = validateWaClick(input, allow);
  if (!row) return empty(400);
  if (!env.DB) return empty(503);
  try {
    await recordClick(env.DB, row);
  } catch {
    return empty(500);
  }
  return empty(204);
}

/**
 * Paginasi keyset (cursor), bukan OFFSET: setiap halaman hanya membaca ±limit+1 baris D1.
 *   ?limit=  default 20, maks. 50 (nilai di luar batas dibulatkan ke batas)
 *   ?cursor= nilai nextCursor dari halaman sebelumnya
 * Cursor = base64url(JSON [nilai kolom urut, id]) baris terakhir halaman sebelumnya. Urutan selalu
 * memakai id sebagai pemecah seri, sehingga baris dengan start_at/created_at sama tidak terlewat/terulang.
 */
import type { Context } from 'hono';
import { badRequest } from './errors';

export const PAGE_DEFAULT = 20;
export const PAGE_MAX = 50;

export type CursorKey = [string | number, string | number];

export interface PageParams {
  limit: number;
  cursor: CursorKey | null;
}

export function encodeCursor(key: CursorKey): string {
  return btoa(JSON.stringify(key)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCursor(raw: string): CursorKey {
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const key = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))) as unknown;
    const ok = (v: unknown) => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
    if (Array.isArray(key) && key.length === 2 && ok(key[0]) && ok(key[1])) return key as CursorKey;
  } catch {
    /* jatuh ke error di bawah */
  }
  throw badRequest('Cursor tidak valid. Muat ulang daftar dari awal.');
}

/** Baca ?limit & ?cursor (prefix untuk parameter tambahan, mis. "bookings" → ?bookingsCursor) */
export function pageParams(c: Context, prefix = ''): PageParams {
  const name = (k: string) => (prefix ? `${prefix}${k[0].toUpperCase()}${k.slice(1)}` : k);
  const n = Number(c.req.query(name('limit')));
  const limit = Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), PAGE_MAX) : PAGE_DEFAULT;
  const raw = c.req.query(name('cursor'));
  return { limit, cursor: raw ? decodeCursor(raw) : null };
}

/**
 * Kondisi SQL keyset untuk urutan (sortExpr, idExpr). Placeholder bernomor mulai dari `at`.
 * desc: baris SETELAH cursor dalam urutan menurun; asc: menaik.
 */
export function keysetWhere(sortExpr: string, idExpr: string, dir: 'asc' | 'desc', at: number): string {
  const op = dir === 'desc' ? '<' : '>';
  return `(${sortExpr} ${op} ?${at} OR (${sortExpr} = ?${at} AND ${idExpr} ${op} ?${at + 1}))`;
}

/** Ambil limit+1 baris → potong ke limit, nextCursor dari baris terakhir (null bila habis) */
export function finishPage<T>(rows: T[], limit: number, key: (row: T) => CursorKey): { items: T[]; nextCursor: string | null } {
  const more = rows.length > limit;
  const items = more ? rows.slice(0, limit) : rows;
  return { items, nextCursor: more ? encodeCursor(key(items[items.length - 1])) : null };
}

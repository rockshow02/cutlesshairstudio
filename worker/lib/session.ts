/**
 * Sesi pelanggan di D1. Cookie berisi ID acak 32 byte; database hanya menyimpan hash SHA-256-nya,
 * jadi bocornya isi database tidak bisa dipakai untuk masuk. Berlaku 30 hari, diperpanjang otomatis
 * bila dipakai saat sisa < 15 hari. Logout menghapus baris sesi.
 */
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv, CustomerSession } from '../app';

export const SESSION_COOKIE = 'cutless_session';
const SESSION_DAYS = 30;
const RENEW_WHEN_LEFT_DAYS = 15;
const DAY = 86_400_000;

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function setSessionCookie(c: Context<AppEnv>, token: string, expires: Date) {
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', expires });
}

export async function createSession(c: Context<AppEnv>, customerId: string): Promise<void> {
  const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const expires = new Date(Date.now() + SESSION_DAYS * DAY);
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO sessions (id_hash, customer_id, expires_at, user_agent) VALUES (?, ?, ?, ?)').bind(
      await sha256Hex(token),
      customerId,
      expires.toISOString(),
      (c.req.header('user-agent') ?? '').slice(0, 200),
    ),
    c.env.DB.prepare('UPDATE customers SET last_login_at = ? WHERE id = ?').bind(new Date().toISOString(), customerId),
  ]);
  setSessionCookie(c, token, expires);
}

interface CustomerRow {
  id: string;
  email: string | null;
  name: string;
  phone: string | null;
  status: 'active' | 'blocked';
  no_show_count: number;
  privacy_consent_at: string | null;
  expires_at: string;
}

/** Baca sesi dari cookie; perpanjang otomatis. undefined bila tidak login/kedaluwarsa. */
export async function readSession(c: Context<AppEnv>): Promise<CustomerSession | undefined> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return undefined;
  const hash = await sha256Hex(token);
  const row = await c.env.DB.prepare(
    `SELECT c.id, c.email, c.name, c.phone, c.status, c.no_show_count, c.privacy_consent_at, s.expires_at
     FROM sessions s JOIN customers c ON c.id = s.customer_id
     WHERE s.id_hash = ? AND c.anonymized_at IS NULL AND c.is_guest = 0`,
  )
    .bind(hash)
    .first<CustomerRow>();
  if (!row) {
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true });
    return undefined;
  }
  const expiresAt = Date.parse(row.expires_at);
  const now = Date.now();
  if (expiresAt <= now) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(hash).run();
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true });
    return undefined;
  }
  if (expiresAt - now < RENEW_WHEN_LEFT_DAYS * DAY) {
    const expires = new Date(now + SESSION_DAYS * DAY);
    await c.env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE id_hash = ?').bind(expires.toISOString(), hash).run();
    setSessionCookie(c, token, expires);
  }
  const { expires_at: _e, ...customer } = row;
  return { ...customer, profileComplete: Boolean(row.name && row.phone && row.privacy_consent_at) };
}

export async function destroySession(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(await sha256Hex(token)).run();
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true });
}

/** Hanya path relatif di situs ini (mencegah open redirect) */
export function safeNext(next: string | undefined | null, fallback = '/booking/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}

import type { Env } from './env';

/**
 * Verifikasi JWT Cloudflare Access (header Cf-Access-Jwt-Assertion) di Worker sendiri: /statistik/ tetap tertutup
 * walau aturan Access lupa dipasang / dihapus. Syarat: RS256 dengan kunci dari <team domain>/cdn-cgi/access/certs,
 * `aud` memuat ACCESS_AUD, `iss` = team domain, belum kedaluwarsa. Variabel kosong = selalu ditolak.
 */

export const ACCESS_HEADER = 'Cf-Access-Jwt-Assertion';

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

export interface AccessOptions {
  teamDomain: string;
  aud: string;
  now?: number;
  fetcher?: (url: string) => Promise<Response>;
}

/** "cutless.cloudflareaccess.com" / "https://cutless.cloudflareaccess.com/" → "https://cutless.cloudflareaccess.com" */
export const teamOrigin = (domain: string) => {
  const d = domain.trim().replace(/\/+$/, '');
  return d ? (/^https?:\/\//.test(d) ? d : `https://${d}`) : '';
};

const b64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const json = (s: string) => JSON.parse(new TextDecoder().decode(b64url(s))) as Record<string, unknown>;

const CERTS_TTL_MS = 10 * 60_000;
const certsCache = new Map<string, { at: number; keys: Jwk[] }>();

async function certs(origin: string, fetcher: (url: string) => Promise<Response>, now: number, fresh: boolean): Promise<Jwk[]> {
  const hit = certsCache.get(origin);
  if (hit && !fresh && now - hit.at < CERTS_TTL_MS) return hit.keys;
  const res = await fetcher(`${origin}/cdn-cgi/access/certs`);
  if (!res.ok) return [];
  const keys = ((await res.json()) as { keys?: Jwk[] }).keys ?? [];
  certsCache.set(origin, { at: now, keys });
  return keys;
}

export async function verifyAccessJwt(token: string, options: AccessOptions): Promise<boolean> {
  const origin = teamOrigin(options.teamDomain);
  const aud = options.aud.trim();
  if (!origin || !aud || !token) return false;
  const now = options.now ?? Date.now();
  const fetcher = options.fetcher ?? ((url: string) => fetch(url));
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [h, p, sig] = parts;
    const header = json(h);
    const payload = json(p);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return false;
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(aud)) return false;
    if (payload.iss !== origin) return false;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) return false;
    if (typeof payload.nbf === 'number' && payload.nbf * 1000 > now + 60_000) return false;
    // Kunci tidak dikenal (rotasi kunci Access): ambil ulang daftar kunci sekali
    let jwk = (await certs(origin, fetcher, now, false)).find((k) => k.kid === header.kid);
    jwk ??= (await certs(origin, fetcher, now, true)).find((k) => k.kid === header.kid);
    if (!jwk || jwk.kty !== 'RSA') return false;
    const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(sig), new TextEncoder().encode(`${h}.${p}`));
  } catch {
    return false;
  }
}

export const isAccessAllowed = (request: Request, env: Env, options: Partial<AccessOptions> = {}) =>
  verifyAccessJwt(request.headers.get(ACCESS_HEADER) ?? '', { teamDomain: env.ACCESS_TEAM_DOMAIN ?? '', aud: env.ACCESS_AUD ?? '', ...options });

/** Untuk tes: kosongkan cache kunci */
export const resetAccessCache = () => certsCache.clear();

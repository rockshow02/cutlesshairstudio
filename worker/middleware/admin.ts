/**
 * Admin: /admin & /api/admin/* dilindungi Cloudflare Access (Zero Trust, email OTP/Google).
 * Worker tetap memverifikasi JWT Cf-Access-Jwt-Assertion (tanda tangan, audiens, penerbit) lalu mencocokkan
 * email ke admin_users yang aktif. Akun admin terpisah dari akun pelanggan.
 * Development lokal: ADMIN_DEV_EMAIL (bisa diganti per request lewat header x-dev-admin untuk uji peran).
 */
import type { Context, Next } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AdminIdentity, AppEnv } from '../app';
import { ApiError, forbidden } from '../lib/errors';
import { assertSameOrigin } from '../lib/guard';

const jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

async function emailFromAccess(c: Context<AppEnv>): Promise<string> {
  const { ACCESS_TEAM_DOMAIN: team, ACCESS_AUD: aud } = c.env;
  if (!team || !aud) throw new ApiError(503, 'FEATURE_DISABLED', 'Cloudflare Access belum dikonfigurasi (ACCESS_TEAM_DOMAIN, ACCESS_AUD).');
  const token = c.req.header('cf-access-jwt-assertion');
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Login admin lewat Cloudflare Access diperlukan.');
  const issuer = `https://${team.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  let keys = jwks.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwks.set(issuer, keys);
  }
  try {
    const { payload } = await jwtVerify(token, keys, { issuer, audience: aud });
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    if (!email) throw new Error('tanpa email');
    return email;
  } catch {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sesi Cloudflare Access tidak valid. Muat ulang halaman admin.');
  }
}

export async function requireAdmin(c: Context<AppEnv>, next: Next) {
  assertSameOrigin(c);
  const email =
    c.env.APP_ENV === 'development' && c.env.ADMIN_DEV_EMAIL
      ? (c.req.header('x-dev-admin') || c.env.ADMIN_DEV_EMAIL).toLowerCase()
      : await emailFromAccess(c);
  const admin = await c.env.DB.prepare('SELECT email, name, role, branch_id, barber_id FROM admin_users WHERE email = ? AND is_active = 1')
    .bind(email)
    .first<AdminIdentity>();
  if (!admin) throw forbidden(`Email ${email} belum terdaftar sebagai admin aktif. Hubungi owner.`);
  c.set('admin', admin);
  await next();
}

/** Hanya peran tertentu */
export const allowRoles =
  (...roles: AdminIdentity['role'][]) =>
  async (c: Context<AppEnv>, next: Next) => {
    if (!roles.includes(c.get('admin')!.role)) throw forbidden();
    await next();
  };

/** owner: semua cabang; branch_admin & barber: cabangnya sendiri */
export function assertBranch(admin: AdminIdentity, branchId: number) {
  if (admin.role !== 'owner' && admin.branch_id !== branchId) throw forbidden('Anda hanya bisa mengelola cabang Anda sendiri.');
}

/** Filter SQL cabang untuk peran admin: owner bebas (opsional pilih cabang) */
export function branchScope(admin: AdminIdentity, requested?: number): number | undefined {
  if (admin.role === 'owner') return requested;
  return admin.branch_id ?? -1;
}

export const auditActor = (admin: AdminIdentity) => ({ type: 'admin' as const, id: admin.email });

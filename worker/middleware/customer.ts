import type { Context, Next } from 'hono';
import type { AppEnv } from '../app';
import { ApiError } from '../lib/errors';
import { readSession } from '../lib/session';

/** Wajib login pelanggan (cookie sesi) */
export async function requireCustomer(c: Context<AppEnv>, next: Next) {
  const customer = await readSession(c);
  if (!customer) throw new ApiError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.');
  c.set('customer', customer);
  await next();
}

/** Wajib profil lengkap (nama, nomor WA, persetujuan privasi) sebelum booking */
export async function requireCompleteProfile(c: Context<AppEnv>, next: Next) {
  if (!c.get('customer')?.profileComplete) {
    throw new ApiError(403, 'PROFILE_INCOMPLETE', 'Lengkapi nama dan nomor WhatsApp di profil sebelum booking.');
  }
  await next();
}

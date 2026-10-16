import { Hono } from 'hono';
import type { Env } from './env';

/** Data per request (diisi middleware auth) */
export interface Vars {
  customer?: CustomerSession;
  admin?: AdminIdentity;
}

export interface CustomerSession {
  id: string;
  email: string | null;
  name: string;
  phone: string | null;
  status: 'active' | 'blocked';
  no_show_count: number;
  privacy_consent_at: string | null;
  /** Profil lengkap (nama + nomor + persetujuan privasi) → boleh booking */
  profileComplete: boolean;
}

export interface AdminIdentity {
  email: string;
  name: string | null;
  role: 'owner' | 'branch_admin' | 'barber';
  branch_id: number | null;
  barber_id: number | null;
}

export type AppEnv = { Bindings: Env; Variables: Vars };
export const createRouter = () => new Hono<AppEnv>();

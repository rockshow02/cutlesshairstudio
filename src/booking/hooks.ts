import { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/app/api';

export interface Me {
  email: string | null;
  name: string;
  phone: string | null;
  status: 'active' | 'blocked';
  no_show_count: number;
  privacy_consent_at: string | null;
  profileComplete: boolean;
}

/** Pelanggan yang sedang login (null = belum login) */
export function useMe() {
  const [state, setState] = useState<{ loading: boolean; me: Me | null; error?: string }>({ loading: true, me: null });
  useEffect(() => {
    api<{ customer: Me }>('/me')
      .then((r) => setState({ loading: false, me: r.customer }))
      .catch((e) => setState({ loading: false, me: null, error: e instanceof ApiClientError && e.status === 401 ? undefined : e.message }));
  }, []);
  return state;
}

export interface AuthConfig {
  google: boolean;
  phonePassword: boolean;
  mock: boolean;
  turnstileSiteKey: string | null;
}

export function useAuthConfig() {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  useEffect(() => {
    api<AuthConfig>('/auth/config')
      .then(setConfig)
      .catch(() => setConfig({ google: false, phonePassword: false, mock: false, turnstileSiteKey: null }));
  }, []);
  return config;
}

/** URL halaman ini (path + query) untuk dikembalikan setelah login */
export const currentPath = () => `${window.location.pathname}${window.location.search}`;
export const loginUrl = (next = currentPath()) => `/masuk?next=${encodeURIComponent(next)}`;
export const completeProfileUrl = (next = currentPath()) => `/profil/lengkapi?next=${encodeURIComponent(next)}`;

/** Ambil "next" dari query (hanya path relatif situs ini) */
export function nextParam(fallback = '/booking/'): string {
  const n = new URLSearchParams(window.location.search).get('next');
  return n && n.startsWith('/') && !n.startsWith('//') ? n : fallback;
}

import { toQueryString, type StrapiQuery } from './query';

/** URL dasar Strapi, mis. http://localhost:1337. Kosong = CMS dimatikan, pakai data statis. */
export const CMS_URL = (import.meta.env.VITE_CMS_URL ?? '').replace(/\/+$/, '');

/** Batas waktu request ke CMS sebelum fallback ke data statis. */
export const CMS_TIMEOUT_MS = 5000;

export const isCmsEnabled = (): boolean => CMS_URL.length > 0;

export class CmsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** true = CMS tidak bisa dihubungi (timeout / jaringan), bukan error per-endpoint */
    readonly unreachable = false,
  ) {
    super(message);
    this.name = 'CmsError';
  }
}

/** GET ke Strapi REST API (/api/...) dengan timeout. Melempar CmsError bila gagal. */
export async function cmsGet<T>(path: string, query: StrapiQuery = {}): Promise<T> {
  if (!isCmsEnabled()) throw new CmsError('VITE_CMS_URL belum diatur');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CMS_TIMEOUT_MS);
  const qs = toQueryString(query);
  const url = `${CMS_URL}/api/${path}${qs ? `?${qs}` : ''}`;

  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new CmsError(`CMS ${res.status} untuk ${path}`, res.status);
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new CmsError(`CMS timeout (${CMS_TIMEOUT_MS} ms) untuk ${path}`, undefined, true);
    }
    if (error instanceof TypeError) {
      // fetch melempar TypeError untuk kegagalan jaringan / CORS
      throw new CmsError(`CMS tidak bisa dihubungi untuk ${path}: ${error.message}`, undefined, true);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

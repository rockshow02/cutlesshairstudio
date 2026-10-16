/** Klien API booking (fetch same-origin, cookie sesi HttpOnly otomatis ikut). */

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: { fields?: Record<string, string>; alternatives?: { time: string; startAt: string; barberIds: number[] }[] } & Record<string, unknown>;
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: ApiErrorBody['details'],
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, body, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiClientError(0, 'NETWORK', 'Tidak bisa terhubung. Periksa koneksi internet lalu coba lagi.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: ApiErrorBody } & T;
  if (!res.ok) {
    const e = data.error;
    throw new ApiClientError(res.status, e?.code ?? 'INTERNAL', e?.message ?? 'Terjadi kesalahan. Silakan coba lagi.', e?.details);
  }
  return data;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Terjadi kesalahan. Silakan coba lagi.');

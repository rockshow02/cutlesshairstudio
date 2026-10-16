import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Kode error API (stabil, dipakai frontend) */
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'PROFILE_INCOMPLETE'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SLOT_TAKEN'
  | 'SLOT_UNAVAILABLE'
  | 'INVALID_TRANSITION'
  | 'DEADLINE_PASSED'
  | 'LIMIT_ACTIVE'
  | 'LIMIT_DAILY'
  | 'ACCOUNT_BLOCKED'
  | 'RATE_LIMITED'
  | 'TURNSTILE_FAILED'
  | 'FEATURE_DISABLED'
  | 'EMAIL_NOT_VERIFIED'
  | 'INTERNAL';

export class ApiError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    public code: ErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, 'BAD_REQUEST', message, details);
export const notFound = (message = 'Data tidak ditemukan.') => new ApiError(404, 'NOT_FOUND', message);
export const forbidden = (message = 'Anda tidak punya akses untuk tindakan ini.') => new ApiError(403, 'FORBIDDEN', message);

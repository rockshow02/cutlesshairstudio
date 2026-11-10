import type { Env } from './env';

/** Header uji: waktu sekarang (epoch ms) untuk request ini. Hanya dibaca bila Worker berjalan dengan var E2E_CLOCK=1. */
export const E2E_NOW_HEADER = 'x-e2e-now';

/**
 * Waktu sekarang (epoch ms) untuk menentukan hari (WIB) klik & rentang /statistik/. Di produksi/staging selalu Date.now():
 * header x-e2e-now diabaikan kecuali Worker uji (`npm run e2e:server` memasang --var E2E_CLOCK:1). Tes e2e memakainya untuk
 * memalsukan 23.59 → 00.01 WIB tanpa menunggu tengah malam. Tidak dipakai untuk verifikasi JWT Access (selalu jam sungguhan).
 */
export function nowOf(request: Request, env: Env): number {
  if (env.E2E_CLOCK === '1') {
    const forced = Number(request.headers.get(E2E_NOW_HEADER));
    if (Number.isFinite(forced) && forced > 0) return forced;
  }
  return Date.now();
}

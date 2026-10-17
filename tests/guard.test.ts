/** Tes jalur E2E Turnstile: bypass hanya di staging dengan secret yang cocok; produksi tidak pernah. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter } from '../worker/app';
import { ApiError } from '../worker/lib/errors';
import { E2E_SECRET_HEADER, secretEquals, verifyTurnstile } from '../worker/lib/guard';

const SECRET = 'rahasia-uji-e2e';

// Aplikasi mini: satu endpoint yang hanya memanggil verifyTurnstile
const app = createRouter();
app.post('/t', async (c) => {
  await verifyTurnstile(c, 'token-palsu');
  return c.json({ ok: true });
});
app.onError((err, c) => (err instanceof ApiError ? c.json({ error: { code: err.code } }, err.status) : c.json({ error: 'x' }, 500)));

const staging = { APP_ENV: 'staging', AUTH_MOCK_ENABLED: 'true', AUTH_MOCK_SECRET: SECRET, TURNSTILE_SECRET_KEY: 'turnstile-secret-uji' };
const call = (env: Record<string, unknown>, header?: string) =>
  app.request('http://localhost/t', { method: 'POST', headers: header === undefined ? {} : { [E2E_SECRET_HEADER]: header } }, env);

// siteverify Cloudflare selalu menolak token palsu → lolos hanya bila bypass berlaku
let siteverify: ReturnType<typeof vi.fn>;
beforeEach(() => {
  siteverify = vi.fn(async () => Response.json({ success: false }));
  vi.stubGlobal('fetch', siteverify);
});
afterEach(() => vi.unstubAllGlobals());

describe('secretEquals', () => {
  it('cocok hanya untuk nilai yang sama persis', async () => {
    expect(await secretEquals(SECRET, SECRET)).toBe(true);
    expect(await secretEquals(`${SECRET}x`, SECRET)).toBe(false);
    expect(await secretEquals('', SECRET)).toBe(false);
    expect(await secretEquals(SECRET, '')).toBe(false);
    expect(await secretEquals(undefined, undefined)).toBe(false);
  });
});

describe('bypass Turnstile untuk E2E', () => {
  it('staging + mock aktif + header secret cocok → lolos tanpa memanggil siteverify', async () => {
    const res = await call(staging, SECRET);
    expect(res.status).toBe(200);
    expect(siteverify).not.toHaveBeenCalled();
  });

  it('staging dengan secret salah atau tanpa header → tetap diverifikasi & ditolak', async () => {
    for (const header of ['salah', '', undefined]) {
      const res = await call(staging, header);
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('TURNSTILE_FAILED');
    }
    expect(siteverify).toHaveBeenCalledTimes(3);
  });

  it('staging tanpa AUTH_MOCK_SECRET atau dengan mock nonaktif → tidak ada bypass', async () => {
    expect((await call({ ...staging, AUTH_MOCK_SECRET: undefined }, '')).status).toBe(400);
    expect((await call({ ...staging, AUTH_MOCK_ENABLED: 'false' }, SECRET)).status).toBe(400);
  });

  it('produksi tidak pernah bypass, walau semua syarat lain terpenuhi', async () => {
    for (const APP_ENV of ['production', 'Staging', 'staging ', 'development']) {
      const res = await call({ ...staging, APP_ENV }, SECRET);
      expect(res.status).toBe(400);
    }
    expect(siteverify).toHaveBeenCalledTimes(4);
  });
});

import { describe, expect, it } from 'vitest';
import type { Env } from '../worker/env';
import { HttpGbpClient, MockGbpClient, createGbpClient } from '../worker/ulasan/gbp';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

function fakeGoogle(handlers: Record<string, () => Response>) {
  const calls: Call[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? 'GET', headers: (init?.headers ?? {}) as Record<string, string>, body: String(init?.body ?? '') });
    const key = Object.keys(handlers).find((k) => url.startsWith(k));
    return key ? handlers[key]() : new Response('nope', { status: 404 });
  }) as typeof fetch;
  return { calls, fetcher };
}

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });
const token = () => json({ access_token: 'AKSES-RAHASIA', expires_in: 3600 });
const creds = { clientId: 'cid', clientSecret: 'csecret', refreshToken: 'rtoken' };

describe('HttpGbpClient', () => {
  it('menukar refresh token lalu mengonversi ulasan Business Profile', async () => {
    const google = fakeGoogle({
      'https://oauth2.googleapis.com/token': token,
      'https://mybusiness.googleapis.com/v4/accounts/1/locations/2/reviews': () =>
        json({
          reviews: [
            { name: 'accounts/1/locations/2/reviews/A', reviewer: { displayName: 'Budi' }, starRating: 'FIVE', comment: 'Mantap', createTime: '2026-11-05T10:00:00Z' },
            { name: 'accounts/1/locations/2/reviews/B', reviewer: { displayName: 'Sari' }, starRating: 'ONE', createTime: '2026-11-04T10:00:00Z', reviewReply: { comment: 'Sudah dibalas' } },
            { name: 'accounts/1/locations/2/reviews/C', reviewer: { displayName: 'Lama' }, starRating: 'FOUR', comment: 'x', createTime: '2026-10-01T10:00:00Z' },
          ],
        }),
    });
    const client = new HttpGbpClient({ ...creds, fetcher: google.fetcher });
    const result = await client.listNewReviews('accounts/1/locations/2', '2026-11-01T00:00:00Z');
    expect(result).toEqual([
      { id: 'accounts/1/locations/2/reviews/A', location: 'accounts/1/locations/2', reviewer: 'Budi', rating: 5, text: 'Mantap', createdAt: '2026-11-05T10:00:00Z', hasReply: false },
      { id: 'accounts/1/locations/2/reviews/B', location: 'accounts/1/locations/2', reviewer: 'Sari', rating: 1, text: '', createdAt: '2026-11-04T10:00:00Z', hasReply: true },
    ]);
    const tokenCall = google.calls[0];
    expect(tokenCall.method).toBe('POST');
    expect(tokenCall.body).toContain('grant_type=refresh_token');
    expect(tokenCall.body).toContain('refresh_token=rtoken');
    expect(google.calls[1].headers.Authorization).toBe('Bearer AKSES-RAHASIA');
  });

  it('membalas lewat PUT …/reply dengan {comment}; access token dipakai ulang', async () => {
    const google = fakeGoogle({ 'https://oauth2.googleapis.com/token': token, 'https://mybusiness.googleapis.com/v4/': () => json({ comment: 'ok' }) });
    const client = new HttpGbpClient({ ...creds, fetcher: google.fetcher });
    await client.reply('accounts/1/locations/2/reviews/A', 'Terima kasih kak');
    await client.reply('accounts/1/locations/2/reviews/B', 'Terima kasih juga');
    const puts = google.calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(2);
    expect(puts[0].url).toBe('https://mybusiness.googleapis.com/v4/accounts/1/locations/2/reviews/A/reply');
    expect(JSON.parse(puts[0].body)).toEqual({ comment: 'Terima kasih kak' });
    expect(google.calls.filter((c) => c.url.includes('oauth2'))).toHaveLength(1);
  });

  it('respons non-2xx → Error tanpa token, rahasia, atau isi respons', async () => {
    const google = fakeGoogle({ 'https://oauth2.googleapis.com/token': token, 'https://mybusiness.googleapis.com/v4/': () => new Response('detail: AKSES-RAHASIA rtoken', { status: 403 }) });
    const client = new HttpGbpClient({ ...creds, fetcher: google.fetcher });
    const error = await client.reply('accounts/1/locations/2/reviews/A', 'x').catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('403');
    expect((error as Error).message).not.toMatch(/AKSES-RAHASIA|rtoken|csecret/);
  });

  it('gagal menukar token → Error tanpa rahasia', async () => {
    const google = fakeGoogle({ 'https://oauth2.googleapis.com/token': () => new Response('invalid_grant rtoken', { status: 400 }) });
    const error = await new HttpGbpClient({ ...creds, fetcher: google.fetcher }).listNewReviews('l', '2026-11-01T00:00:00Z').catch((e: Error) => e);
    expect((error as Error).message).toContain('400');
    expect((error as Error).message).not.toMatch(/rtoken|csecret/);
  });
});

describe('createGbpClient', () => {
  const base = { ASSETS: { fetch: async () => new Response('') } } as Env;
  it('"mock" → MockGbpClient dengan data contoh', async () => {
    const client = createGbpClient({ ...base, GBP_CLIENT: 'mock' });
    expect(client).toBeInstanceOf(MockGbpClient);
    expect((await client!.listNewReviews('mock/cibubur', '2000-01-01T00:00:00Z')).length).toBeGreaterThan(0);
  });
  it('secret OAuth lengkap → klien sungguhan', () => {
    expect(createGbpClient({ ...base, GBP_CLIENT_ID: 'a', GBP_CLIENT_SECRET: 'b', GBP_REFRESH_TOKEN: 'c' })).toBeInstanceOf(HttpGbpClient);
  });
  it('secret belum lengkap → null (belum aktif)', () => {
    expect(createGbpClient(base)).toBeNull();
    expect(createGbpClient({ ...base, GBP_CLIENT_ID: 'a', GBP_CLIENT_SECRET: 'b' })).toBeNull();
  });
});

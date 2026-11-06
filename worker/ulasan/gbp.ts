import type { Env } from '../env';

/**
 * Klien Google Business Profile untuk ulasan. Dua implementasi di balik satu antarmuka:
 *  - MockGbpClient: data contoh (staging, tes, e2e). Tidak pernah menghubungi Google.
 *  - HttpGbpClient: API sungguhan (OAuth refresh token dari Worker secret). Belum aktif sampai secret diisi.
 * Satu-satunya pemanggil `reply` adalah worker/ulasan/reply.ts (dijaga tes).
 */

export interface GbpReview {
  /** Nama resource ulasan di Google (dipakai untuk membalas) */
  id: string;
  /** Lokasi Google (nilai GBP_LOCATIONS) */
  location: string;
  reviewer: string;
  rating: number;
  text: string;
  /** ISO 8601 */
  createdAt: string;
  hasReply: boolean;
}

export interface GbpClient {
  /** Ulasan lokasi itu yang dibuat sejak `sinceIso`, termasuk yang sudah berbalas (hasReply) */
  listNewReviews(location: string, sinceIso: string): Promise<GbpReview[]>;
  reply(reviewId: string, text: string): Promise<void>;
}

/* ---------- Mock ---------- */

export class MockGbpClient implements GbpClient {
  readonly replies: { reviewId: string; text: string }[] = [];
  listCalls = 0;
  failReply: boolean;
  failList: string[];
  private reviews: GbpReview[];

  constructor(reviews: GbpReview[] = [], options: { failReply?: boolean; failList?: string[] } = {}) {
    this.reviews = [...reviews];
    this.failReply = options.failReply ?? false;
    this.failList = options.failList ?? [];
  }

  add(...reviews: GbpReview[]) {
    this.reviews.push(...reviews);
  }

  async listNewReviews(location: string, sinceIso: string): Promise<GbpReview[]> {
    this.listCalls += 1;
    if (this.failList.includes(location)) throw new Error('Mock: daftar ulasan gagal');
    return this.reviews.filter((r) => r.location === location && r.createdAt >= sinceIso);
  }

  async reply(reviewId: string, text: string): Promise<void> {
    if (this.failReply) throw new Error('Mock: balasan gagal');
    this.replies.push({ reviewId, text });
  }
}

/** Data contoh staging/e2e: nama dan isi fiktif. Lokasi mengikuti GBP_LOCATIONS staging di wrangler.jsonc. */
export function sampleReviews(now: number): GbpReview[] {
  const ago = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
  const make = (id: string, location: string, reviewer: string, rating: number, text: string, hours: number, hasReply = false): GbpReview => ({ id: `mock/${id}`, location, reviewer, rating, text, createdAt: ago(hours), hasReply });
  return [
    make('c1', 'mock/cibubur', 'Contoh Satu', 5, 'Potongan fade rapi, kapsternya ramah.', 2),
    make('c2', 'mock/cibubur', 'Contoh Dua', 5, 'Bagus, tapi antrinya lama sekali.', 3),
    make('c3', 'mock/cibubur', 'Contoh Tiga', 3, 'Lumayan, hasilnya cukup.', 5),
    make('c4', 'mock/cibubur', 'Contoh Empat', 1, 'Kecewa dengan hasilnya.', 6),
    make('c5', 'mock/cibubur', 'Contoh Lima', 5, 'Mantap!', 8, true),
    make('b1', 'mock/bogor', 'Contoh Enam', 4, 'Nyaman tempatnya.', 4),
  ];
}

/* ---------- Google Business Profile API ---------- */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://mybusiness.googleapis.com/v4';
const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
const MAX_PAGES = 5;

interface ApiReview {
  name?: string;
  reviewer?: { displayName?: string };
  starRating?: string;
  comment?: string;
  createTime?: string;
  reviewReply?: { comment?: string };
}

export interface HttpGbpOptions {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetcher?: typeof fetch;
}

/**
 * Endpoint v4 (accounts/{id}/locations/{id}/reviews) mengikuti dokumentasi Business Profile API dan BELUM diuji
 * terhadap Google (akses API masih ditinjau). Pesan error hanya memuat kode status, tidak pernah isi respons atau token.
 */
export class HttpGbpClient implements GbpClient {
  private token?: { value: string; expiresAt: number };
  private readonly doFetch: typeof fetch;

  constructor(private readonly options: HttpGbpOptions) {
    this.doFetch = options.fetcher ?? ((input, init) => fetch(input, init));
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt - 60_000 > Date.now()) return this.token.value;
    const body = new URLSearchParams({ client_id: this.options.clientId, client_secret: this.options.clientSecret, refresh_token: this.options.refreshToken, grant_type: 'refresh_token' });
    const res = await this.doFetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
    if (!res.ok) throw new Error(`Google OAuth gagal (${res.status})`);
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error('Google OAuth gagal (tanpa access token)');
    this.token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
    return this.token.value;
  }

  private async call(path: string, init: { method?: string; body?: string } = {}): Promise<Response> {
    const res = await this.doFetch(`${API}/${path}`, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${await this.accessToken()}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body,
    });
    if (!res.ok) throw new Error(`Google Business Profile API gagal (${res.status})`);
    return res;
  }

  async listNewReviews(location: string, sinceIso: string): Promise<GbpReview[]> {
    const found: GbpReview[] = [];
    let pageToken = '';
    for (let page = 0; page < MAX_PAGES; page++) {
      const query = `pageSize=50&orderBy=updateTime%20desc${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
      const data = (await (await this.call(`${location}/reviews?${query}`)).json()) as { reviews?: ApiReview[]; nextPageToken?: string };
      for (const r of data.reviews ?? []) {
        const rating = STARS[r.starRating ?? ''];
        if (!r.name || !rating || !r.createTime || r.createTime < sinceIso) continue;
        found.push({ id: r.name, location, reviewer: r.reviewer?.displayName ?? '', rating, text: r.comment ?? '', createdAt: r.createTime, hasReply: !!r.reviewReply?.comment });
      }
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }
    return found;
  }

  async reply(reviewId: string, text: string): Promise<void> {
    await this.call(`${reviewId}/reply`, { method: 'PUT', body: JSON.stringify({ comment: text }) });
  }
}

/** 'mock' → data contoh; secret OAuth lengkap → klien sungguhan; selain itu null (belum aktif) */
export function createGbpClient(env: Env, now = Date.now()): GbpClient | null {
  if (env.GBP_CLIENT === 'mock') return new MockGbpClient(sampleReviews(now));
  if (env.GBP_CLIENT_ID && env.GBP_CLIENT_SECRET && env.GBP_REFRESH_TOKEN) {
    return new HttpGbpClient({ clientId: env.GBP_CLIENT_ID, clientSecret: env.GBP_CLIENT_SECRET, refreshToken: env.GBP_REFRESH_TOKEN });
  }
  return null;
}

/**
 * Ongkir: antarmuka penyedia + implementasi manual (default) dan RajaOngkir (Komerce, paket Starter gratis 100 hit/hari).
 * RajaOngkir hanya dipakai bila: pengaturan shipping_provider = 'rajaongkir' DAN env SHIPPING_PROVIDER = 'rajaongkir'
 * DAN secret RAJAONGKIR_API_KEY ada. Hemat kuota:
 *  - pencarian wilayah: hasil disimpan di shipping_regions; kata kunci yang pernah dicari tidak memanggil API lagi
 *  - tarif: cache 7 hari per asal–tujuan–berat (dibulatkan ke 1 kg) di shipping_rate_cache
 *  - penghitung hit harian (shipping_api_usage); di atas batas → berhenti memanggil API
 * Error / kuota habis / mati → null = ongkir manual (admin mengisi). Tidak pernah menggagalkan checkout.
 */
import type { Env } from '../env';

export interface Region {
  id: string;
  label: string;
  postalCode: string | null;
}

export interface Rate {
  courier: string;
  courierName: string;
  service: string;
  description: string;
  cost: number;
  etd: string;
}

export interface ShippingProvider {
  readonly name: 'manual' | 'rajaongkir';
  searchRegions(query: string): Promise<Region[]>;
  /** null = tidak tersedia → ongkir manual */
  quote(originRegionId: string, destinationRegionId: string, weightGram: number): Promise<Rate[] | null>;
}

export const manualShipping: ShippingProvider = {
  name: 'manual',
  async searchRegions() {
    return [];
  },
  async quote() {
    return null;
  },
};

const BASE = 'https://rajaongkir.komerce.id/api/v1';
const COURIERS = 'jne:sicepat:jnt:anteraja:pos:tiki';
const RATE_TTL_DAYS = 7;
const normalize = (q: string) => q.trim().toLowerCase().replace(/\s+/g, ' ');

async function useHit(db: D1Database, limit: number): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const row = await db
    .prepare(
      `INSERT INTO shipping_api_usage (provider, day, hits) VALUES ('rajaongkir', ?1, 1)
       ON CONFLICT (provider, day) DO UPDATE SET hits = hits + 1 RETURNING hits`,
    )
    .bind(day)
    .first<{ hits: number }>();
  return (row?.hits ?? 0) <= limit;
}

export function rajaOngkir(db: D1Database, apiKey: string, dailyLimit: number, fetcher: typeof fetch = fetch): ShippingProvider {
  const headers = { key: apiKey, 'x-api-key': apiKey, accept: 'application/json' };
  return {
    name: 'rajaongkir',
    async searchRegions(query) {
      const q = normalize(query);
      if (q.length < 3) return [];
      const local = async () =>
        (
          await db
            .prepare(`SELECT id, label, postal_code FROM shipping_regions WHERE provider = 'rajaongkir' AND search_text LIKE ?1 ORDER BY label LIMIT 20`)
            .bind(`%${q}%`)
            .all<{ id: string; label: string; postal_code: string | null }>()
        ).results.map((r) => ({ id: r.id, label: r.label, postalCode: r.postal_code }));
      const asked = await db.prepare(`SELECT 1 AS x FROM shipping_region_queries WHERE provider = 'rajaongkir' AND query = ?`).bind(q).first();
      if (asked) return local();
      if (!(await useHit(db, dailyLimit))) return local();
      try {
        const res = await fetcher(`${BASE}/destination/domestic-destination?${new URLSearchParams({ search: q, limit: '20', offset: '0' })}`, { headers });
        if (!res.ok) return local();
        const body = (await res.json()) as { data?: { id: number | string; label: string; zip_code?: string }[] };
        const rows = body.data ?? [];
        await db.batch([
          ...rows.map((r) =>
            db
              .prepare(
                `INSERT INTO shipping_regions (provider, id, label, search_text, postal_code) VALUES ('rajaongkir', ?1, ?2, ?3, ?4)
                 ON CONFLICT (provider, id) DO UPDATE SET label = excluded.label, search_text = excluded.search_text, postal_code = excluded.postal_code`,
              )
              .bind(String(r.id), r.label, normalize(r.label), r.zip_code ?? null),
          ),
          db.prepare(`INSERT OR REPLACE INTO shipping_region_queries (provider, query, fetched_at) VALUES ('rajaongkir', ?1, ?2)`).bind(q, new Date().toISOString()),
        ]);
      } catch (e) {
        console.error('rajaongkir search', e);
      }
      return local();
    },
    async quote(origin, destination, weightGram) {
      const kg = Math.max(1, Math.ceil(weightGram / 1000));
      const key = `rajaongkir:${origin}:${destination}:${kg}`;
      const now = new Date();
      const cached = await db.prepare('SELECT payload FROM shipping_rate_cache WHERE key = ? AND expires_at > ?').bind(key, now.toISOString()).first<{ payload: string }>();
      if (cached) return JSON.parse(cached.payload) as Rate[];
      if (!(await useHit(db, dailyLimit))) return null;
      try {
        const res = await fetcher(`${BASE}/calculate/domestic-cost`, {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ origin, destination, weight: String(kg * 1000), courier: COURIERS, price: 'lowest' }),
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { data?: { name: string; code: string; service: string; description?: string; cost: number; etd?: string }[] };
        const rates = (body.data ?? [])
          .filter((r) => Number.isInteger(r.cost) && r.cost > 0)
          .map((r) => ({ courier: r.code, courierName: r.name, service: r.service, description: r.description ?? '', cost: r.cost, etd: r.etd ?? '' }))
          .sort((a, b) => a.cost - b.cost)
          .slice(0, 8);
        if (!rates.length) return null;
        await db
          .prepare('INSERT OR REPLACE INTO shipping_rate_cache (key, payload, expires_at) VALUES (?, ?, ?)')
          .bind(key, JSON.stringify(rates), new Date(now.getTime() + RATE_TTL_DAYS * 86_400_000).toISOString())
          .run();
        return rates;
      } catch (e) {
        console.error('rajaongkir quote', e);
        return null;
      }
    },
  };
}

/** Penyedia yang berlaku sekarang (manual bila salah satu syarat RajaOngkir tidak terpenuhi) */
export function shippingProvider(env: Pick<Env, 'DB' | 'SHIPPING_PROVIDER' | 'RAJAONGKIR_API_KEY'>, settings: { shipping_provider: string; shipping_daily_limit: number }): ShippingProvider {
  if (settings.shipping_provider === 'rajaongkir' && env.SHIPPING_PROVIDER === 'rajaongkir' && env.RAJAONGKIR_API_KEY) {
    return rajaOngkir(env.DB, env.RAJAONGKIR_API_KEY, settings.shipping_daily_limit);
  }
  return manualShipping;
}

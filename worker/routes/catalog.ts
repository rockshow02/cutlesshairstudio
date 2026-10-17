/**
 * GET /api/public/catalog: data cabang, hairstylist, dan harga dari D1 dalam bentuk PERSIS sama dengan
 * src/content/branches.json, barbers.json, pricing.json (sebelum migrasi dikelola Pages CMS), sehingga
 * src/lib/content.ts cukup mengganti sumber data dan komponen landing page tidak berubah.
 * Di-cache 60 detik di edge (Cache API) agar kunjungan landing page tidak membebani kuota baca D1.
 */
import type { Context } from 'hono';
import { createRouter, type AppEnv } from '../app';
import type { Env } from '../env';
import { hydrateProducts, shopActive } from '../lib/shop';

export const catalogRoutes = createRouter();

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
/** Urutan tampil jam buka di landing page: Senin … Minggu */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const STATUS = { active: 'Aktif', coming_soon: 'Segera Dibuka', closed: 'Tutup Sementara' } as const;
const TTL_SECONDS = 60;

/**
 * Produk toko (D1) dalam bentuk src/content/products.json + slug, hanya bila toko aktif.
 * Toko mati → undefined: landing page & /produk tetap memakai products.json.
 */
async function shopProducts(env: Pick<Env, 'DB' | 'SHOP_ENABLED'>) {
  if (!(await shopActive(env))) return undefined;
  const { results } = await env.DB.prepare(
    `SELECT id, slug, name, category, description, notes, badge, is_active, sort_order, release_at, per_customer_limit FROM products
     WHERE is_active = 1 ORDER BY sort_order, id LIMIT 100`,
  ).all<Parameters<typeof hydrateProducts>[1][number]>();
  const products = await hydrateProducts(env.DB, results);
  return products
    .filter((p) => p.variants.length)
    .map((p) => {
      const cheapest = p.variants.reduce((a, b) => (b.price < a.price ? b : a));
      return {
        slug: p.slug,
        name: p.name,
        category: p.category,
        price: cheapest.price,
        compareAtPrice: cheapest.compareAtPrice ?? undefined,
        size: p.variants.length === 1 ? p.variants[0].name : undefined,
        description: p.description ?? undefined,
        image: p.images[0]?.path,
        badge: p.badge ?? undefined,
        inStock: p.variants.some((v) => Object.values(v.stock).some((n) => n > 0)),
        order: p.sortOrder,
        isActive: true,
      };
    });
}

export async function buildCatalog(db: D1Database, env?: Pick<Env, 'SHOP_ENABLED'>) {
  const [branches, hours, barbers, services, prices] = await db.batch([
    db.prepare('SELECT * FROM branches ORDER BY sort_order, id'),
    db.prepare('SELECT * FROM branch_hours'),
    db.prepare('SELECT b.*, br.slug AS branch_slug FROM barbers b JOIN branches br ON br.id = b.branch_id ORDER BY b.sort_order, b.id'),
    db.prepare('SELECT * FROM services ORDER BY sort_order, id'),
    db.prepare('SELECT bs.*, br.slug AS branch_slug FROM branch_services bs JOIN branches br ON br.id = bs.branch_id WHERE bs.price IS NOT NULL'),
  ]);
  type Row = Record<string, unknown>;
  const h = hours.results as Row[];
  const p = prices.results as Row[];
  const products = env ? await shopProducts({ DB: db, SHOP_ENABLED: env.SHOP_ENABLED }) : undefined;
  return {
    ...(products ? { products } : {}),
    branches: (branches.results as Row[]).map((b) => ({
      slug: b.slug,
      name: b.name,
      city: b.city,
      province: b.province,
      address: b.address ?? undefined,
      googleMapsUrl: b.maps_url ?? undefined,
      latitude: b.lat ?? undefined,
      longitude: b.lng ?? undefined,
      whatsappNumber: b.whatsapp,
      timezone: b.timezone,
      openingHours: DISPLAY_ORDER.map((d) => {
        const row = h.find((x) => x.branch_id === b.id && x.weekday === d);
        return row ? { day: DAY_NAMES[d], openTime: row.open_time, closeTime: row.close_time, isClosed: false } : { day: DAY_NAMES[d], isClosed: true };
      }),
      status: STATUS[b.status as keyof typeof STATUS],
      photo: b.photo ?? undefined,
      order: b.sort_order,
    })),
    barbers: (barbers.results as Row[]).map((b) => ({
      name: b.name,
      role: b.role ?? undefined,
      photo: b.photo ?? '',
      branchSlug: b.branch_slug,
      specialty: b.specialty ?? undefined,
      whatsappNumber: b.whatsapp ?? undefined,
      instagram: b.instagram ?? undefined,
      order: b.sort_order,
      isActive: Boolean(b.is_active),
    })),
    pricing: (services.results as Row[]).map((s) => ({
      name: s.name,
      category: s.category,
      price: s.base_price,
      priceFrom: Boolean(s.price_from),
      description: s.description ?? undefined,
      badge: s.badge ?? undefined,
      order: s.sort_order,
      isActive: Boolean(s.is_active),
      branchPrices: p.filter((x) => x.service_id === s.id).map((x) => ({ branchSlug: x.branch_slug, price: x.price })),
    })),
  };
}

catalogRoutes.get('/public/catalog', async (c: Context<AppEnv>) => {
  const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
  const key = new Request(new URL('/api/public/catalog?v=1', c.req.url).toString());
  const hit = cache ? await cache.match(key) : undefined;
  if (hit) return hit;
  const res = new Response(JSON.stringify(await buildCatalog(c.env.DB, c.env)), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${TTL_SECONDS}` },
  });
  if (cache) {
    try {
      await cache.put(key, res.clone());
    } catch {
      /* Cache API tidak tersedia (mis. tes) */
    }
  }
  return res;
});

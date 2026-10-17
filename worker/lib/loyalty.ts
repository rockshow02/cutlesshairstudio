/**
 * Cutless Stamp: 1 booking Selesai = 1 stempel; hadiah di stempel ke-N (tingkat 1) dan ke-M (tingkat 2, kartu reset).
 *
 * Semua penulisan berupa pernyataan SQL BERSYARAT yang disisipkan ke db.batch pemanggil (atomik dengan perubahan
 * status booking) dan idempoten:
 *  - stempel: UNIQUE(booking_id) + UNIQUE(customer_id, stamp_date) untuk kind='booking' → INSERT OR IGNORE
 *  - voucher: UNIQUE(issue_key = pelanggan:siklus:tingkat) → INSERT OR IGNORE
 *  - audit hanya ditulis bila baris dengan id yang dibuat di sini benar-benar ada
 * Program aktif bila env LOYALTY_ENABLED='true' DAN loyalty_settings.enabled = 1. Env mati → tidak ada pernyataan
 * loyalty yang ditambahkan sama sekali (perilaku booking identik dengan sebelum fitur ini).
 */
import type { Env } from '../env';
import { localDate } from '../../shared/time';
import type { AuditActor } from './bookings';
import { ApiError } from './errors';

export const loyaltyEnv = (env: Pick<Env, 'LOYALTY_ENABLED'>) => env.LOYALTY_ENABLED === 'true';

export interface LoyaltySettings {
  enabled: boolean;
  tier1_stamps: number;
  tier1_service_ids: number[];
  tier2_stamps: number;
  tier2_service_ids: number[];
  stamp_valid_months: number;
  voucher_valid_days: number;
  updated_at: string;
  updated_by: string | null;
}

type SettingsRow = Omit<LoyaltySettings, 'enabled' | 'tier1_service_ids' | 'tier2_service_ids'> & { enabled: number; tier1_service_ids: string; tier2_service_ids: string };

const parseIds = (s: string): number[] => {
  try {
    const v = JSON.parse(s) as unknown;
    return Array.isArray(v) ? v.filter((x): x is number => Number.isInteger(x)) : [];
  } catch {
    return [];
  }
};

export async function getLoyaltySettings(db: D1Database): Promise<LoyaltySettings | null> {
  const r = await db.prepare('SELECT * FROM loyalty_settings WHERE id = 1').first<SettingsRow>();
  if (!r) return null;
  return { ...r, enabled: Boolean(r.enabled), tier1_service_ids: parseIds(r.tier1_service_ids), tier2_service_ids: parseIds(r.tier2_service_ids) };
}

/** Program benar-benar aktif (env + pengaturan) */
export async function loyaltyActive(env: Pick<Env, 'LOYALTY_ENABLED' | 'DB'>): Promise<LoyaltySettings | null> {
  if (!loyaltyEnv(env)) return null;
  const s = await getLoyaltySettings(env.DB);
  return s?.enabled ? s : null;
}

const ISO = `'%Y-%m-%dT%H:%M:%fZ'`;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `CS-${Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')}`;
};
let codeGenerator = randomCode;
/** Kode voucher untuk kasir, mis. CS-7K2Q9M (32^6 kombinasi) */
export const voucherCode = (): string => codeGenerator();
/** Khusus tes: ganti generator kode (mis. untuk memaksa tabrakan). Tanpa argumen = kembali acak. */
export function setVoucherCodeGenerator(fn?: () => string) {
  codeGenerator = fn ?? randomCode;
}
/** Jumlah kandidat kode per voucher; kode dipilih di SQL = kandidat pertama yang belum dipakai */
export const CODE_ATTEMPTS = 5;

const ENABLED = `EXISTS (SELECT 1 FROM loyalty_settings WHERE id = 1 AND enabled = 1)`;

/** Pastikan kartu pelanggan ada (hanya bila program aktif) */
const ensureCard = (db: D1Database, customerId: string) =>
  db.prepare(`INSERT OR IGNORE INTO loyalty_cards (customer_id) SELECT ?1 WHERE ${ENABLED}`).bind(customerId);

/**
 * Evaluasi kartu: terbitkan voucher tingkat 1/2 bila jumlah stempel aktif di siklus berjalan mencapai target,
 * lalu (tingkat 2) tandai stempel siklus itu "used" dan naikkan siklus (kartu kembali ke 0).
 *
 * Konflik dipisah: issue_key yang sudah ada = voucher tingkat itu sudah terbit → diabaikan (OR IGNORE).
 * Kode voucher TIDAK bergantung pada OR IGNORE: dari 5 kandidat, SQL memilih yang belum dipakai (batch D1 =
 * satu transaksi berurutan, jadi pilihan ini aman). Bila kelimanya sudah dipakai, voucher tidak terbit,
 * kegagalan dicatat di audit (loyalty.voucher_issue_failed) dan dicoba lagi otomatis di evaluasi berikutnya
 * (target tetap tercapai, issue_key belum ada).
 */
export function evaluateStatements(db: D1Database, customerId: string, nowIso: string): D1PreparedStatement[] {
  const v1 = crypto.randomUUID();
  const v2 = crypto.randomUUID();
  const activeCount = `(SELECT COUNT(*) FROM loyalty_stamps st WHERE st.customer_id = ?1 AND st.cycle = card.cycle AND st.status = 'active')`;
  const due = (tier: 1 | 2) => `s.id = 1 AND s.enabled = 1 AND s.tier${tier}_service_ids <> '[]' AND ${activeCount} >= s.tier${tier}_stamps`;
  const candidates = Array.from({ length: CODE_ATTEMPTS }, (_, i) => `(?${i + 5})`).join(', ');
  const issue = (vid: string, tier: 1 | 2) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO loyalty_vouchers (id, code, customer_id, issue_key, tier, service_ids, status, issued_at, expires_at)
         SELECT ?2,
                (SELECT c.column1 FROM (VALUES ${candidates}) AS c WHERE NOT EXISTS (SELECT 1 FROM loyalty_vouchers x WHERE x.code = c.column1) LIMIT 1),
                ?1, ?1 || ':' || card.cycle || ':${tier}', ${tier}, s.tier${tier}_service_ids, 'active', ?4,
                strftime(${ISO}, ?4, '+' || s.voucher_valid_days || ' days')
         FROM loyalty_settings s JOIN loyalty_cards card ON card.customer_id = ?1
         WHERE ${due(tier)}`,
      )
      .bind(customerId, vid, null, nowIso, ...Array.from({ length: CODE_ATTEMPTS }, () => voucherCode()));
  /** Target tercapai tetapi voucher tingkat itu tetap belum ada (semua kandidat kode terpakai) → catat */
  const issueFailed = (tier: 1 | 2) =>
    db
      .prepare(
        `INSERT INTO audit_log (actor_type, actor_id, action, entity, entity_id, payload)
         SELECT 'system', NULL, 'loyalty.voucher_issue_failed', 'customer', ?1, json_object('tier', ${tier}, 'cycle', card.cycle, 'reason', 'code_collision')
         FROM loyalty_settings s JOIN loyalty_cards card ON card.customer_id = ?1
         WHERE ${due(tier)} AND NOT EXISTS (SELECT 1 FROM loyalty_vouchers v WHERE v.issue_key = ?1 || ':' || card.cycle || ':${tier}')`,
      )
      .bind(customerId);
  const tier2Issued = `EXISTS (SELECT 1 FROM loyalty_vouchers v WHERE v.issue_key = ?1 || ':' || (SELECT cycle FROM loyalty_cards WHERE customer_id = ?1) || ':2')`;
  const auditVoucher = (vid: string) =>
    db
      .prepare(
        `INSERT INTO audit_log (actor_type, actor_id, action, entity, entity_id, payload)
         SELECT 'system', NULL, 'loyalty.voucher_issue', 'voucher', id, json_object('customer', customer_id, 'tier', tier, 'code', code)
         FROM loyalty_vouchers WHERE id = ?1`,
      )
      .bind(vid);
  return [
    issue(v1, 1),
    issue(v2, 2),
    issueFailed(1),
    issueFailed(2),
    db
      .prepare(`UPDATE loyalty_stamps SET status = 'used' WHERE customer_id = ?1 AND status = 'active' AND cycle = (SELECT cycle FROM loyalty_cards WHERE customer_id = ?1) AND ${tier2Issued}`)
      .bind(customerId),
    db.prepare(`UPDATE loyalty_cards SET cycle = cycle + 1, updated_at = ?2 WHERE customer_id = ?1 AND ${tier2Issued}`).bind(customerId, nowIso),
    auditVoucher(v1),
    auditVoucher(v2),
  ];
}

export interface CompletedBooking {
  id: string;
  customer_id: string;
  branch_id: number;
  service_id: number;
  start_at: string;
}

/**
 * Pernyataan untuk batch "Selesai": kartu, stempel (bila memenuhi syarat), evaluasi hadiah, audit.
 * Syarat stempel: booking berstatus completed, layanan bisa dibooking & bukan kategori Paket, tidak dibayar
 * dengan voucher loyalty, maks. 1 stempel per pelanggan per tanggal lokal cabang (indeks unik parsial).
 */
export function completionStatements(db: D1Database, b: CompletedBooking, timezone: string, actor: AuditActor, now: number): D1PreparedStatement[] {
  const nowIso = new Date(now).toISOString();
  const stampId = crypto.randomUUID();
  const stampDate = localDate(Date.parse(b.start_at), timezone);
  return [
    ensureCard(db, b.customer_id),
    db
      .prepare(
        `INSERT OR IGNORE INTO loyalty_stamps (id, customer_id, booking_id, branch_id, stamp_date, cycle, kind, status, created_by, created_at, expires_at)
         SELECT ?1, ?2, ?3, ?4, ?5, card.cycle, 'booking', 'active', ?6, ?7, strftime(${ISO}, ?7, '+' || s.stamp_valid_months || ' months')
         FROM loyalty_settings s JOIN loyalty_cards card ON card.customer_id = ?2
         WHERE s.id = 1 AND s.enabled = 1
           AND EXISTS (SELECT 1 FROM bookings WHERE id = ?3 AND status = 'completed')
           AND EXISTS (SELECT 1 FROM services sv WHERE sv.id = ?8 AND sv.is_bookable = 1 AND lower(sv.category) <> 'paket')
           AND NOT EXISTS (SELECT 1 FROM loyalty_vouchers WHERE redeemed_booking_id = ?3)`,
      )
      .bind(stampId, b.customer_id, b.id, b.branch_id, stampDate, actor.id, nowIso, b.service_id),
    db
      .prepare(
        `INSERT INTO audit_log (actor_type, actor_id, action, entity, entity_id, payload)
         SELECT ?2, ?3, 'loyalty.stamp', 'booking', booking_id, json_object('customer', customer_id, 'stamp', id, 'date', stamp_date)
         FROM loyalty_stamps WHERE id = ?1`,
      )
      .bind(stampId, actor.type, actor.id),
    ...evaluateStatements(db, b.customer_id, nowIso),
  ];
}

/**
 * Booking batal / tidak datang: voucher yang sudah ditukar di booking itu dikembalikan — aktif lagi, atau
 * "expired" bila sudah lewat masa berlakunya — dan harga booking dipulihkan. Bersyarat status booking sudah berubah.
 */
export function releaseVoucherStatements(db: D1Database, bookingId: string, actor: AuditActor, now: number): D1PreparedStatement[] {
  const nowIso = new Date(now).toISOString();
  const done = `EXISTS (SELECT 1 FROM bookings WHERE id = ?1 AND status IN ('cancelled', 'no_show'))`;
  return [
    db
      .prepare(
        `INSERT INTO audit_log (actor_type, actor_id, action, entity, entity_id, payload)
         SELECT ?2, ?3, 'loyalty.voucher_release', 'voucher', id, json_object('booking', ?1, 'to', CASE WHEN expires_at <= ?4 THEN 'expired' ELSE 'active' END)
         FROM loyalty_vouchers WHERE redeemed_booking_id = ?1 AND status = 'redeemed' AND ${done}`,
      )
      .bind(bookingId, actor.type, actor.id, nowIso),
    db
      .prepare(`UPDATE bookings SET price_snapshot = COALESCE((SELECT value_snapshot FROM loyalty_vouchers WHERE redeemed_booking_id = ?1 AND status = 'redeemed'), price_snapshot) WHERE id = ?1 AND ${done}`)
      .bind(bookingId),
    db
      .prepare(
        `UPDATE loyalty_vouchers SET status = CASE WHEN expires_at <= ?2 THEN 'expired' ELSE 'active' END,
           redeemed_booking_id = NULL, redeemed_at = NULL, redeemed_by = NULL
         WHERE redeemed_booking_id = ?1 AND status = 'redeemed' AND ${done}`,
      )
      .bind(bookingId, nowIso),
  ];
}

/** Penukaran voucher di booking (admin). Hasil batch[0].meta.changes = 1 bila berhasil. */
export function redeemStatements(db: D1Database, input: { voucherId: string; bookingId: string; customerId: string; serviceId: number; price: number; actor: AuditActor; now: number }): D1PreparedStatement[] {
  const nowIso = new Date(input.now).toISOString();
  return [
    db
      .prepare(
        `UPDATE loyalty_vouchers SET status = 'redeemed', redeemed_booking_id = ?2, redeemed_at = ?5, redeemed_by = ?6, value_snapshot = ?7
         WHERE id = ?1 AND status = 'active' AND expires_at > ?5 AND customer_id = ?3
           AND EXISTS (SELECT 1 FROM json_each(service_ids) WHERE value = ?4)
           AND EXISTS (SELECT 1 FROM bookings WHERE id = ?2 AND status IN ('pending', 'confirmed'))
           AND NOT EXISTS (SELECT 1 FROM loyalty_vouchers WHERE redeemed_booking_id = ?2)
           AND ${ENABLED}`,
      )
      .bind(input.voucherId, input.bookingId, input.customerId, input.serviceId, nowIso, input.actor.id, input.price),
    db.prepare(`UPDATE bookings SET price_snapshot = 0 WHERE id = ?1 AND EXISTS (SELECT 1 FROM loyalty_vouchers WHERE id = ?2 AND redeemed_booking_id = ?1)`).bind(input.bookingId, input.voucherId),
    db
      .prepare(
        `INSERT INTO audit_log (actor_type, actor_id, action, entity, entity_id, payload)
         SELECT ?3, ?4, 'loyalty.voucher_redeem', 'voucher', id, json_object('booking', redeemed_booking_id, 'code', code, 'value', value_snapshot)
         FROM loyalty_vouchers WHERE id = ?1 AND redeemed_booking_id = ?2`,
      )
      .bind(input.voucherId, input.bookingId, input.actor.type, input.actor.id),
  ];
}

/** Batalkan penukaran (sebelum Selesai): voucher aktif lagi (atau expired), harga booking dipulihkan */
export function unredeemStatements(db: D1Database, bookingId: string, actor: AuditActor, now: number): D1PreparedStatement[] {
  const nowIso = new Date(now).toISOString();
  const open = `EXISTS (SELECT 1 FROM bookings WHERE id = ?1 AND status IN ('pending', 'confirmed'))`;
  return [
    db
      .prepare(`UPDATE bookings SET price_snapshot = COALESCE((SELECT value_snapshot FROM loyalty_vouchers WHERE redeemed_booking_id = ?1), price_snapshot) WHERE id = ?1 AND ${open} AND EXISTS (SELECT 1 FROM loyalty_vouchers WHERE redeemed_booking_id = ?1)`)
      .bind(bookingId),
    db
      .prepare(
        `INSERT INTO audit_log (actor_type, actor_id, action, entity, entity_id, payload)
         SELECT ?2, ?3, 'loyalty.voucher_unredeem', 'voucher', id, json_object('booking', ?1) FROM loyalty_vouchers WHERE redeemed_booking_id = ?1 AND ${open}`,
      )
      .bind(bookingId, actor.type, actor.id),
    db
      .prepare(
        `UPDATE loyalty_vouchers SET status = CASE WHEN expires_at <= ?2 THEN 'expired' ELSE 'active' END, redeemed_booking_id = NULL, redeemed_at = NULL, redeemed_by = NULL
         WHERE redeemed_booking_id = ?1 AND ${open}`,
      )
      .bind(bookingId, nowIso),
  ];
}

/** Cron harian: hanguskan stempel & voucher yang lewat masa berlaku */
export async function expireLoyalty(env: Pick<Env, 'LOYALTY_ENABLED' | 'DB'>, now = Date.now()): Promise<{ stamps: number; vouchers: number }> {
  if (!loyaltyEnv(env)) return { stamps: 0, vouchers: 0 };
  const nowIso = new Date(now).toISOString();
  const [s, v] = await env.DB.batch([
    env.DB.prepare(`UPDATE loyalty_stamps SET status = 'expired' WHERE status = 'active' AND expires_at <= ?1`).bind(nowIso),
    env.DB.prepare(`UPDATE loyalty_vouchers SET status = 'expired' WHERE status = 'active' AND expires_at <= ?1`).bind(nowIso),
  ]);
  const result = { stamps: s.meta.changes ?? 0, vouchers: v.meta.changes ?? 0 };
  if (result.stamps || result.vouchers) {
    await env.DB.prepare(`INSERT INTO audit_log (actor_type, actor_id, action, entity, entity_id, payload) VALUES ('system', NULL, 'loyalty.expire', 'loyalty', 'cron', ?)`)
      .bind(JSON.stringify(result))
      .run();
  }
  return result;
}

/* ---------- Bacaan ---------- */

export interface CardView {
  stamps: number;
  cycle: number;
  tier1: number;
  tier2: number;
  /** Hadiah berikutnya: tingkat & sisa stempel */
  next: { tier: 1 | 2; remaining: number } | null;
}

export async function cardView(db: D1Database, customerId: string, s: LoyaltySettings): Promise<CardView> {
  const card = await db.prepare('SELECT cycle FROM loyalty_cards WHERE customer_id = ?').bind(customerId).first<{ cycle: number }>();
  const cycle = card?.cycle ?? 0;
  const stamps =
    (await db.prepare(`SELECT COUNT(*) AS n FROM loyalty_stamps WHERE customer_id = ? AND cycle = ? AND status = 'active'`).bind(customerId, cycle).first<{ n: number }>())?.n ?? 0;
  const t1Issued = await db.prepare('SELECT 1 AS x FROM loyalty_vouchers WHERE issue_key = ?').bind(`${customerId}:${cycle}:1`).first();
  const next: CardView['next'] =
    !t1Issued && stamps < s.tier1_stamps && s.tier1_service_ids.length ? { tier: 1, remaining: s.tier1_stamps - stamps } : { tier: 2, remaining: Math.max(0, s.tier2_stamps - stamps) };
  return { stamps, cycle, tier1: s.tier1_stamps, tier2: s.tier2_stamps, next };
}

export interface VoucherRow {
  id: string;
  code: string;
  customer_id: string;
  tier: 1 | 2;
  service_ids: string;
  status: 'active' | 'redeemed' | 'expired';
  issued_at: string;
  expires_at: string;
  redeemed_booking_id: string | null;
  redeemed_at: string | null;
  redeemed_by: string | null;
  value_snapshot: number | null;
}

/** Nama layanan untuk daftar id (untuk tampilan) */
export async function serviceNames(db: D1Database, ids: number[]): Promise<Record<number, string>> {
  if (!ids.length) return {};
  const { results } = await db.prepare(`SELECT id, name FROM services WHERE id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(ids)).all<{ id: number; name: string }>();
  return Object.fromEntries(results.map((r) => [r.id, r.name]));
}

export async function presentVouchers(db: D1Database, rows: VoucherRow[]) {
  const ids = [...new Set(rows.flatMap((v) => parseIds(v.service_ids)))];
  const names = await serviceNames(db, ids);
  return rows.map((v) => {
    const serviceIds = parseIds(v.service_ids);
    return {
      id: v.id,
      code: v.code,
      tier: v.tier,
      status: v.status,
      serviceIds,
      services: serviceIds.map((i) => names[i]).filter(Boolean),
      issuedAt: v.issued_at,
      expiresAt: v.expires_at,
      redeemedBookingId: v.redeemed_booking_id,
      redeemedAt: v.redeemed_at,
    };
  });
}

/** Tukar voucher dengan pesan jelas bila tidak bisa; dipakai juga oleh walk-in */
export async function redeemVoucher(
  db: D1Database,
  input: { voucherId: string; booking: { id: string; customer_id: string; service_id: number; price_snapshot: number; status: string }; actor: AuditActor },
) {
  const v = await db.prepare('SELECT * FROM loyalty_vouchers WHERE id = ?').bind(input.voucherId).first<VoucherRow>();
  const now = Date.now();
  if (!v || v.customer_id !== input.booking.customer_id) throw new ApiError(409, 'VOUCHER_UNAVAILABLE', 'Voucher tidak ditemukan untuk pelanggan ini.');
  if (v.status === 'redeemed') throw new ApiError(409, 'VOUCHER_UNAVAILABLE', 'Voucher ini sudah ditukar.');
  if (v.status === 'expired' || Date.parse(v.expires_at) <= now) throw new ApiError(409, 'VOUCHER_UNAVAILABLE', 'Voucher sudah kedaluwarsa.');
  if (!(JSON.parse(v.service_ids) as number[]).includes(input.booking.service_id)) throw new ApiError(409, 'VOUCHER_UNAVAILABLE', 'Voucher ini tidak berlaku untuk layanan di booking ini.');
  if (!['pending', 'confirmed'].includes(input.booking.status)) throw new ApiError(409, 'VOUCHER_UNAVAILABLE', 'Voucher hanya bisa ditukar sebelum booking Selesai.');
  const res = await db.batch(
    redeemStatements(db, { voucherId: v.id, bookingId: input.booking.id, customerId: input.booking.customer_id, serviceId: input.booking.service_id, price: input.booking.price_snapshot, actor: input.actor, now }),
  );
  if (!res[0].meta.changes) throw new ApiError(409, 'VOUCHER_UNAVAILABLE', 'Voucher tidak bisa ditukar (baru saja dipakai, atau booking sudah memakai voucher lain).');
}

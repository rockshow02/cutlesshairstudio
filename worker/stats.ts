import { OTHER_PAGE, SOURCE_LABELS, WA_CLICK_KINDS, dayWIB, type WaClickAllowlist } from '../src/content/waClicks';
import { isAccessAllowed } from './access';
import type { D1Database, Env } from './env';
import { loadAllowlist } from './waClicks';

/**
 * /statistik/: hitungan klik WhatsApp dari D1, dirender Worker (HTML tanpa JavaScript). Hanya untuk pengguna yang lolos
 * Cloudflare Access (JWT diverifikasi di sini juga, lihat access.ts). noindex, tidak di sitemap/llms.txt, tidak di-cache.
 *   ?dari=YYYY-MM-DD&sampai=YYYY-MM-DD  rentang tanggal (WIB, default 30 hari terakhir, maks. 366 hari)
 *   &format=csv                          unduh CSV rentang itu
 */

export const STATS_PATH = '/statistik/';
const MAX_DAYS = 366;
const DAY_MS = 86_400_000;

export interface ClickRecord {
  day: string;
  kind: string;
  branch: string;
  barber: string;
  page: string;
  source: string;
  clicks: number;
}

export interface Ranked {
  key: string;
  label: string;
  clicks: number;
}

export interface Stats {
  from: string;
  to: string;
  today: string;
  total: number;
  last7: number;
  last30: number;
  daily: { day: string; clicks: number }[];
  byBranch: Ranked[];
  byKind: Ranked[];
  byBarber: Ranked[];
  byPage: Ranked[];
  bySource: Ranked[];
}

export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const isDay = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && addDays(v, 0) === v;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;

/** Rentang dari query string; tidak valid → 30 hari terakhir; terbalik → ditukar; > 366 hari → dipotong dari awal */
export function parseRange(url: URL, today: string): { from: string; to: string } {
  const a = url.searchParams.get('dari');
  const b = url.searchParams.get('sampai');
  let to = isDay(b) ? b : today;
  let from = isDay(a) ? a : addDays(to, -29);
  if (from > to) [from, to] = [to, from];
  if (daysBetween(from, to) > MAX_DAYS) from = addDays(to, -(MAX_DAYS - 1));
  return { from, to };
}

export const fetchClicks = async (db: D1Database, from: string, to: string) =>
  (await db
    .prepare('SELECT day, kind, branch, barber, page, source, clicks FROM wa_clicks WHERE day BETWEEN ? AND ? ORDER BY day, kind, branch, barber, page, source')
    .bind(from, to)
    .all<ClickRecord>()).results;

const branchLabel = (allow: WaClickAllowlist | null, key: string) => (key ? (allow?.branches[key] ?? key) : 'Nomor pusat (tanpa cabang)');
const barberLabel = (allow: WaClickAllowlist | null, key: string) => allow?.barbers[key] ?? key;
const kindLabel = (key: string) => (WA_CLICK_KINDS as Record<string, string>)[key] ?? key;
const pageLabel = (key: string) => (key === OTHER_PAGE ? 'Halaman lain' : key);
const sourceLabel = (key: string) => SOURCE_LABELS[key] ?? key;

function rank(records: ClickRecord[], field: keyof Omit<ClickRecord, 'clicks' | 'day'>, label: (key: string) => string, skipEmpty = false): Ranked[] {
  const sums = new Map<string, number>();
  for (const r of records) if (!(skipEmpty && !r[field])) sums.set(r[field], (sums.get(r[field]) ?? 0) + r.clicks);
  return [...sums].map(([key, clicks]) => ({ key, label: label(key), clicks })).sort((x, y) => y.clicks - x.clicks || x.label.localeCompare(y.label, 'id'));
}

/** Ringkasan: `records` = rentang dipilih, `recent` = 30 hari terakhir s.d. hari ini (kartu 7/30 hari) */
export function summarize(records: ClickRecord[], recent: ClickRecord[], range: { from: string; to: string }, today: string, allow: WaClickAllowlist | null): Stats {
  const sum = (list: ClickRecord[]) => list.reduce((s, r) => s + r.clicks, 0);
  const perDay = new Map<string, number>();
  for (const r of records) perDay.set(r.day, (perDay.get(r.day) ?? 0) + r.clicks);
  return {
    ...range,
    today,
    total: sum(records),
    last7: sum(recent.filter((r) => r.day >= addDays(today, -6) && r.day <= today)),
    last30: sum(recent.filter((r) => r.day >= addDays(today, -29) && r.day <= today)),
    daily: Array.from({ length: daysBetween(range.from, range.to) }, (_, i) => addDays(range.from, i)).map((day) => ({ day, clicks: perDay.get(day) ?? 0 })),
    byBranch: rank(records, 'branch', (k) => branchLabel(allow, k)),
    byKind: rank(records, 'kind', kindLabel),
    byBarber: rank(records, 'barber', (k) => barberLabel(allow, k), true),
    byPage: rank(records, 'page', pageLabel),
    bySource: rank(records, 'source', sourceLabel),
  };
}

/* ---------- CSV ---------- */

/** Sel CSV: dikutip; nilai yang diawali = + - @ diberi ' agar tidak dijalankan sebagai rumus di Excel/Sheets */
const cell = (v: string | number) => {
  const s = String(v);
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

export function statsCsv(records: ClickRecord[], allow: WaClickAllowlist | null): string {
  const head = ['tanggal', 'jenis_tombol', 'cabang', 'kapster', 'halaman', 'asal_kunjungan', 'klik'];
  const rows = records.map((r) => [r.day, kindLabel(r.kind), r.branch ? branchLabel(allow, r.branch) : '', r.barber ? barberLabel(allow, r.barber) : '', pageLabel(r.page), sourceLabel(r.source), r.clicks]);
  // BOM: Excel membaca UTF-8 dengan benar
  return `${String.fromCharCode(0xfeff)}${[head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;
}

/* ---------- HTML ---------- */

const esc = (s: string | number) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const num = (n: number) => n.toLocaleString('id-ID');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const dayLabel = (day: string, withYear = true) => {
  const [y, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`;
};

const STYLE = `
@font-face{font-family:'Plus Jakarta Sans';font-weight:400 800;font-display:swap;src:url(/fonts/plus-jakarta-sans-v1-latin.woff2) format('woff2')}
:root{color-scheme:dark;--ink:#0c1014;--charcoal:#1f1e1c;--bone:#f2efea;--dim:rgba(242,239,234,.7);--line:rgba(242,239,234,.14);--sand:#a59789;--wa:#25d366}
*{box-sizing:border-box}
body{margin:0;background:var(--ink);color:var(--bone);font:15px/1.5 'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}
main{max-width:1080px;margin:0 auto;padding:2rem 1rem 4rem}
h1{font-size:clamp(1.5rem,5vw,2.2rem);letter-spacing:-.02em;margin:.25rem 0 .25rem}
h2{font-size:1rem;letter-spacing:.06em;text-transform:uppercase;margin:0 0 .75rem}
.kicker{color:var(--sand);font-size:.75rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin:0}
.muted{color:var(--dim);margin:0}
form{display:flex;flex-wrap:wrap;gap:.75rem;align-items:flex-end;margin:1.5rem 0 1rem}
label{display:grid;gap:.25rem;font-size:.8rem;color:var(--dim)}
input{min-height:44px;padding:0 .75rem;background:var(--charcoal);color:var(--bone);border:1px solid var(--line);border-radius:3px;font:inherit}
.btn{display:inline-flex;align-items:center;min-height:44px;padding:0 1.1rem;border:1px solid rgba(242,239,234,.45);border-radius:3px;background:transparent;color:var(--bone);font:700 .75rem/1 inherit;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;cursor:pointer}
.btn.primary{background:var(--bone);color:var(--ink);border-color:var(--bone)}
.btn:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid var(--sand);outline-offset:2px}
.quick{display:flex;flex-wrap:wrap;gap:.5rem;margin:0 0 1.5rem}
.quick a{color:var(--bone);font-size:.85rem;padding:.35rem .75rem;border:1px solid var(--line);border-radius:999px;text-decoration:none}
.quick a[aria-current]{background:var(--bone);color:var(--ink)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.75rem;margin:0 0 2rem}
.card{border:1px solid var(--line);border-radius:4px;padding:1rem;background:var(--charcoal)}
.card b{display:block;font-size:2rem;line-height:1.1}
.card span{color:var(--dim);font-size:.85rem}
section{margin:0 0 2rem}
.chart{width:100%;height:auto;display:block;border-bottom:1px solid var(--line)}
.chart rect{fill:var(--sand)}
.axis{display:flex;justify-content:space-between;color:var(--dim);font-size:.75rem;margin-top:.35rem}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:2rem 1.5rem}
table{width:100%;border-collapse:collapse;font-size:.9rem}
td,th{padding:.5rem 0;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{color:var(--dim);font-weight:600;font-size:.75rem;letter-spacing:.06em;text-transform:uppercase}
td.n,th.n{text-align:right;white-space:nowrap;padding-left:.75rem}
td .bar{display:block;height:4px;margin-top:.35rem;background:var(--wa);border-radius:2px;min-width:2px}
td.label{overflow-wrap:anywhere}
.empty{color:var(--dim);border:1px dashed var(--line);border-radius:4px;padding:1rem}
.note{color:var(--dim);font-size:.8rem;margin-top:3rem}
@media (max-width:600px){main{padding-top:1.25rem}.card b{font-size:1.6rem}form>label{flex:1 1 140px}input{width:100%}}
`;

function table(id: string, title: string, head: string, rows: Ranked[], total: number): string {
  const body = rows.length
    ? `<table><thead><tr><th scope="col">${esc(head)}</th><th scope="col" class="n">Klik</th><th scope="col" class="n">%</th></tr></thead><tbody>${rows
        .map((r) => {
          const pct = total ? (r.clicks / total) * 100 : 0;
          return `<tr><td class="label">${esc(r.label)}<span class="bar" style="width:${pct.toFixed(1)}%" aria-hidden="true"></span></td><td class="n">${num(r.clicks)}</td><td class="n">${pct.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%</td></tr>`;
        })
        .join('')}</tbody></table>`
    : '<p class="empty">Belum ada data.</p>';
  return `<section aria-labelledby="t-${id}" data-table="${id}"><h2 id="t-${id}">${esc(title)}</h2>${body}</section>`;
}

function chart(daily: Stats['daily']): string {
  const max = Math.max(1, ...daily.map((d) => d.clicks));
  const w = 1000;
  const h = 220;
  const step = w / daily.length;
  const bars = daily
    .map((d, i) => {
      const bh = (d.clicks / max) * (h - 10);
      return `<rect x="${(i * step + step * 0.15).toFixed(2)}" y="${(h - bh).toFixed(2)}" width="${Math.max(step * 0.7, 1).toFixed(2)}" height="${bh.toFixed(2)}"><title>${esc(dayLabel(d.day))}: ${num(d.clicks)} klik</title></rect>`;
    })
    .join('');
  const label = `Grafik klik per hari, ${dayLabel(daily[0].day)} sampai ${dayLabel(daily[daily.length - 1].day)}, tertinggi ${num(max)} klik per hari`;
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}">${bars}</svg><div class="axis"><span>${esc(dayLabel(daily[0].day, false))}</span><span>tertinggi ${num(max)}/hari</span><span>${esc(dayLabel(daily[daily.length - 1].day, false))}</span></div>`;
}

const rangeHref = (from: string, to: string, extra = '') => `${STATS_PATH}?dari=${from}&amp;sampai=${to}${extra}`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<meta name="theme-color" content="#0c1014" />
<title>${esc(title)} | Cutless Hair Studio</title>
<link rel="icon" href="/favicon.ico" sizes="48x48" />
<style>${STYLE}</style>
</head>
<body><main>${body}</main></body>
</html>
`;
}

export function statsHtml(s: Stats): string {
  const quick: [string, string, string][] = [
    ['7 hari', addDays(s.today, -6), s.today],
    ['30 hari', addDays(s.today, -29), s.today],
    ['90 hari', addDays(s.today, -89), s.today],
    ['Bulan ini', `${s.today.slice(0, 8)}01`, s.today],
  ];
  const body = `
<p class="kicker">Cutless Hair Studio</p>
<h1>Statistik klik WhatsApp</h1>
<p class="muted">${esc(dayLabel(s.from))} – ${esc(dayLabel(s.to))} (WIB)</p>
<form method="get" action="${STATS_PATH}">
<label>Dari<input type="date" name="dari" value="${s.from}" max="${s.today}" required /></label>
<label>Sampai<input type="date" name="sampai" value="${s.to}" max="${s.today}" required /></label>
<button class="btn primary" type="submit">Terapkan</button>
<a class="btn" href="${rangeHref(s.from, s.to, '&amp;format=csv')}" download>Unduh CSV</a>
</form>
<nav class="quick" aria-label="Rentang cepat">${quick.map(([label, from, to]) => `<a href="${rangeHref(from, to)}"${from === s.from && to === s.to ? ' aria-current="true"' : ''}>${esc(label)}</a>`).join('')}</nav>
<div class="cards">
<div class="card"><b data-stat="last7">${num(s.last7)}</b><span>Klik 7 hari terakhir</span></div>
<div class="card"><b data-stat="last30">${num(s.last30)}</b><span>Klik 30 hari terakhir</span></div>
<div class="card"><b data-stat="total">${num(s.total)}</b><span>Klik di rentang ini</span></div>
</div>
<section aria-labelledby="t-harian"><h2 id="t-harian">Klik per hari</h2>${chart(s.daily)}</section>
<div class="grid">
${table('cabang', 'Per cabang', 'Cabang', s.byBranch, s.total)}
${table('jenis', 'Per jenis tombol', 'Jenis tombol', s.byKind, s.total)}
${table('kapster', 'Per kapster', 'Kapster', s.byBarber, s.total)}
${table('asal', 'Per asal kunjungan', 'Asal', s.bySource, s.total)}
${table('halaman', 'Per halaman asal', 'Halaman', s.byPage, s.total)}
</div>
<p class="note">Dihitung dari klik tombol WhatsApp di website (tanpa cookie & data pribadi). Klik dari browser dengan JavaScript mati atau pemblokir tidak terhitung. Angka hari ini masih bertambah.</p>`;
  return page('Statistik klik WhatsApp', body);
}

const HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  // Tanpa JavaScript: hanya gaya inline, font & ikon dari situs sendiri
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

const html = (status: number, body: string) => new Response(body, { status, headers: { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });

const message = (status: number, title: string, text: string) =>
  html(status, page(title, `<p class="kicker">Cutless Hair Studio</p><h1>${esc(title)}</h1><p class="muted">${esc(text)}</p>`));

export async function handleStats(request: Request, env: Env, options: { now?: number; accessFetcher?: (url: string) => Promise<Response> } = {}): Promise<Response> {
  if (!(await isAccessAllowed(request, env, { now: options.now, fetcher: options.accessFetcher }))) {
    return message(403, 'Akses ditolak', 'Halaman ini hanya untuk pemilik & staf. Buka lewat login Cloudflare Access (kode dari email).');
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { ...HEADERS, Allow: 'GET, HEAD' } });
  const url = new URL(request.url);
  if (url.pathname !== STATS_PATH) return Response.redirect(new URL(`${STATS_PATH}${url.search}`, url).toString(), 301);
  if (!env.DB) return message(503, 'Statistik belum aktif', 'Database cutless-analytics belum terhubung ke website (lihat docs/statistik-klik-wa.md).');
  const today = dayWIB(options.now ?? Date.now());
  const range = parseRange(url, today);
  const [records, allow] = await Promise.all([fetchClicks(env.DB, range.from, range.to), loadAllowlist(env, request.url, options.now)]);
  if (url.searchParams.get('format') === 'csv') {
    return new Response(statsCsv(records, allow), {
      headers: { ...HEADERS, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="klik-wa_${range.from}_${range.to}.csv"` },
    });
  }
  const recent = await fetchClicks(env.DB, addDays(today, -29), today);
  return html(200, statsHtml(summarize(records, recent, range, today, allow)));
}

import { dayWIB } from '../../src/content/waClicks';
import { isAccessAllowed } from '../access';
import type { Env } from '../env';
import { HEADERS, STYLE, dayLabel, esc } from '../stats';
import { loadReviewConfig } from './config';
import { getReview, listHistory, listQueue, skipReview, updateDraft, type ReviewRow } from './db';
import { createGbpClient, type GbpClient } from './gbp';
import { draftProblem, sendReply } from './reply';
import { isNewSince, queueTitle, summarizeQueue } from './summary';

/**
 * /ulasan/: antrean & riwayat balasan ulasan Google, dirender Worker (HTML tanpa JavaScript), hanya untuk pengguna
 * yang lolos Cloudflare Access (JWT diverifikasi di sini juga, pola /statistik/). noindex, tidak di sitemap/llms.txt.
 * Aksi (POST /ulasan/aksi): simpan draf, lewati, kirim. Kirim hanya lewat sendReply (reply.ts) dan hanya di mode Aktif.
 */

const PATH = '/ulasan/';
const ACTION_PATH = '/ulasan/aksi';
const COOKIE = 'ulasan_terakhir';
const MAX_BODY = 16 * 1024;

const MESSAGES: Record<string, string> = {
  tersimpan: 'Draf disimpan.',
  terkirim: 'Balasan terkirim ke Google.',
  dilewati: 'Ulasan dilewati.',
  mode: 'Balasan tidak dikirim: mode balasan ulasan belum Aktif (Uji atau Mati). Ubah di Pengaturan Situs bila sudah siap.',
  klien: 'Balasan tidak dikirim: koneksi ke Google belum aktif (akses API belum disetujui atau secret belum diisi).',
  'bukan-antrean': 'Ulasan ini sudah diproses atau tidak ada lagi di antrean.',
  'gagal-api': 'Google gagal menerima balasan. Ulasan ditandai Gagal; coba kirim lagi nanti.',
  draf: 'Draf kosong, lebih dari 4.096 karakter, atau masih berisi placeholder seperti {nama}.',
};

const REASON_CODE: Record<string, string> = {
  'tidak-ditemukan': 'bukan-antrean',
  'bukan-antrean': 'bukan-antrean',
  'tidak-boleh-otomatis': 'bukan-antrean',
  'draf-tidak-valid': 'draf',
  'gagal-api': 'gagal-api',
};

const STATUS_LABEL: Record<string, string> = { baru: 'Baru masuk', antre: 'Menunggu', gagal: 'Gagal kirim', terkirim: 'Terkirim', dilewati: 'Dilewati' };

const EXTRA_STYLE = `
.banner{border:1px solid var(--line);border-radius:4px;padding:.75rem 1rem;margin:0 0 1rem;background:var(--charcoal)}
.banner.warn{border-color:var(--sand)}
.notice{border-left:3px solid var(--wa);padding:.5rem .75rem;margin:0 0 1rem;background:var(--charcoal)}
.review{border:1px solid var(--line);border-radius:4px;padding:1rem;margin:0 0 1rem;background:var(--charcoal)}
.review header{display:flex;flex-wrap:wrap;gap:.25rem .75rem;align-items:baseline;margin:0 0 .5rem}
.stars{color:var(--sand);font-weight:700;letter-spacing:.05em}
.tag{font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--line);border-radius:999px;padding:.1rem .5rem}
.tag.new{background:var(--wa);color:var(--ink);border-color:var(--wa)}
blockquote{margin:.25rem 0 .75rem;padding-left:.75rem;border-left:2px solid var(--line);overflow-wrap:anywhere;white-space:pre-wrap}
textarea{width:100%;min-height:8rem;padding:.6rem .75rem;background:var(--ink);color:var(--bone);border:1px solid var(--line);border-radius:3px;font:inherit;resize:vertical}
.actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.5rem}
.actions .btn{flex:1 1 7rem;justify-content:center}
.reply{white-space:pre-wrap;overflow-wrap:anywhere;color:var(--dim)}
.cards .card b{font-size:1.6rem}
`;

const hashId = (id: string) => {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h.toString(16);
};
const anchor = (id: string) => `r-${hashId(id)}`;
const dateLabel = (iso: string) => dayLabel(dayWIB(Date.parse(iso)));
const stars = (n: number) => `<span class="stars" aria-label="Bintang ${n} dari 5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<meta name="theme-color" content="#0c1014" />
<title>${esc(title)}</title>
<link rel="icon" href="/favicon.ico" sizes="48x48" />
<style>${STYLE}${EXTRA_STYLE}</style>
</head>
<body><main>${body}</main></body>
</html>
`;
}

const html = (status: number, body: string, extra: Record<string, string> = {}) => new Response(body, { status, headers: { ...HEADERS, ...extra, 'Content-Type': 'text/html; charset=utf-8' } });
const message = (status: number, title: string, text: string) => html(status, layout(`${title} | Cutless Hair Studio`, `<p class="kicker">Cutless Hair Studio</p><h1>${esc(title)}</h1><p class="muted">${esc(text)}</p>`));
const redirect = (location: string, status = 303) => new Response(null, { status, headers: { ...HEADERS, Location: location } });

/** Email dari klaim JWT yang sudah diverifikasi; 'admin' bila tidak ada */
function accessEmail(request: Request): string {
  try {
    const payload = request.headers.get('Cf-Access-Jwt-Assertion')?.split('.')[1] ?? '';
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))) as { email?: unknown };
    return typeof data.email === 'string' && data.email.length <= 200 ? data.email : 'admin';
  } catch {
    return 'admin';
  }
}

const lastVisit = (request: Request): number | null => {
  const match = (request.headers.get('Cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d{1,15})(?:;|$)`));
  return match ? Number(match[1]) : null;
};

function reviewCard(r: ReviewRow, names: Record<string, string>, since: number | null): string {
  const waiting = r.status === 'antre' || r.status === 'baru' || r.status === 'gagal';
  const isNew = waiting && isNewSince(r.created_at, since);
  const head = `<header><strong>${esc(r.reviewer || 'Tanpa nama')}</strong>${stars(r.rating)}<span class="muted">${esc(names[r.branch] ?? r.branch)} · ${esc(dateLabel(r.reviewed_at))}</span><span class="tag">${esc(STATUS_LABEL[r.status] ?? r.status)}</span>${isNew ? '<span class="tag new">Baru</span>' : ''}</header>`;
  const text = r.body ? `<blockquote>${esc(r.body)}</blockquote>` : '<p class="muted">Bintang tanpa tulisan.</p>';
  const attrs = `class="review" id="${anchor(r.id)}" data-review data-status="${esc(r.status)}"${isNew ? ' data-new' : ''}`;
  if (!waiting) {
    const who = r.status === 'terkirim' ? (r.sent_auto ? 'Dikirim otomatis' : `Disetujui oleh ${esc(r.approved_by ?? 'admin')}${r.approved_at ? `, ${esc(dateLabel(r.approved_at))}` : ''}`) : '';
    return `<article ${attrs}>${head}${text}${r.draft ? `<p class="reply">${esc(r.draft)}</p>` : ''}${who ? `<p class="muted">${who}</p>` : ''}</article>`;
  }
  return `<article ${attrs}>${head}${text}<form method="post" action="${ACTION_PATH}"><input type="hidden" name="id" value="${esc(r.id)}" /><label>Draf balasan<textarea name="draf" maxlength="4096" required>${esc(r.draft)}</textarea></label><div class="actions"><button class="btn" type="submit" name="aksi" value="simpan">Simpan draf</button><button class="btn primary" type="submit" name="aksi" value="kirim">Kirim</button><button class="btn" type="submit" name="aksi" value="lewati">Lewati</button></div></form></article>`;
}

const MODE_BANNER: Record<string, string> = {
  Mati: '<div class="banner warn" data-mode="Mati"><strong>Mode Mati.</strong> Ulasan tidak diambil dan tidak ada balasan yang terkirim ke Google.</div>',
  Uji: '<div class="banner warn" data-mode="Uji"><strong>Mode Uji.</strong> Semua ulasan masuk antrean dan tidak ada balasan yang terkirim ke Google, termasuk tombol Kirim.</div>',
  Aktif: '<div class="banner" data-mode="Aktif"><strong>Mode Aktif.</strong> Bintang 5 tanpa kata keluhan dibalas otomatis; bintang 1–4 hanya terkirim setelah Anda menekan Kirim.</div>',
};

async function listPage(request: Request, env: Env, now: number, status = 200, code = ''): Promise<Response> {
  const db = env.REVIEWS_DB!;
  const config = await loadReviewConfig(env, now);
  const names = config?.branches ?? {};
  const since = lastVisit(request);
  const [summary, queue, history] = await Promise.all([summarizeQueue(db, names), listQueue(db), listHistory(db)]);
  const oldest = summary.oldest
    ? `<a href="#${anchor(summary.oldest.id)}">${esc(summary.oldest.branchName)}, bintang ${summary.oldest.rating}, ${esc(dateLabel(summary.oldest.reviewedAt))}</a>`
    : 'Tidak ada ulasan yang menunggu balasan.';
  const body = `
<p class="kicker">Cutless Hair Studio</p>
<h1>Balasan ulasan Google</h1>
${MODE_BANNER[config?.mode ?? 'Mati']}
${code && MESSAGES[code] ? `<p class="notice" role="status" data-notice="${esc(code)}">${esc(MESSAGES[code])}</p>` : ''}
<div class="cards">
<div class="card"><b data-summary="total">${summary.total}</b><span>Menunggu balasan</span></div>
${summary.perBranch.map((b) => `<div class="card" data-branch="${esc(b.branch)}"><b>${b.count}</b><span>${esc(b.name)}</span></div>`).join('')}
</div>
<p class="muted" data-summary="oldest">Tertua: ${oldest}</p>
<section aria-labelledby="t-antre"><h2 id="t-antre">Antrean (${summary.total})</h2>${queue.length ? queue.map((r) => reviewCard(r, names, since)).join('') : '<p class="empty">Tidak ada ulasan yang menunggu.</p>'}</section>
<section aria-labelledby="t-riwayat"><h2 id="t-riwayat">Riwayat</h2>${history.length ? history.map((r) => reviewCard(r, names, since)).join('') : '<p class="empty">Belum ada riwayat.</p>'}</section>
<p class="note">Ulasan baru juga masuk lewat notifikasi bawaan Google. Simpan halaman ini sebagai bookmark. Penanda Baru memakai cookie kunjungan terakhir di browser ini (tanpa data pribadi).</p>`;
  return html(status, layout(queueTitle(summary.total), body), { 'Set-Cookie': `${COOKIE}=${now}; Path=${PATH}; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax` });
}

async function handleAction(request: Request, env: Env, options: HandleOptions, now: number): Promise<Response> {
  const origin = new URL(request.url).origin;
  if (request.headers.get('Origin') !== origin) return message(403, 'Akses ditolak', 'Permintaan tidak berasal dari halaman ini.');
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY) return message(413, 'Terlalu besar', 'Isian terlalu besar.');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY) return message(413, 'Terlalu besar', 'Isian terlalu besar.');
  const form = new URLSearchParams(raw);
  const id = form.get('id') ?? '';
  const action = form.get('aksi') ?? '';
  const draft = (form.get('draf') ?? '').trim();
  if (!id || !['kirim', 'lewati', 'simpan'].includes(action)) return message(400, 'Permintaan tidak valid', 'Aksi atau ulasan tidak dikenal.');
  const db = env.REVIEWS_DB!;
  const to = (code: string) => redirect(`${PATH}?s=${code}#${anchor(id)}`);

  if (action === 'lewati') return to((await skipReview(db, id)) ? 'dilewati' : 'bukan-antrean');
  if (action === 'simpan') {
    if (draftProblem(draft)) return listPage(request, env, now, 422, 'draf');
    return to((await updateDraft(db, id, draft)) ? 'tersimpan' : 'bukan-antrean');
  }
  // kirim: hanya mode Aktif, hanya lewat sendReply
  if ((await loadReviewConfig(env, now))?.mode !== 'Aktif') return to('mode');
  const client = options.client === undefined ? createGbpClient(env, now) : options.client;
  if (!client) return to('klien');
  if (!(await getReview(db, id))) return to('bukan-antrean');
  const result = await sendReply(env, client, id, { kind: 'admin', email: accessEmail(request) }, now, draft || undefined);
  return to(result.ok ? 'terkirim' : (REASON_CODE[result.reason] ?? 'bukan-antrean'));
}

export interface HandleOptions {
  now?: number;
  accessFetcher?: (url: string) => Promise<Response>;
  /** Untuk tes: klien Google; null = tidak tersedia; tidak diisi = createGbpClient(env) */
  client?: GbpClient | null;
}

export async function handleReviews(request: Request, env: Env, options: HandleOptions = {}): Promise<Response> {
  if (!(await isAccessAllowed(request, env, { now: options.now, fetcher: options.accessFetcher }))) {
    return message(403, 'Akses ditolak', 'Halaman ini hanya untuk pemilik & staf. Buka lewat login Cloudflare Access (kode dari email).');
  }
  const url = new URL(request.url);
  const now = options.now ?? Date.now();
  if (url.pathname === '/ulasan') return redirect(`${PATH}${url.search}`, 301);
  if (url.pathname !== PATH && url.pathname !== ACTION_PATH) return message(404, 'Tidak ditemukan', 'Halaman tidak ada.');
  if (!env.REVIEWS_DB) return message(503, 'Balasan ulasan belum aktif', 'Database cutless-ulasan belum terhubung ke website (lihat docs/balasan-ulasan.md).');
  if (url.pathname === ACTION_PATH) {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...HEADERS, Allow: 'POST' } });
    return handleAction(request, env, options, now);
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { ...HEADERS, Allow: 'GET, HEAD' } });
  const code = url.searchParams.get('s') ?? '';
  return listPage(request, env, now, 200, code in MESSAGES ? code : '');
}

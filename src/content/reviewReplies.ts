/**
 * Balasan ulasan Google: aturan bersama skema konten (Pages CMS), build, dan Worker (worker/ulasan/). Murni, tanpa
 * DOM, tanpa Zod, tanpa akses jaringan/database.
 * Bintang 5 tanpa kata keluhan boleh dibalas otomatis (hanya mode Aktif); selebihnya selalu lewat persetujuan admin.
 */

export const REPLY_PLACEHOLDERS = ['nama', 'cabang', 'salam_waktu'] as const;
/** Batas panjang balasan di Google Business Profile */
export const REPLY_MAX_LENGTH = 4096;
export const TEMPLATE_MAX_LENGTH = 400;
/** Maksimal kalimat tambahan dari aturan kata kunci per balasan */
export const MAX_KEYWORD_SENTENCES = 2;
/** Batas nama pengulas yang dipakai balasan (Worker memotong di sini) dan nama cabang (branchSchema) */
export const REVIEWER_NAME_MAX = 100;
export const BRANCH_NAME_MAX = 60;
export const SENTENCE_MAX_LENGTH = 200;
/** Nama file konfigurasi hasil build yang dibaca Worker (lewat binding ASSETS) */
export const REVIEW_CONFIG_PATH = '/ulasan-config.json';

export type ReplyCategory = 'bintang5' | 'bintang4' | 'bintang3' | 'bintang12' | 'tanpaTeks';
export type ReplyMode = 'Mati' | 'Uji' | 'Aktif';

export interface ReplyTemplates {
  templates: Record<ReplyCategory, string[]>;
  keywordRules: { keyword: string; sentence: string }[];
  complaintWords: string[];
}

/** Dibuat saat build (scripts/vite-content-plugin.ts → dist/ulasan-config.json) */
export interface ReviewConfig {
  mode: ReplyMode;
  /** slug cabang → nama cabang */
  branches: Record<string, string>;
  reply: ReplyTemplates;
}

export interface ReviewInput {
  rating: number;
  text: string;
  reviewer: string;
  branchName: string;
}

export type SendDecision = 'kirim' | 'antre';

/** Nama placeholder di dalam {…} yang tidak ada di REPLY_PLACEHOLDERS (peka huruf besar-kecil) */
export function findUnknownPlaceholders(text: string): string[] {
  const known: readonly string[] = REPLY_PLACEHOLDERS;
  return [...text.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]).filter((name) => !known.includes(name));
}

/** Satu kali jalan: nilai yang berisi "{…}" tidak diproses ulang */
export function fillPlaceholders(template: string, values: { nama: string; cabang: string; salam_waktu: string }): string {
  return template.replace(/\{(nama|cabang|salam_waktu)\}/g, (_, name: keyof typeof values) => values[name]);
}

/** Salam menurut jam WIB (UTC+7): 04–10 pagi, 11–14 siang, 15–17 sore, selain itu malam */
export function greetingFor(now: number): 'Selamat pagi' | 'Selamat siang' | 'Selamat sore' | 'Selamat malam' {
  const hour = new Date(now + 7 * 3_600_000).getUTCHours();
  if (hour >= 4 && hour <= 10) return 'Selamat pagi';
  if (hour >= 11 && hour <= 14) return 'Selamat siang';
  if (hour >= 15 && hour <= 17) return 'Selamat sore';
  return 'Selamat malam';
}

/** Bintang 1–2 selalu bintang12; bintang 3–5 tanpa teks memakai tanpaTeks */
export function categoryFor(rating: number, text: string): ReplyCategory {
  if (rating <= 2) return 'bintang12';
  if (!text.trim()) return 'tanpaTeks';
  return rating >= 5 ? 'bintang5' : rating === 4 ? 'bintang4' : 'bintang3';
}

/** Kata keluhan dicocokkan sebagai substring, tanpa peduli huruf kapital */
export function hasComplaint(text: string, complaintWords: string[]): boolean {
  const lower = text.toLowerCase();
  return complaintWords.some((w) => w.trim() && lower.includes(w.trim().toLowerCase()));
}

/** Template acak dari kategori + kalimat tambahan aturan kata kunci, dipotong ke batas Google */
export function buildDraft(review: ReviewInput, cfg: ReplyTemplates, now: number, pick: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  const options = cfg.templates[categoryFor(review.rating, review.text)];
  const values = { nama: review.reviewer.trim() || 'kak', cabang: review.branchName, salam_waktu: greetingFor(now) };
  const lower = review.text.toLowerCase();
  const extra = cfg.keywordRules
    .filter((r) => r.keyword.trim() && lower.includes(r.keyword.trim().toLowerCase()))
    .slice(0, MAX_KEYWORD_SENTENCES)
    .map((r) => r.sentence);
  return [options[pick(options.length)], ...extra].map((t) => fillPlaceholders(t, values)).join(' ').slice(0, REPLY_MAX_LENGTH);
}

/** 'kirim' hanya bila mode Aktif, bintang 5, dan tanpa kata keluhan. Satu-satunya pintu kirim otomatis. */
export function decideAction(input: { mode: ReplyMode; rating: number; text: string }, complaintWords: string[]): SendDecision {
  return input.mode === 'Aktif' && input.rating === 5 && !hasComplaint(input.text, complaintWords) ? 'kirim' : 'antre';
}

/** Panjang terburuk satu balasan: variasi terpanjang setelah diisi + kalimat tambahan terpanjang + spasi. Dipakai build. */
export function worstCaseLength(cfg: ReplyTemplates): number {
  const worst = (text: string) => fillPlaceholders(text, { nama: 'n'.repeat(REVIEWER_NAME_MAX), cabang: 'c'.repeat(BRANCH_NAME_MAX), salam_waktu: 'Selamat malam' }).length;
  const templates = Object.values(cfg.templates).flat().map(worst);
  const sentences = cfg.keywordRules.map((r) => worst(r.sentence)).sort((a, b) => b - a).slice(0, MAX_KEYWORD_SENTENCES);
  return Math.max(0, ...templates) + sentences.reduce((sum, n) => sum + n + 1, 0);
}

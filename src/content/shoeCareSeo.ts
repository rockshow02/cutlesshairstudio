/**
 * Halaman /cuci-sepatu/ untuk build (prerender, sitemap, redirect): tanpa alias "@/" & tanpa Zod agar bisa dipakai
 * plugin (scripts/vite-content-plugin.ts) dan tes. Logika tampil sama dengan buildShoeCare (src/lib/contentTransforms.ts).
 */
import type { BranchEntry, ShoeCareEntry } from './schema';
import { fitDescription, META_MAX } from './serviceSeo';

export const SHOE_CARE_PATH = '/cuci-sepatu/';

const text = (v: string | null | undefined) => (v ?? '').trim();
const activeServices = (p: ShoeCareEntry) => (p.services ?? []).filter((s) => s.isActive !== false);

/** Halaman aktif: "Tampilkan halaman" menyala, cabangnya ada, dan minimal satu layanan tampil */
export function shoeCareVisible(p: ShoeCareEntry | null | undefined, branches: Pick<BranchEntry, 'slug'>[]): boolean {
  return Boolean(p?.enabled && branches.some((b) => b.slug === p.branchSlug) && activeServices(p).length > 0);
}

/** <title>: "Cuci Sepatu [nama partner] di Cutless [cabang]" */
export const shoeCareTitle = (p: ShoeCareEntry, branchName: string) => `Cuci Sepatu ${p.name} di Cutless ${branchName}`;

/** Meta description: tagline + nama layanan, maks. 160 karakter */
export function shoeCareDescription(p: ShoeCareEntry, branchName: string): string {
  const names = activeServices(p)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => s.name.trim());
  const tagline = text(p.tagline);
  const prefix = `${tagline ? `${tagline.replace(/[.!?]?$/, '.')} ` : `Cuci sepatu ${p.name} di Cutless ${branchName}. `}Layanan: `;
  return fitDescription(prefix, names, '.', META_MAX);
}

/** Gambar Open Graph & hero: Foto hero → foto hasil pertama → foto CTA penutup */
export function shoeCareImage(p: ShoeCareEntry, fallback: string): string {
  return text(p.heroImage) || text(p.photos?.[0]?.image) || fallback;
}

/** Halaman mati → /cuci-sepatu (dengan/tanpa garis miring) dialihkan 301 ke beranda (format public/_redirects) */
export function shoeCareRedirects(visible: boolean): string[] {
  return visible ? [] : ['/cuci-sepatu    /   301', '/cuci-sepatu/*  /   301'];
}

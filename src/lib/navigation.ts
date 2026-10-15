import type { NavItem } from '@/types';

/**
 * Navigasi multi-halaman (situs statis, tanpa router):
 * - Halaman utama  : "/"        → menu section memakai anchor "#harga"
 * - Halaman produk : "/produk/" → menu section kembali ke "/#harga"
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Path situs → URL (mendukung deploy di sub-folder) */
export const pageUrl = (path: string): string => `${BASE}/${path.replace(/^\//, '')}`;

export function isHomePage(): boolean {
  if (typeof window === 'undefined') return true;
  const path = window.location.pathname.replace(BASE, '') || '/';
  return path === '/' || path === '/index.html';
}

/** Link ke section di halaman utama, dari halaman mana pun */
export const sectionHref = (sectionId: string): string => (isHomePage() ? `#${sectionId}` : `${pageUrl('/')}#${sectionId}`);

export function navHref(item: NavItem): string {
  if (item.href) return pageUrl(item.href);
  return sectionHref(item.sectionId ?? 'top');
}

/** Item menu untuk halaman yang sedang dibuka (mis. "Produk" saat di /produk/) */
export function isCurrentPage(item: NavItem): boolean {
  if (!item.href || typeof window === 'undefined') return false;
  return window.location.pathname.replace(BASE, '').startsWith(item.href.replace(/\/$/, ''));
}

/** Kunci React stabil untuk item menu */
export const navKey = (item: NavItem): string => item.sectionId ?? item.href ?? item.label;

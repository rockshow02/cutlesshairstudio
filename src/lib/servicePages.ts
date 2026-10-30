/**
 * Data halaman layanan di browser (tanpa server): ringkasan halaman terbit dari modul virtual:layanan (dibangkitkan
 * saat build oleh scripts/vite-content-plugin.ts, kosong bila Tampilkan halaman layanan mati), dan isi halaman yang
 * sedang dibuka dari <script id="service-page"> di HTML halaman itu. Harga dihitung dari Daftar Harga (pricing.json).
 */
import pages from 'virtual:layanan';
import pricingJson from '@/content/pricing.json';
import branchesJson from '@/content/branches.json';
import type { BranchEntry, PricingEntry } from '@/content/schema';
import { pageByPricingItem, pageByServiceCard, servicePagePath, type ServicePage, type ServicePageSummary } from '@/content/servicePages';

export const pricingEntries = pricingJson as unknown as PricingEntry[];
export const branchEntries = branchesJson as unknown as BranchEntry[];

/** Halaman layanan terbit (kosong bila dimatikan) */
export const getServicePages = (): ServicePageSummary[] => pages;

/** Halaman ini (/layanan/<slug>/); undefined di /layanan/ / slug tidak dikenal */
export function getCurrentServicePage(): ServicePage | undefined {
  const el = typeof document === 'undefined' ? null : document.getElementById('service-page');
  if (!el?.textContent) return undefined;
  try {
    return JSON.parse(el.textContent) as ServicePage;
  } catch {
    return undefined;
  }
}

const byItem = pageByPricingItem(pages);
const byCard = pageByServiceCard(pages);

/** Link "Selengkapnya" baris Daftar Harga (nama item); undefined = tanpa halaman terbit */
export const servicePageForItem = (name: string): string | undefined => {
  const slug = byItem.get(name);
  return slug ? servicePagePath(slug) : undefined;
};

/** Link "Selengkapnya" Kartu Layanan (nama kartu); undefined = tanpa halaman terbit */
export const servicePageForCard = (name: string): string | undefined => {
  const slug = byCard.get(name);
  return slug ? servicePagePath(slug) : undefined;
};

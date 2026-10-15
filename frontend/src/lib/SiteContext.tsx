import { createContext, useContext, type ReactNode } from 'react';
import type { SiteContent, SocialLink } from '@/types';

interface SiteContextValue {
  site: SiteContent;
  socials: SocialLink[];
}

const SiteContext = createContext<SiteContextValue | null>(null);

export function SiteProvider({ value, children }: { value: SiteContextValue; children: ReactNode }) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

/** Konfigurasi global situs (brand, WhatsApp, label UI, sosial media). */
export function useSite(): SiteContextValue {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite harus dipakai di dalam <SiteProvider>.');
  return ctx;
}

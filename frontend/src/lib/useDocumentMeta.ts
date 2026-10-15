import { useEffect } from 'react';
import type { SeoConfig } from '@/types';
import { asset } from './asset';

function setMeta(selector: string, attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

/**
 * Sinkronkan title & meta dengan konten (berguna saat konten datang dari CMS).
 * Nilai awal tetap ditulis statis di index.html untuk crawler & preview link.
 */
export function useDocumentMeta(seo: SeoConfig | undefined) {
  useEffect(() => {
    if (!seo) return;
    document.title = seo.title;
    setMeta('meta[name="description"]', 'name', 'description', seo.description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', seo.title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', seo.description);
    setMeta('meta[property="og:locale"]', 'property', 'og:locale', seo.locale);
    const ogImage = /^https?:/.test(seo.ogImage) ? seo.ogImage : new URL(asset(seo.ogImage), seo.url).href;
    setMeta('meta[property="og:image"]', 'property', 'og:image', ogImage);
  }, [seo]);
}

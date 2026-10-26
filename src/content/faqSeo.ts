import type { FaqEntry } from './schema';

/**
 * FAQ (Pages CMS → FAQ) untuk tampilan, HTML statis beranda, JSON-LD FAQPage, dan /llms.txt: sumber yang sama agar
 * isinya selalu identik. Tanpa import runtime (dipakai plugin build).
 */
export interface FaqItem {
  question: string;
  answer: string;
}

/** Item yang tampil: Tampilkan FAQ aktif, item aktif, berjawaban; urut "Urutan". Kosong = bagian tidak dirender. */
export function activeFaqItems(faq: FaqEntry | null | undefined): FaqItem[] {
  if (!faq?.enabled) return [];
  return [...(faq.items ?? [])]
    .filter((i) => i.isActive !== false && i.answer?.trim())
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((i) => ({ question: i.question.trim(), answer: i.answer!.trim() }));
}

/** JSON-LD FAQPage (https://schema.org/FAQPage); null bila tidak ada item yang tampil */
export function faqPageJsonLd(faq: FaqEntry | null | undefined, pageUrl: string) {
  const items = activeFaqItems(faq);
  if (!items.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    url: pageUrl,
    mainEntity: items.map((i) => ({ '@type': 'Question', name: i.question, acceptedAnswer: { '@type': 'Answer', text: i.answer } })),
  };
}

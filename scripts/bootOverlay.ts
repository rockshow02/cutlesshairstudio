/**
 * Overlay statis penutup ringkasan prerender (`.prerender`, teks polos berfont sistem yang sempat terlihat sebelum React
 * mengganti #root). HTML + CSS kritis inline, tanpa JavaScript untuk tampil: position fixed, latar & logo sama dengan
 * Preloader React (src/components/motion/Preloader.tsx) supaya serah-terimanya tidak berkedip. Bar & hitungan hanya
 * penjaga tata letak (tersembunyi, tanpa teks) agar logo sejajar dengan Preloader React.
 *
 * Pengaman tanpa JS: overlay memudar sendiri lewat animasi CSS setelah BOOT_FALLBACK_SECONDS sehingga teks prerender tetap
 * terbaca. "Kurangi gerakan": tanpa fade, hanya langkah visibility. Teks prerender, <noscript>, dan <main> tidak disentuh.
 * Dipasang pada semua template halaman (index.html, cabang/, tips/, layanan/, kabar/, produk/, cuci-sepatu/,
 * kebijakan-privasi/), sehingga semua halaman prerender memilikinya. Mati bila enablePreloader = false.
 */
import { BOOT_FALLBACK_SECONDS, BOOT_OVERLAY_ID } from '../src/lib/bootOverlayConst';

export interface BootOverlayOptions {
  enabled: boolean;
  /** Logo (mark) yang sama dengan Preloader React (site.logo.mark) */
  mark: { src: string; width: number; height: number };
}

/** Pengaturan Situs → Tampilkan animasi pembuka (bawaan aktif) */
export const bootOverlayEnabled = (settings: { enablePreloader?: boolean }): boolean => settings.enablePreloader !== false;

// Nilai mengikuti Preloader React (motion.module.css) & tokens.css: --c-ink, --z-preloader, --space-4, --fs-xs, line-height body
const CSS = [
  `#${BOOT_OVERLAY_ID}{position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:#0c1014;pointer-events:none;animation:bo-out .4s ease ${BOOT_FALLBACK_SECONDS}s forwards}`,
  `#${BOOT_OVERLAY_ID}[data-leave]{opacity:0;transition:opacity .25s ease}`,
  `#${BOOT_OVERLAY_ID} .bo-in{display:flex;flex-direction:column;align-items:center;gap:1rem}`,
  `#${BOOT_OVERLAY_ID} .bo-mask{display:block;overflow:hidden;padding-bottom:.08em;margin-bottom:-.08em}`,
  `#${BOOT_OVERLAY_ID} .bo-mark{display:block;width:72px;height:auto}`,
  `#${BOOT_OVERLAY_ID} .bo-bar{display:block;width:96px;height:2px}`,
  `#${BOOT_OVERLAY_ID} .bo-count{display:block;height:1.2375rem}`,
  '@keyframes bo-out{to{opacity:0;visibility:hidden}}',
  `@media (prefers-reduced-motion:reduce){#${BOOT_OVERLAY_ID}{animation:bo-end 0s linear ${BOOT_FALLBACK_SECONDS}s forwards}#${BOOT_OVERLAY_ID}[data-leave]{transition:none}}`,
  '@keyframes bo-end{to{visibility:hidden}}',
].join('');

/** Sisipkan CSS kritis + preload logo di <head> dan overlay di awal <body>. Idempoten; mati/tanpa penanda → HTML apa adanya. */
export function withBootOverlay(html: string, { enabled, mark }: BootOverlayOptions): string {
  if (!enabled || html.includes(`id="${BOOT_OVERLAY_ID}"`) || !html.includes('</head>') || !/<body[^>]*>/.test(html)) return html;
  const head = `    <style id="${BOOT_OVERLAY_ID}-css">${CSS}</style>\n    <link rel="preload" as="image" href="${mark.src}" />\n  </head>`;
  const overlay =
    `<div id="${BOOT_OVERLAY_ID}" aria-hidden="true"><div class="bo-in"><span class="bo-mask">` +
    `<img class="bo-mark" src="${mark.src}" width="${mark.width}" height="${mark.height}" alt="" />` +
    '</span><span class="bo-bar"></span><span class="bo-count"></span></div></div>';
  return html.replace('</head>', () => head).replace(/<body([^>]*)>/, (_m, attrs: string) => `<body${attrs}>\n    ${overlay}`);
}

import type { SVGProps } from 'react';
import type { IconName } from '@/types';

type IconDef = { fill?: boolean; body: JSX.Element };

const ICONS: Record<IconName, IconDef> = {
  whatsapp: {
    fill: true,
    body: (
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.59-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.37l-.36-.22-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.41z" />
    ),
  },
  tiktok: {
    fill: true,
    body: (
      <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    ),
  },
  google: {
    fill: true,
    body: (
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.19-1.79 4.13-1.15 1.15-2.93 2.4-6.05 2.4-4.83 0-8.6-3.89-8.6-8.72s3.77-8.72 8.6-8.72c2.6 0 4.51 1.03 5.91 2.35l2.31-2.31C18.75 1.44 16.13 0 12.48 0 5.87 0 .31 5.39.31 12s5.56 12 12.17 12c3.57 0 6.27-1.17 8.37-3.36 2.16-2.16 2.84-5.21 2.84-7.67 0-.76-.05-1.47-.17-2.05H12.48z" />
    ),
  },
  star: { fill: true, body: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" /> },
  instagram: {
    body: (
      <>
        <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.6" cy="6.4" r=".9" fill="currentColor" stroke="none" />
      </>
    ),
  },
  arrow: { body: <path d="M5 12h14M13 6l6 6-6 6" /> },
  pin: {
    body: (
      <>
        <path d="M20 10c0 6.5-8 12-8 12S4 16.5 4 10a8 8 0 0 1 16 0z" />
        <circle cx="12" cy="10" r="2.8" />
      </>
    ),
  },
  clock: {
    body: (
      <>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 6.5V12l3.5 2" />
      </>
    ),
  },
  navigate: { body: <path d="M3 11l19-9-9 19-2-8z" /> },
  mail: {
    body: (
      <>
        <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
        <path d="M22 6.5l-10 7-10-7" />
      </>
    ),
  },
  check: { body: <path d="M20 6L9 17l-5-5" /> },
  info: {
    body: (
      <>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 11v5.5M12 7.5h.01" />
      </>
    ),
  },
  alert: {
    body: (
      <>
        <path d="M10.3 3.9L2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        <path d="M12 9v4.5M12 17h.01" />
      </>
    ),
  },
  play: { fill: true, body: <path d="M7 4.5v15l12.5-7.5z" /> },
  pause: { fill: true, body: <path d="M6.5 4.5h4v15h-4zm7 0h4v15h-4z" /> },
  tag: {
    body: (
      <>
        <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
        <circle cx="7.5" cy="7.5" r="1.2" />
      </>
    ),
  },
  menu: { body: <path d="M4 7h16M4 12h16M4 17h16" /> },
  close: { body: <path d="M6 6l12 12M18 6L6 18" /> },
  'chevron-left': { body: <path d="M15 5l-7 7 7 7" /> },
  'chevron-right': { body: <path d="M9 5l7 7-7 7" /> },
  // Ikon aplikasi booking & admin
  calendar: { body: <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4" /> },
  user: { body: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" /> },
  filter: { body: <path d="M4 6h16M7 12h10M10 18h4" /> },
  logout: { body: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" /> },
  search: { body: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.35-4.35" /> },
  plus: { body: <path d="M12 5v14M5 12h14" /> },
  gift: { body: <path d="M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM3 7h18v4H3zM12 7v14M12 7S10.5 3 8 3a2 2 0 0 0 0 4M12 7s1.5-4 4-4a2 2 0 0 1 0 4" /> },
  scissors: {
    body: (
      <>
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
      </>
    ),
  },
  wash: {
    body: (
      <>
        <path d="M12 2.7l5.66 5.66a8 8 0 1 1-11.32 0z" />
        <path d="M9 14.5a3 3 0 0 0 3 3" />
      </>
    ),
  },
  kids: {
    body: (
      <>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M8 14s1.5 2.2 4 2.2 4-2.2 4-2.2M9 9.5h.01M15 9.5h.01" />
      </>
    ),
  },
  shave: { body: <path d="M2.5 8.5h12.5l2.5 4H2.5zM17.5 12.5l4 6.5M5 12.5v-1.5" /> },
  color: {
    body: (
      <>
        <path d="M12 2.5a9.5 9.5 0 1 0 0 19c1.1 0 1.6-.8 1.6-1.6 0-.9-.6-1.3-.6-2.1 0-.9.7-1.5 1.6-1.5h2.3a4.6 4.6 0 0 0 4.6-4.6c0-5.1-4.3-9.2-9.5-9.2z" />
        <circle cx="7.5" cy="11.5" r="1" />
        <circle cx="9.5" cy="7" r="1" />
        <circle cx="14.5" cy="7" r="1" />
      </>
    ),
  },
  perm: { body: <path d="M3 7c3-3 6 3 9 0s6 3 9 0M3 12c3-3 6 3 9 0s6 3 9 0M3 17c3-3 6 3 9 0s6 3 9 0" /> },
  spa: {
    body: (
      <>
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z" />
        <path d="M2 21c0-3 1.9-5.4 5.1-6 2.4-.5 4.9-2 5.9-3" />
      </>
    ),
  },
  tattoo: { body: <path d="M3 19c5-1 7-5 9-9s4-6 9-6M3 13c3-1 5-3.5 6.5-7M11 21c4-1 7.5-3.5 10-8" /> },
  // Halaman Partner
  store: { body: <path d="M3.5 9.5L5 4h14l1.5 5.5M3.5 9.5a2.8 2.8 0 0 0 5.6 0 2.9 2.9 0 0 0 5.8 0 2.8 2.8 0 0 0 5.6 0M5 11.5V20h14v-8.5M9.5 20v-5h5v5" /> },
  handshake: { body: <path d="M2.5 12l3-6.5 4 1.5 2.5-1 3.5 1.5 3-1.5 3 6.5-2.5 1.5M2.5 12l2.5 1.5M12 6l-3.5 3.5a1.5 1.5 0 0 0 2.1 2.1L12.5 10l5 4.5a1.4 1.4 0 0 1-2 2l-1-1M5 13.5l3.5 3.5a1.4 1.4 0 0 0 2-2M10.5 15l1.5 1.5a1.4 1.4 0 0 0 2-2" /> },
  briefcase: { body: <path d="M4 7.5h16a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1zM9 7.5V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18M10.5 13v1.5h3V13" /> },
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

/** Ikon SVG inline (pengganti Font Awesome 5.0.6 bawaan template yang tidak punya TikTok). Dekoratif secara default. */
export function Icon({ name, size = 18, strokeWidth = 1.6, ...rest }: IconProps) {
  const def = ICONS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill={def.fill ? 'currentColor' : 'none'}
      stroke={def.fill ? 'none' : 'currentColor'}
      strokeWidth={def.fill ? undefined : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {def.body}
    </svg>
  );
}

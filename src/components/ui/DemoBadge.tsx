import { SHOW_DEMO_BADGE } from '@/lib/demo';
import styles from './DemoBadge.module.css';

/** Badge "DEMO" untuk isian bertanda "Data demo" di Pages CMS. Tidak ikut ke build produksi. */
export function DemoBadge({ show, className }: { show: boolean | undefined; className?: string }) {
  if (!SHOW_DEMO_BADGE || !show) return null;
  return <span className={[styles.badge, className].filter(Boolean).join(' ')}>Demo</span>;
}

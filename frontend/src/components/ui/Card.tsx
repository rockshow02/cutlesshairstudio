import type { ElementType, ReactNode } from 'react';
import styles from './Card.module.css';

export type CardTone = 'dark' | 'light' | 'featured' | 'plain';

interface CardProps {
  as?: ElementType;
  tone?: CardTone;
  className?: string;
  children: ReactNode;
}

/**
 * Permukaan kartu. Selalu flex-column + height 100% sehingga kartu dalam satu baris grid
 * rata tinggi dan bagian <CardFooter> menempel di bawah walau teks panjang.
 */
export function Card({ as: Tag = 'article', tone = 'dark', className, children }: CardProps) {
  return <Tag className={[styles.card, styles[tone], className].filter(Boolean).join(' ')}>{children}</Tag>;
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={[styles.footer, className].filter(Boolean).join(' ')}>{children}</div>;
}

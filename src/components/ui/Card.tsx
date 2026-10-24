import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

/** outline = kartu aplikasi (booking/admin): border tipis, tanpa bayangan & tanpa efek terangkat */
export type CardTone = 'dark' | 'light' | 'featured' | 'plain' | 'outline';

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'> {
  as?: ElementType;
  /** Untuk as="form" */
  noValidate?: boolean;
  tone?: CardTone;
  /** Hanya untuk tone outline: sm 16 px, md 24 px (default), lg 32 px */
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
  children: ReactNode;
}

/**
 * Permukaan kartu. Selalu flex-column + height 100% sehingga kartu dalam satu baris grid
 * rata tinggi dan bagian <CardFooter> menempel di bawah walau teks panjang.
 */
export function Card({ as: Tag = 'article', tone = 'dark', padding, className, children, ...rest }: CardProps) {
  const pad = tone === 'outline' && padding ? styles[`pad-${padding}`] : undefined;
  return (
    <Tag className={[styles.card, styles[tone], pad, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  );
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={[styles.footer, className].filter(Boolean).join(' ')}>{children}</div>;
}

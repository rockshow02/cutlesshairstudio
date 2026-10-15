import type { CSSProperties, ElementType, ReactNode } from 'react';
import styles from './Container.module.css';

interface ContainerProps {
  as?: ElementType;
  className?: string;
  /** Lebar penuh dengan gutter saja (untuk navbar) */
  fluid?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}

export function Container({ as: Tag = 'div', className, fluid, style, children }: ContainerProps) {
  const cls = [styles.container, fluid && styles.fluid, className].filter(Boolean).join(' ');
  return (
    <Tag className={cls} style={style}>
      {children}
    </Tag>
  );
}

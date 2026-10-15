import type { CSSProperties, ElementType, ReactNode } from 'react';
import { useReveal } from '@/lib/useReveal';

interface RevealProps {
  as?: ElementType;
  className?: string;
  /** Delay dalam detik */
  delay?: number;
  children: ReactNode;
}

/** Bungkus elemen agar muncul halus saat di-scroll. */
export function Reveal({ as: Tag = 'div', className, delay = 0, children }: RevealProps) {
  const ref = useReveal<HTMLElement>();
  const style = delay ? ({ '--reveal-delay': `${delay}s` } as CSSProperties) : undefined;
  return (
    <Tag ref={ref} className={className} style={style} data-reveal="out">
      {children}
    </Tag>
  );
}

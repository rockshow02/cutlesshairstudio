import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import type { IconName } from '@/types';
import { Icon } from './Icon';
import styles from './Button.module.css';

export type ButtonVariant = 'light' | 'ghost' | 'dark' | 'outline-dark' | 'whatsapp';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Ikon di kanan teks (mis. panah) */
  iconEnd?: IconName;
  block?: boolean;
  className?: string;
  children: ReactNode;
}

type LinkProps = BaseProps & { href: string; external?: boolean } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'>;
type NativeButtonProps = BaseProps & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

export type ButtonProps = LinkProps | NativeButtonProps;

/** Tombol/tautan bergaya brand. Render <a> bila ada href, selain itu <button>. */
export function Button(props: ButtonProps) {
  const { variant = 'light', size = 'md', icon, iconEnd, block, className, children } = props;
  const cls = [styles.btn, styles[variant], styles[size], block && styles.block, className].filter(Boolean).join(' ');
  const content = (
    <>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      <span className={styles.label}>{children}</span>
      {iconEnd && <Icon name={iconEnd} size={16} className={styles.iconEnd} />}
    </>
  );

  if (props.href !== undefined) {
    const { variant: _v, size: _s, icon: _i, iconEnd: _ie, block: _b, className: _c, children: _ch, external, ...anchor } = props;
    return (
      <a className={cls} {...anchor} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {content}
      </a>
    );
  }

  const { variant: _v, size: _s, icon: _i, iconEnd: _ie, block: _b, className: _c, children: _ch, href: _h, type = 'button', ...button } = props;
  return (
    <button className={cls} type={type} {...button}>
      {content}
    </button>
  );
}

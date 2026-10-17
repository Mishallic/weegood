import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'wouter';
import { cx } from '../lib/cx';

interface ChipProps {
  children: ReactNode;
  pressed?: boolean;
  hue?: number;
  onClick?: () => void;
  href?: string;
}

/** A pill. With `onClick` it toggles (aria-pressed); with `href` it navigates. */
export function Chip({ children, pressed, hue, onClick, href }: ChipProps) {
  const style = hue === undefined ? undefined : ({ '--hue': hue } as CSSProperties);
  const className = cx('chip', hue !== undefined && 'chip--hue');
  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

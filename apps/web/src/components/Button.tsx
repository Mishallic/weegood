import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Icon-only button. `label` becomes the accessible name. */
  iconOnly?: boolean;
  label?: string;
  active?: boolean;
}

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  iconOnly = false,
  label,
  active = false,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;
  return (
    <button
      type={type}
      className={cx(
        'btn',
        variant !== 'default' && `btn--${variant}`,
        size !== 'md' && `btn--${size}`,
        iconOnly && 'btn--icon',
        active && 'btn--active',
        className,
      )}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      {...rest}
    >
      {icon && <Icon name={icon} size={iconSize} />}
      {!iconOnly && children}
    </button>
  );
}

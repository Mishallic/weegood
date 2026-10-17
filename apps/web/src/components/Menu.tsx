import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Icon, type IconName } from './Icon';

interface MenuProps {
  /** Renders the trigger. Spread `triggerProps` onto a button. */
  trigger: (triggerProps: {
    onClick: () => void;
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
    'aria-controls': string;
  }) => ReactNode;
  children: (helpers: { close: () => void }) => ReactNode;
  direction?: 'down' | 'up';
}

/** A minimal dropdown. Closes on outside click and Escape. */
export function Menu({ trigger, children, direction = 'down' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="menu-anchor" ref={ref}>
      {trigger({
        onClick: () => setOpen((value) => !value),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': id,
      })}
      {open && (
        <div
          id={id}
          role="menu"
          className={cx('menu', 'menu--right', direction === 'up' && 'menu--up')}
          onClick={(event) => event.stopPropagation()}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  icon?: IconName;
  onSelect: () => void;
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

export function MenuItem({ icon, onSelect, children, danger, disabled }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cx('menu__item', danger && 'menu__item--danger')}
      onClick={onSelect}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="menu__label">{children}</div>;
}

export function MenuSeparator() {
  return <div className="menu__separator" role="separator" />;
}

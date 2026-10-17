import type { CSSProperties } from 'react';
import { cx } from '../lib/cx';
import { Icon } from './Icon';

interface CoverProps {
  title: string;
  hue: number;
  size?: number | string;
  playing?: boolean;
  paused?: boolean;
  className?: string;
}

/** Generated cover art: a gradient from a stable hue and the first letter of the title. */
export function Cover({ title, hue, size = 48, playing, paused, className }: CoverProps) {
  const style = {
    '--hue': hue,
    '--size': typeof size === 'number' ? `${size}px` : size,
  } as CSSProperties;
  const active = playing || paused;
  return (
    <span className={cx('cover', active && 'cover--playing', className)} style={style} aria-hidden>
      {active ? (
        <span
          className={cx('eq', paused && 'eq--paused')}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <span />
          <span />
          <span />
        </span>
      ) : title.trim() ? (
        title.trim()[0]?.toUpperCase()
      ) : (
        <Icon name="music" />
      )}
    </span>
  );
}

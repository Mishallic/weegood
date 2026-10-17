import type { CSSProperties } from 'react';
import { cx } from '../lib/cx';
import { Icon } from './Icon';

interface CoverProps {
  title: string;
  hue: number;
  /** Artwork URL. Falls back to a generated gradient with the first letter. */
  src?: string | null | undefined;
  size?: number | string;
  playing?: boolean;
  paused?: boolean;
  className?: string;
}

export function Cover({ title, hue, src, size = 48, playing, paused, className }: CoverProps) {
  const style = {
    '--hue': hue,
    '--size': typeof size === 'number' ? `${size}px` : size,
  } as CSSProperties;
  const active = playing || paused;
  return (
    <span className={cx('cover', active && 'cover--playing', className)} style={style} aria-hidden>
      {src && <img className="cover__img" src={src} alt="" loading="lazy" decoding="async" />}
      {active ? (
        <span
          className={cx('eq', paused && 'eq--paused')}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <span />
          <span />
          <span />
        </span>
      ) : src ? null : title.trim() ? (
        title.trim()[0]?.toUpperCase()
      ) : (
        <Icon name="music" />
      )}
    </span>
  );
}

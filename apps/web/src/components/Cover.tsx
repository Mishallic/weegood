import type { VibeVector } from '@weegood/core';
import type { CSSProperties } from 'react';
import { cx } from '../lib/cx';
import { coverGradient } from '../lib/vibeGradient';
import { Icon } from './Icon';

interface CoverProps {
  title: string;
  hue: number;
  /** Artwork URL. Without one the cover is a typographic sleeve coloured by the vibe. */
  src?: string | null | undefined;
  vibe?: VibeVector | undefined;
  size?: number | string;
  playing?: boolean;
  paused?: boolean;
  className?: string;
}

export function Cover({
  title,
  hue,
  src,
  vibe,
  size = 48,
  playing,
  paused,
  className,
}: CoverProps) {
  const style = {
    '--hue': hue,
    '--size': typeof size === 'number' ? `${size}px` : size,
    ...(vibe && !src ? { background: coverGradient(vibe) } : {}),
  } as CSSProperties;
  const active = playing || paused;
  return (
    <span className={cx('cover', active && 'cover--playing', className)} style={style} aria-hidden>
      {src && <img className="cover__img" src={src} alt="" loading="lazy" decoding="async" />}
      {active ? (
        <span className={cx('eq', paused && 'eq--paused')}>
          <span />
          <span />
          <span />
        </span>
      ) : src ? null : title.trim() ? (
        <span className="cover__letter">{title.trim()[0]?.toUpperCase()}</span>
      ) : (
        <Icon name="music" />
      )}
    </span>
  );
}

import type { VibeVector } from '@weegood/core';
import { useState, type CSSProperties } from 'react';
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
  // Artwork that fails to load falls back to the typographic sleeve instead of a broken-image icon.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const art = src && src !== failedSrc ? src : null;
  const style = {
    '--hue': hue,
    '--size': typeof size === 'number' ? `${size}px` : size,
    ...(vibe && !art ? { background: coverGradient(vibe) } : {}),
  } as CSSProperties;
  const active = playing || paused;
  return (
    <span className={cx('cover', active && 'cover--playing', className)} style={style} aria-hidden>
      {art && (
        <img
          className="cover__img"
          src={art}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(art)}
        />
      )}
      {active ? (
        <span className={cx('eq', paused && 'eq--paused')}>
          <span />
          <span />
          <span />
        </span>
      ) : art ? null : title.trim() ? (
        <span className="cover__letter">{title.trim()[0]?.toUpperCase()}</span>
      ) : (
        <Icon name="music" />
      )}
    </span>
  );
}

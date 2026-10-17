import type { CSSProperties } from 'react';

interface AvatarProps {
  name: string;
  hue: number;
  src?: string | null | undefined;
  size?: number;
}

export function Avatar({ name, hue, src, size = 40 }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="avatar"
      style={{ '--hue': hue, '--size': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      {src ? (
        <img className="avatar__img" src={src} alt="" loading="lazy" decoding="async" />
      ) : (
        initials
      )}
    </span>
  );
}

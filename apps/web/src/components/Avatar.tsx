import type { CSSProperties } from 'react';

export function Avatar({ name, hue, size = 40 }: { name: string; hue: number; size?: number }) {
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
      {initials}
    </span>
  );
}

import { usePlayer } from '../app/storesContext';
import { cx } from '../lib/cx';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string | undefined;
}

function Disc({ delay }: { delay: string }) {
  return (
    <svg
      className="logo__disc"
      style={{ animationDelay: delay }}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="16" cy="16" r="15.5" fill="currentColor" />
      <circle
        cx="16"
        cy="16"
        r="12.5"
        fill="none"
        stroke="var(--logo-bg, var(--bg))"
        strokeOpacity="0.22"
        strokeWidth="1"
      />
      <circle
        cx="16"
        cy="16"
        r="10"
        fill="none"
        stroke="var(--logo-bg, var(--bg))"
        strokeOpacity="0.16"
        strokeWidth="1"
      />
      <circle cx="16" cy="16" r="6" fill="var(--accent)" />
      <circle cx="16" cy="16" r="1.5" fill="var(--logo-bg, var(--bg))" />
    </svg>
  );
}

/**
 * The wordmark: "weegood" with the two o's as records. They spin while music plays, which is the
 * whole personality of the thing in one glance.
 */
export function Logo({ size = 'md', className }: LogoProps) {
  const playing = usePlayer((state) => state.status === 'playing');
  return (
    <span
      className={cx('logo', `logo--${size}`, playing && 'logo--spinning', className)}
      aria-label="Weegood"
    >
      <span aria-hidden="true">weeg</span>
      <Disc delay="0s" />
      <Disc delay="-1.3s" />
      <span aria-hidden="true">d</span>
    </span>
  );
}

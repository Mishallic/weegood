import type { VibeVector } from '@weegood/core';
import { cx } from '../lib/cx';
import { vibeGradient } from '../lib/vibeGradient';

interface VibeAuraProps {
  vibe: VibeVector;
  /** `vibe-aura--page` fixes it behind a whole screen instead of one hero. */
  className?: string | undefined;
}

/** A blurred field of the vibe's colours, placed behind a hero or a page. Decorative only. */
export function VibeAura({ vibe, className }: VibeAuraProps) {
  return (
    <div
      className={cx('vibe-aura', className)}
      style={{ background: vibeGradient(vibe) }}
      aria-hidden="true"
    />
  );
}

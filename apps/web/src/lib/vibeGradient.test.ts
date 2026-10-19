import { NEUTRAL_VIBE, vibe } from '@weegood/core';
import { describe, expect, it } from 'vitest';
import { coverGradient, vibeColors, vibeGradient } from './vibeGradient';

describe('vibeColors', () => {
  it('moves from cool to warm as valence rises', () => {
    const [sad] = vibeColors(vibe({ valence: 0 }));
    const [neutral] = vibeColors(vibe({ valence: 0.5 }));
    const [happy] = vibeColors(vibe({ valence: 1 }));
    expect(sad.h).toBe(236);
    expect(neutral.h).toBeGreaterThan(290);
    expect(neutral.h).toBeLessThan(320);
    expect(happy.h).toBe(18);
  });

  it('saturates and deepens with energy', () => {
    const [calm] = vibeColors(vibe({ energy: 0.1 }));
    const [loud] = vibeColors(vibe({ energy: 0.95 }));
    expect(loud.s).toBeGreaterThan(calm.s);
    expect(loud.l).toBeLessThan(calm.l);
  });

  it('washes warm for acoustic material and dark for electronic', () => {
    const [, , warm] = vibeColors(vibe({ acousticness: 0.9 }));
    const [, , dark] = vibeColors(vibe({ acousticness: 0.1 }));
    expect(warm.l).toBeGreaterThan(dark.l);
    expect(warm.h).toBe(38);
  });
});

describe('gradients', () => {
  it('are deterministic CSS strings', () => {
    expect(coverGradient(NEUTRAL_VIBE)).toBe(coverGradient(NEUTRAL_VIBE));
    expect(coverGradient(NEUTRAL_VIBE)).toMatch(/^linear-gradient\(145deg, hsl\(/);
    expect(vibeGradient(NEUTRAL_VIBE).split('radial-gradient').length - 1).toBe(3);
    expect(vibeGradient(vibe({ valence: 1 }))).not.toBe(vibeGradient(vibe({ valence: 0 })));
  });
});

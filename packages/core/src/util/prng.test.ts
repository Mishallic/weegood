import { describe, expect, it } from 'vitest';
import { createRng, hashString } from './prng';

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng('weegood');
    const b = createRng('weegood');
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    expect(createRng('a').next()).not.toBe(createRng('b').next());
  });

  it('keeps int() inside the inclusive bounds', () => {
    const rng = createRng(42);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const n = rng.int(3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
      seen.add(n);
    }
    expect(seen.size).toBe(4);
  });

  it('shuffles into a permutation without mutating the input', () => {
    const rng = createRng('shuffle');
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = rng.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((x, y) => x - y)).toEqual(input);
  });

  it('refuses to pick from an empty list', () => {
    expect(() => createRng(1).pick([])).toThrow();
  });
});

describe('hashString', () => {
  it('is stable and spreads nearby inputs apart', () => {
    expect(hashString('track:paper-lanterns')).toBe(hashString('track:paper-lanterns'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});

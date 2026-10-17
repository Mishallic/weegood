/**
 * Deterministic pseudo-random numbers.
 *
 * The demo catalog, playlist seeding and tests all need "random" values that are identical on
 * every platform and every run. Math.random cannot promise that; mulberry32 can, in ten lines.
 */

/** FNV-1a 32-bit hash of a string, returned as an unsigned integer. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** One item, uniformly. Throws on an empty list. */
  pick<T>(items: readonly T[]): T;
  /** A shuffled copy (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[];
}

/** Create a seeded generator. Same seed, same sequence, everywhere. */
export function createRng(seed: string | number): Rng {
  let state = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 0x9e3779b9;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    range(min, max) {
      return min + next() * (max - min);
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('Cannot pick from an empty list');
      const index = Math.floor(next() * items.length);
      return items[index] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const a = out[i] as T;
        out[i] = out[j] as T;
        out[j] = a;
      }
      return out;
    },
  };
}

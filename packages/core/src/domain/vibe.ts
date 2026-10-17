/**
 * A vibe vector is Weegood's compact description of how a piece of music feels: six dimensions,
 * each normalised to 0..1. Tracks, artists, genres, moods and the listener's taste profile all
 * live in the same space, which is what makes "similar vibe" a single distance. See ADR 0005.
 */
export const VIBE_DIMENSIONS = [
  'energy',
  'valence',
  'danceability',
  'acousticness',
  'instrumentalness',
  'tempo',
] as const;

export type VibeDimension = (typeof VIBE_DIMENSIONS)[number];

export type VibeVector = Readonly<Record<VibeDimension, number>>;

export const NEUTRAL_VIBE: VibeVector = Object.freeze({
  energy: 0.5,
  valence: 0.5,
  danceability: 0.5,
  acousticness: 0.5,
  instrumentalness: 0.5,
  tempo: 0.5,
});

/** Distance between opposite corners of the unit hypercube. */
const MAX_DISTANCE = Math.sqrt(VIBE_DIMENSIONS.length);

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Build a vibe from a partial description. Missing dimensions are neutral, values are clamped. */
export function vibe(partial: Partial<VibeVector> = {}): VibeVector {
  const out: Record<VibeDimension, number> = { ...NEUTRAL_VIBE };
  for (const dim of VIBE_DIMENSIONS) {
    const value = partial[dim];
    if (value !== undefined) out[dim] = clamp01(value);
  }
  return out;
}

/** Runtime check used when importing data from outside (JSON import, future sync). */
export function isVibeVector(value: unknown): value is VibeVector {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return VIBE_DIMENSIONS.every((dim) => {
    const n = record[dim];
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
  });
}

export function mapVibe(
  a: VibeVector,
  fn: (value: number, dim: VibeDimension) => number,
): VibeVector {
  const out: Record<VibeDimension, number> = { ...NEUTRAL_VIBE };
  for (const dim of VIBE_DIMENSIONS) out[dim] = clamp01(fn(a[dim], dim));
  return out;
}

export function euclideanDistance(a: VibeVector, b: VibeVector): number {
  let sum = 0;
  for (const dim of VIBE_DIMENSIONS) {
    const d = a[dim] - b[dim];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Similarity in 0..1: 1 for identical vibes, 0 for opposite corners of the space.
 * Normalised distance rather than cosine, because two vibes that differ only in intensity
 * (say, a calm and a frantic version of the same shape) should not count as identical.
 */
export function vibeSimilarity(a: VibeVector, b: VibeVector): number {
  return clamp01(1 - euclideanDistance(a, b) / MAX_DISTANCE);
}

/** Linear interpolation from `a` toward `b`. `weightB` of 0 returns `a`, 1 returns `b`. */
export function blend(a: VibeVector, b: VibeVector, weightB: number): VibeVector {
  const w = clamp01(weightB);
  return mapVibe(a, (value, dim) => value * (1 - w) + b[dim] * w);
}

/** Push `a` away from `b` by `rate` of their difference. Used for skips and dislikes. */
export function moveAway(a: VibeVector, b: VibeVector, rate: number): VibeVector {
  const r = clamp01(rate);
  return mapVibe(a, (value, dim) => value + (value - b[dim]) * r);
}

/** Apply a partial vibe as a nudge: only the given dimensions move, by `weight`. */
export function nudge(a: VibeVector, toward: Partial<VibeVector>, weight: number): VibeVector {
  const w = clamp01(weight);
  return mapVibe(a, (value, dim) => {
    const target = toward[dim];
    return target === undefined ? value : value * (1 - w) + clamp01(target) * w;
  });
}

/** Weighted centroid. An empty list yields the neutral vibe. */
export function centroid(items: ReadonlyArray<{ vibe: VibeVector; weight?: number }>): VibeVector {
  let total = 0;
  const sums: Record<VibeDimension, number> = {
    energy: 0,
    valence: 0,
    danceability: 0,
    acousticness: 0,
    instrumentalness: 0,
    tempo: 0,
  };
  for (const item of items) {
    const w = item.weight ?? 1;
    if (w <= 0) continue;
    total += w;
    for (const dim of VIBE_DIMENSIONS) sums[dim] += item.vibe[dim] * w;
  }
  if (total === 0) return NEUTRAL_VIBE;
  return mapVibe(sums, (value) => value / total);
}

/** Random offset of up to +-amount per dimension, using the supplied generator. */
export function jitterVibe(a: VibeVector, amount: number, random: () => number): VibeVector {
  return mapVibe(a, (value) => value + (random() * 2 - 1) * amount);
}

export const BPM_RANGE = Object.freeze({ min: 60, max: 180 });

export function tempoToBpm(tempo: number): number {
  return Math.round(BPM_RANGE.min + clamp01(tempo) * (BPM_RANGE.max - BPM_RANGE.min));
}

export function bpmToTempo(bpm: number): number {
  return clamp01((bpm - BPM_RANGE.min) / (BPM_RANGE.max - BPM_RANGE.min));
}

const DIMENSION_WORDS: Record<VibeDimension, { low: string; high: string }> = {
  energy: { low: 'mellow', high: 'high-energy' },
  valence: { low: 'moody', high: 'upbeat' },
  danceability: { low: 'free-flowing', high: 'danceable' },
  acousticness: { low: 'electronic', high: 'acoustic' },
  instrumentalness: { low: 'vocal-led', high: 'instrumental' },
  tempo: { low: 'slow', high: 'fast' },
};

/**
 * Plain words for a vibe, most distinctive first: ["mellow", "acoustic"]. Dimensions close to
 * neutral are not mentioned. A vibe with nothing distinctive is simply "balanced".
 */
export function describeVibe(a: VibeVector, count = 2, threshold = 0.15): string[] {
  const ranked = VIBE_DIMENSIONS.map((dim) => ({ dim, delta: a[dim] - 0.5 }))
    .filter(({ delta }) => Math.abs(delta) >= threshold)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, Math.max(0, count));
  if (ranked.length === 0) return ['balanced'];
  return ranked.map(({ dim, delta }) =>
    delta > 0 ? DIMENSION_WORDS[dim].high : DIMENSION_WORDS[dim].low,
  );
}

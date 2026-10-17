import { describe, expect, it } from 'vitest';
import {
  blend,
  bpmToTempo,
  centroid,
  describeVibe,
  euclideanDistance,
  isVibeVector,
  moveAway,
  NEUTRAL_VIBE,
  nudge,
  tempoToBpm,
  vibe,
  vibeSimilarity,
} from './vibe';

const ZERO = vibe({
  energy: 0,
  valence: 0,
  danceability: 0,
  acousticness: 0,
  instrumentalness: 0,
  tempo: 0,
});
const ONE = vibe({
  energy: 1,
  valence: 1,
  danceability: 1,
  acousticness: 1,
  instrumentalness: 1,
  tempo: 1,
});

describe('vibe()', () => {
  it('fills missing dimensions with neutral values', () => {
    const v = vibe({ energy: 0.9 });
    expect(v.energy).toBe(0.9);
    expect(v.valence).toBe(0.5);
    expect(v.tempo).toBe(0.5);
  });

  it('clamps out-of-range values', () => {
    const v = vibe({ energy: 1.7, valence: -3, tempo: Number.NaN });
    expect(v.energy).toBe(1);
    expect(v.valence).toBe(0);
    expect(v.tempo).toBe(0);
  });
});

describe('isVibeVector', () => {
  it('accepts a complete vector within range', () => {
    expect(isVibeVector(NEUTRAL_VIBE)).toBe(true);
  });

  it('rejects missing or out-of-range dimensions', () => {
    expect(isVibeVector({ ...NEUTRAL_VIBE, tempo: 1.2 })).toBe(false);
    expect(isVibeVector({ energy: 0.5 })).toBe(false);
    expect(isVibeVector(null)).toBe(false);
  });
});

describe('vibeSimilarity', () => {
  it('is 1 for identical vibes and 0 for opposite corners', () => {
    expect(vibeSimilarity(NEUTRAL_VIBE, NEUTRAL_VIBE)).toBe(1);
    expect(vibeSimilarity(ZERO, ONE)).toBeCloseTo(0, 10);
  });

  it('is symmetric and falls as distance grows', () => {
    const near = vibe({ energy: 0.6 });
    const far = vibe({ energy: 0.95, tempo: 0.9 });
    expect(vibeSimilarity(NEUTRAL_VIBE, near)).toBeCloseTo(vibeSimilarity(near, NEUTRAL_VIBE));
    expect(vibeSimilarity(NEUTRAL_VIBE, near)).toBeGreaterThan(vibeSimilarity(NEUTRAL_VIBE, far));
    expect(euclideanDistance(NEUTRAL_VIBE, near)).toBeCloseTo(0.1);
  });
});

describe('blend, moveAway, nudge', () => {
  it('blend interpolates between its endpoints', () => {
    expect(blend(ZERO, ONE, 0)).toEqual(ZERO);
    expect(blend(ZERO, ONE, 1)).toEqual(ONE);
    expect(blend(ZERO, ONE, 0.25).energy).toBeCloseTo(0.25);
  });

  it('moveAway pushes in the opposite direction and clamps', () => {
    const a = vibe({ energy: 0.4 });
    const b = vibe({ energy: 0.8 });
    expect(moveAway(a, b, 0.5).energy).toBeCloseTo(0.2);
    expect(moveAway(ZERO, ONE, 1)).toEqual(ZERO);
  });

  it('nudge only touches the given dimensions', () => {
    const out = nudge(NEUTRAL_VIBE, { tempo: 1 }, 0.5);
    expect(out.tempo).toBeCloseTo(0.75);
    expect(out.energy).toBe(0.5);
  });
});

describe('centroid', () => {
  it('weights its inputs', () => {
    const out = centroid([
      { vibe: ZERO, weight: 1 },
      { vibe: ONE, weight: 3 },
    ]);
    expect(out.energy).toBeCloseTo(0.75);
  });

  it('returns neutral for an empty list', () => {
    expect(centroid([])).toEqual(NEUTRAL_VIBE);
  });
});

describe('describeVibe', () => {
  it('names the most distinctive dimensions first', () => {
    const words = describeVibe(vibe({ energy: 0.1, acousticness: 0.8, tempo: 0.55 }));
    expect(words).toEqual(['mellow', 'acoustic']);
  });

  it('calls a neutral vibe balanced', () => {
    expect(describeVibe(NEUTRAL_VIBE)).toEqual(['balanced']);
  });
});

describe('tempo and bpm', () => {
  it('round-trips across the supported range', () => {
    expect(tempoToBpm(0)).toBe(60);
    expect(tempoToBpm(1)).toBe(180);
    expect(bpmToTempo(tempoToBpm(0.5))).toBeCloseTo(0.5);
  });
});

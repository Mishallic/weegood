import { describe, expect, it } from 'vitest';
import { genreById } from '../catalog/genres';
import { NEUTRAL_VIBE } from '../domain/vibe';
import { normalizeBpm, popularityFromEngagement, priorVibeForTrack } from './vibePrior';

describe('priorVibeForTrack', () => {
  it('starts from the genre centre and bends toward the mood', () => {
    const base = { genreIds: ['metal'], mood: null, tags: [], bpm: null, musicalKey: null };
    const plain = priorVibeForTrack(base);
    const sad = priorVibeForTrack({ ...base, mood: 'Melancholy' });
    expect(plain.energy).toBeCloseTo(genreById('metal')?.vibe.energy ?? 0);
    expect(sad.valence).toBeLessThan(plain.valence);
    expect(sad.energy).toBeLessThan(plain.energy);
  });

  it('is neutral when the genre is unknown', () => {
    const v = priorVibeForTrack({
      genreIds: [],
      mood: null,
      tags: [],
      bpm: null,
      musicalKey: null,
    });
    expect(v).toEqual(NEUTRAL_VIBE);
  });

  it('reads tags, bpm and key', () => {
    const v = priorVibeForTrack({
      genreIds: ['hip-hop'],
      mood: null,
      tags: ['Instrumental', ' type beat '],
      bpm: 280,
      musicalKey: 'F minor',
    });
    const plain = priorVibeForTrack({
      genreIds: ['hip-hop'],
      mood: null,
      tags: [],
      bpm: null,
      musicalKey: null,
    });
    expect(v.instrumentalness).toBeGreaterThan(plain.instrumentalness);
    expect(v.tempo).toBeCloseTo((140 - 60) / 120);
    expect(v.valence).toBeCloseTo(plain.valence - 0.1);
  });
});

describe('normalizeBpm', () => {
  it('folds octaves into 60..180 and rejects garbage', () => {
    expect(normalizeBpm(45)).toBe(90);
    expect(normalizeBpm(280)).toBe(140);
    expect(normalizeBpm(128)).toBe(128);
    expect(normalizeBpm(0)).toBeNull();
    expect(normalizeBpm(null)).toBeNull();
    expect(normalizeBpm(Number.NaN)).toBeNull();
  });
});

describe('popularityFromEngagement', () => {
  it('grows with plays and saturates', () => {
    expect(popularityFromEngagement(0)).toBe(0);
    expect(popularityFromEngagement(1000)).toBeCloseTo(0.5, 1);
    expect(popularityFromEngagement(5_000_000)).toBe(1);
    expect(popularityFromEngagement(100, 50)).toBeGreaterThan(popularityFromEngagement(100));
  });
});

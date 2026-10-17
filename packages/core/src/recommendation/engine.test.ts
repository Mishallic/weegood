import { describe, expect, it } from 'vitest';
import { createCatalogIndex } from '../catalog/catalogIndex';
import { DEMO_CATALOG } from '../catalog/seed';
import type { Follow, ListenEvent, Recommendation, Track } from '../domain/types';
import { vibeSimilarity } from '../domain/vibe';
import {
  recommendArtists,
  recommendTracks,
  similarTracks,
  type RecommendationInput,
  WEIGHTS,
} from './engine';
import { createEmptyProfile, createProfileFromOnboarding } from './tasteProfile';

const index = createCatalogIndex(DEMO_CATALOG);
const NOW = 1_800_000_000_000;

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    profile: createEmptyProfile(NOW),
    tracks: DEMO_CATALOG.tracks,
    artistsById: index.artistsById,
    genresById: index.genresById,
    follows: [],
    recentListens: [],
    now: NOW,
    ...overrides,
  };
}

function track(id: string): Track {
  const found = index.tracksById.get(id);
  if (!found) throw new Error(`missing track ${id}`);
  return found;
}

function meanPairwiseSimilarity(items: Recommendation[]): number {
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (!a || !b) continue;
      total += vibeSimilarity(a.track.vibe, b.track.vibe);
      pairs++;
    }
  }
  return pairs === 0 ? 0 : total / pairs;
}

describe('recommendTracks', () => {
  it('returns at most the limit, with unique tracks, bounded scores and a reason each', () => {
    const results = recommendTracks(input(), { limit: 12 });
    expect(results.length).toBe(12);
    expect(new Set(results.map((r) => r.track.id)).size).toBe(12);
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
      expect(r.reasons.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same input', () => {
    const a = recommendTracks(input(), { limit: 10 });
    const b = recommendTracks(input(), { limit: 10 });
    expect(a.map((r) => r.track.id)).toEqual(b.map((r) => r.track.id));
  });

  it('caps tracks per artist', () => {
    const results = recommendTracks(input(), { limit: 20, maxPerArtist: 1 });
    const artists = results.map((r) => r.track.artistId);
    expect(new Set(artists).size).toBe(artists.length);
  });

  it('never recommends liked or disliked tracks', () => {
    const profile = {
      ...createEmptyProfile(NOW),
      likedTrackIds: ['lux-marlowe-1'],
      dislikedTrackIds: ['lux-marlowe-2'],
    };
    const ids = recommendTracks(input({ profile }), { limit: 96, maxPerArtist: 99 }).map(
      (r) => r.track.id,
    );
    expect(ids).not.toContain('lux-marlowe-1');
    expect(ids).not.toContain('lux-marlowe-2');
    expect(ids.length).toBe(94);
  });

  it('boosts followed artists and says so', () => {
    const follows: Follow[] = [{ kind: 'artist', targetId: 'kessler-grid', createdAt: NOW }];
    const opts = { limit: 96, maxPerArtist: 99, diversity: 0 };
    const plain = recommendTracks(input(), opts).find((r) => r.track.id === 'kessler-grid-1');
    const boosted = recommendTracks(input({ follows }), opts).find(
      (r) => r.track.id === 'kessler-grid-1',
    );
    if (!plain || !boosted) throw new Error('track missing from results');
    expect(boosted.score).toBeCloseTo(plain.score + WEIGHTS.followArtist, 6);
    expect(boosted.reasons[0]).toBe('Because you follow Kessler Grid');
  });

  it('penalises tracks played today and skipped tracks', () => {
    const opts = { limit: 96, maxPerArtist: 99, diversity: 0 };
    const played: ListenEvent = {
      trackId: 'juno-ward-1',
      startedAt: NOW - 3_600_000,
      msPlayed: 180_000,
      durationMs: 180_000,
      completed: true,
      skipped: false,
    };
    const skipped: ListenEvent = {
      ...played,
      trackId: 'juno-ward-2',
      completed: false,
      skipped: true,
    };
    const base = recommendTracks(input(), opts);
    const after = recommendTracks(input({ recentListens: [played, skipped] }), opts);
    const find = (list: Recommendation[], id: string) => list.find((r) => r.track.id === id)?.score;
    expect(find(after, 'juno-ward-1')).toBeCloseTo(
      (find(base, 'juno-ward-1') ?? 0) - WEIGHTS.playedToday,
      6,
    );
    expect(find(after, 'juno-ward-2')).toBeCloseTo(
      (find(base, 'juno-ward-2') ?? 0) - WEIGHTS.playedToday - WEIGHTS.skippedRecently,
      6,
    );
  });

  it('can exclude everything already listened to', () => {
    const listened: ListenEvent = {
      trackId: 'honeyglass-3',
      startedAt: NOW - 1000,
      msPlayed: 1000,
      durationMs: 200_000,
      completed: false,
      skipped: false,
    };
    const ids = recommendTracks(input({ recentListens: [listened] }), {
      limit: 96,
      maxPerArtist: 99,
      excludeListened: true,
    }).map((r) => r.track.id);
    expect(ids).not.toContain('honeyglass-3');
    expect(ids.length).toBe(95);
  });

  it('spreads results out when diversity is high', () => {
    const profile = createProfileFromOnboarding(
      { genreIds: ['techno', 'house'], moodIds: ['hype'], artistIds: [], context: 'party' },
      DEMO_CATALOG,
      NOW,
    );
    const focused = recommendTracks(input({ profile }), {
      limit: 8,
      diversity: 0,
      maxPerArtist: 99,
    });
    const spread = recommendTracks(input({ profile }), {
      limit: 8,
      diversity: 0.9,
      maxPerArtist: 99,
    });
    expect(meanPairwiseSimilarity(spread)).toBeLessThan(meanPairwiseSimilarity(focused));
  });

  it("explains vibe matches in the listener's own terms", () => {
    const profile = createProfileFromOnboarding(
      { genreIds: ['ambient'], moodIds: ['chill', 'dreamy'], artistIds: [], context: 'relax' },
      DEMO_CATALOG,
      NOW,
    );
    const [top] = recommendTracks(input({ profile }), { limit: 1 });
    expect(top?.reasons.join(' ')).toMatch(/You're into Ambient|Matches your .* vibe/);
  });
});

describe('similarTracks', () => {
  it('finds tracks closer to the seed than the catalog average, excluding the seed', () => {
    const seed = track('glacier-mail-1');
    const results = similarTracks(seed, input(), 8);
    expect(results.length).toBe(8);
    expect(results.map((r) => r.track.id)).not.toContain(seed.id);
    const resultMean =
      results.reduce((sum, r) => sum + vibeSimilarity(seed.vibe, r.track.vibe), 0) / results.length;
    const poolMean =
      DEMO_CATALOG.tracks.reduce((sum, t) => sum + vibeSimilarity(seed.vibe, t.vibe), 0) /
      DEMO_CATALOG.tracks.length;
    expect(resultMean).toBeGreaterThan(poolMean);
    expect(results[0]?.reasons[0]).toBe(`Similar to "${seed.title}"`);
  });
});

describe('recommendArtists', () => {
  it('skips followed artists and returns ranked, explained suggestions', () => {
    const follows: Follow[] = [{ kind: 'artist', targetId: 'lux-marlowe', createdAt: NOW }];
    const profile = createProfileFromOnboarding(
      { genreIds: ['pop'], moodIds: ['feel-good'], artistIds: [], context: 'party' },
      DEMO_CATALOG,
      NOW,
    );
    const results = recommendArtists(input({ profile, follows }), DEMO_CATALOG.artists, 5);
    expect(results.length).toBe(5);
    expect(results.map((r) => r.artist.id)).not.toContain('lux-marlowe');
    expect(results[0]?.artist.genreIds).toContain('pop');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]?.score ?? 0).toBeGreaterThanOrEqual(results[i]?.score ?? 0);
    }
    expect(results[0]?.reasons.length).toBeGreaterThan(0);
  });
});

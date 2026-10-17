import { describe, expect, it } from 'vitest';
import { createCatalogIndex } from '../catalog/catalogIndex';
import { DEMO_CATALOG } from '../catalog/seed';
import type { Follow, ListenEvent, Recommendation, Track } from '../domain/types';
import { vibeSimilarity } from '../domain/vibe';
import {
  featuresForTrack,
  rankAll,
  recommendArtists,
  recommendTracks,
  similarTracks,
  type RecommendationInput,
} from './engine';
import { createRanker, PRIOR_WEIGHTS, RANK_FEATURES } from './ranker';
import { createEmptyProfile, createProfileFromOnboarding } from './tasteProfile';

const index = createCatalogIndex(DEMO_CATALOG);
const NOW = 1_800_000_000_000;

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    profile: createEmptyProfile(NOW),
    tracks: DEMO_CATALOG.tracks,
    artistsById: index.artistsById,
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

function scoreOf(list: Recommendation[], id: string): number {
  const found = list.find((r) => r.track.id === id);
  if (!found) throw new Error(`${id} missing from results`);
  return found.score;
}

const EVERYTHING = { limit: 96, maxPerArtist: 99, diversity: 0 };

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

  it('never recommends disliked tracks and hides liked ones from discovery', () => {
    const profile = {
      ...createEmptyProfile(NOW),
      likedTrackIds: ['lux-marlowe-1'],
      dislikedTrackIds: ['lux-marlowe-2'],
    };
    const ids = recommendTracks(input({ profile }), EVERYTHING).map((r) => r.track.id);
    expect(ids).not.toContain('lux-marlowe-1');
    expect(ids).not.toContain('lux-marlowe-2');
    expect(ids.length).toBe(94);

    const everything = rankAll(input({ profile })).map((r) => r.track.id);
    expect(everything).toContain('lux-marlowe-1');
    expect(everything).not.toContain('lux-marlowe-2');
    expect(everything.length).toBe(95);
  });

  it('boosts followed artists and says so', () => {
    const follows: Follow[] = [{ kind: 'artist', targetId: 'kessler-grid', createdAt: NOW }];
    const plain = recommendTracks(input(), EVERYTHING);
    const boosted = recommendTracks(input({ follows }), EVERYTHING);
    expect(scoreOf(boosted, 'kessler-grid-1')).toBeGreaterThan(scoreOf(plain, 'kessler-grid-1'));
    const reasons = boosted.find((r) => r.track.id === 'kessler-grid-1')?.reasons ?? [];
    expect(reasons).toContain('Because you follow Kessler Grid');
  });

  it('penalises tracks played today, and skipped ones harder', () => {
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
    const base = recommendTracks(input(), EVERYTHING);
    const after = recommendTracks(input({ recentListens: [played, skipped] }), EVERYTHING);
    expect(scoreOf(after, 'juno-ward-1')).toBeLessThan(scoreOf(base, 'juno-ward-1'));
    expect(scoreOf(after, 'juno-ward-2')).toBeLessThan(scoreOf(after, 'juno-ward-1'));
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
      ...EVERYTHING,
      excludeListened: true,
    }).map((r) => r.track.id);
    expect(ids).not.toContain('honeyglass-3');
    expect(ids.length).toBe(95);
  });

  it('spreads results out when diversity is high', () => {
    const profile = createProfileFromOnboarding(
      { genreIds: ['techno', 'house'], moodIds: ['hype'], artistIds: [], context: 'party' },
      { artists: DEMO_CATALOG.artists },
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

  it('rewards tracks in moods the listener chose and explains it', () => {
    const profile = { ...createEmptyProfile(NOW), moodWeights: { Melancholy: 1 } };
    const melancholy = DEMO_CATALOG.tracks.find((t) => t.mood === 'Melancholy');
    if (!melancholy) throw new Error('fixture has no melancholy track');
    const features = featuresForTrack(melancholy, input({ profile }));
    expect(features.mood).toBe(1);
    const result = recommendTracks(input({ profile }), EVERYTHING).find(
      (r) => r.track.id === melancholy.id,
    );
    expect(result?.reasons).toContain('Fits your melancholy mood');
  });

  it('calls out popularity when it carries the pick', () => {
    const popular = DEMO_CATALOG.tracks.reduce((best, t) =>
      t.popularity > best.popularity ? t : best,
    );
    const results = recommendTracks(input(), EVERYTHING);
    const reasons = results.find((r) => r.track.id === popular.id)?.reasons ?? [];
    expect(reasons.some((reason) => reason.startsWith('Trending'))).toBe(true);
  });

  it('follows the learned ranker: a popularity-obsessed model puts the most played track first', () => {
    const ranker = { ...createRanker(), weights: { ...PRIOR_WEIGHTS, vibe: 0, popularity: 6 } };
    const profile = { ...createEmptyProfile(NOW), ranker };
    const [top] = recommendTracks(input({ profile }), EVERYTHING);
    const mostPlayed = DEMO_CATALOG.tracks.reduce((best, t) =>
      t.popularity > best.popularity ? t : best,
    );
    expect(top?.track.id).toBe(mostPlayed.id);
  });

  it('produces a complete feature vector in 0..1', () => {
    const features = featuresForTrack(track('imani-rowe-1'), input());
    for (const name of RANK_FEATURES) {
      expect(features[name]).toBeGreaterThanOrEqual(0);
      expect(features[name]).toBeLessThanOrEqual(1);
    }
    expect(features.novelty).toBe(1);
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
      { artists: DEMO_CATALOG.artists },
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

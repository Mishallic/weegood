import { describe, expect, it } from 'vitest';
import { createCatalogIndex } from '../catalog/catalogIndex';
import { DEMO_CATALOG } from '../catalog/seed';
import type { ListenEvent, OnboardingAnswers, Track } from '../domain/types';
import { vibeSimilarity } from '../domain/vibe';
import {
  applyFollowSignal,
  applyListen,
  classifyListen,
  createEmptyProfile,
  createProfileFromOnboarding,
  setDislike,
  setLike,
  topGenreIds,
} from './tasteProfile';

const index = createCatalogIndex(DEMO_CATALOG);
const NOW = 1_800_000_000_000;

const answers: OnboardingAnswers = {
  genreIds: ['lofi'],
  moodIds: ['chill'],
  artistIds: ['paper-lanterns'],
  context: 'focus',
};

function track(id: string): Track {
  const found = index.tracksById.get(id);
  if (!found) throw new Error(`missing track ${id}`);
  return found;
}

function listen(trackId: string, partial: Partial<ListenEvent>): ListenEvent {
  return {
    trackId,
    startedAt: NOW,
    msPlayed: 0,
    durationMs: 200_000,
    completed: false,
    skipped: false,
    ...partial,
  };
}

describe('createProfileFromOnboarding', () => {
  it('seeds genre weights, artist affinity and a vibe near the chosen mood', () => {
    const profile = createProfileFromOnboarding(answers, DEMO_CATALOG, NOW);
    expect(profile.genreWeights['lofi']).toBe(1);
    expect(profile.artistAffinity['paper-lanterns']).toBe(1);
    expect(profile.vibe.energy).toBeLessThan(0.45);
    expect(profile.onboarding).toEqual(answers);
    expect(profile.createdAt).toBe(NOW);
  });

  it('gives half weight to genres implied by chosen artists', () => {
    const profile = createProfileFromOnboarding(
      { ...answers, genreIds: [], artistIds: ['komori-tapes'] },
      DEMO_CATALOG,
      NOW,
    );
    expect(profile.genreWeights['lofi']).toBe(0.5);
    expect(profile.genreWeights['jazz']).toBe(0.5);
  });

  it('nudges the vibe toward the listening context', () => {
    const focus = createProfileFromOnboarding(answers, DEMO_CATALOG, NOW);
    const anything = createProfileFromOnboarding(
      { ...answers, context: 'everything' },
      DEMO_CATALOG,
      NOW,
    );
    expect(focus.vibe.instrumentalness).toBeGreaterThan(anything.vibe.instrumentalness);
  });
});

describe('classifyListen', () => {
  it('treats completion or 30 s of play as positive', () => {
    expect(classifyListen(listen('t', { completed: true }))).toBe('positive');
    expect(classifyListen(listen('t', { msPlayed: 31_000 }))).toBe('positive');
  });

  it('treats an early skip as negative and the rest as neutral', () => {
    expect(classifyListen(listen('t', { skipped: true, msPlayed: 4_000 }))).toBe('negative');
    expect(classifyListen(listen('t', { skipped: true, msPlayed: 20_000 }))).toBe('neutral');
  });
});

describe('applyListen', () => {
  const profile = createEmptyProfile(NOW);
  const played = track('kessler-grid-1');

  it('moves the vibe toward a completed track and raises affinities', () => {
    const next = applyListen(profile, played, listen(played.id, { completed: true }), NOW + 1);
    expect(vibeSimilarity(next.vibe, played.vibe)).toBeGreaterThan(
      vibeSimilarity(profile.vibe, played.vibe),
    );
    expect(next.genreWeights['techno']).toBeGreaterThan(0);
    expect(next.artistAffinity['kessler-grid']).toBeGreaterThan(0);
    expect(next.listenCount).toBe(1);
    expect(next.updatedAt).toBe(NOW + 1);
  });

  it('moves the vibe away from an early skip', () => {
    const next = applyListen(
      profile,
      played,
      listen(played.id, { skipped: true, msPlayed: 3_000 }),
      NOW,
    );
    expect(vibeSimilarity(next.vibe, played.vibe)).toBeLessThan(
      vibeSimilarity(profile.vibe, played.vibe),
    );
  });

  it('leaves the vibe alone on a neutral listen but still counts it', () => {
    const next = applyListen(profile, played, listen(played.id, { msPlayed: 15_000 }), NOW);
    expect(next.vibe).toEqual(profile.vibe);
    expect(next.listenCount).toBe(1);
  });

  it('does not mutate its input', () => {
    const before = JSON.stringify(profile);
    applyListen(profile, played, listen(played.id, { completed: true }), NOW);
    expect(JSON.stringify(profile)).toBe(before);
  });
});

describe('likes and dislikes', () => {
  const profile = createEmptyProfile(NOW);
  const liked = track('imani-rowe-2');

  it('like adds the track once and pulls the vibe toward it', () => {
    const once = setLike(profile, liked, true, NOW);
    const twice = setLike(once, liked, true, NOW);
    expect(once.likedTrackIds).toEqual([liked.id]);
    expect(twice).toBe(once);
    expect(vibeSimilarity(once.vibe, liked.vibe)).toBeGreaterThan(
      vibeSimilarity(profile.vibe, liked.vibe),
    );
  });

  it('unlike removes the id without punishing the vibe', () => {
    const likedProfile = setLike(profile, liked, true, NOW);
    const unliked = setLike(likedProfile, liked, false, NOW);
    expect(unliked.likedTrackIds).toEqual([]);
    expect(unliked.vibe).toEqual(likedProfile.vibe);
  });

  it('dislike removes a like and pushes the vibe away', () => {
    const likedProfile = setLike(profile, liked, true, NOW);
    const disliked = setDislike(likedProfile, liked, true, NOW);
    expect(disliked.likedTrackIds).toEqual([]);
    expect(disliked.dislikedTrackIds).toEqual([liked.id]);
    expect(vibeSimilarity(disliked.vibe, liked.vibe)).toBeLessThan(
      vibeSimilarity(likedProfile.vibe, liked.vibe),
    );
  });
});

describe('applyFollowSignal and topGenreIds', () => {
  it('following an artist raises the artist and its genres', () => {
    const artist = index.artistsById.get('velvet-antlers');
    if (!artist) throw new Error('missing artist');
    const next = applyFollowSignal(createEmptyProfile(NOW), { kind: 'artist', artist }, NOW);
    expect(next.artistAffinity['velvet-antlers']).toBeCloseTo(0.3);
    expect(next.genreWeights['indie-rock']).toBeCloseTo(0.15);
    expect(next.genreWeights['folk']).toBeCloseTo(0.15);
  });

  it('orders genres by weight with a stable tie-break', () => {
    const profile = {
      ...createEmptyProfile(NOW),
      genreWeights: { pop: 0.2, jazz: 0.9, folk: 0.2 },
    };
    expect(topGenreIds(profile, 3)).toEqual(['jazz', 'folk', 'pop']);
  });
});

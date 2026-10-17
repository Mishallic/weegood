import { genreById } from '../catalog/genres';
import type { Artist, Genre, Id, ListenEvent, OnboardingAnswers } from '../domain/types';
import {
  blend,
  centroid,
  clamp01,
  isVibeVector,
  moveAway,
  NEUTRAL_VIBE,
  nudge,
  type VibeVector,
} from '../domain/vibe';
import { LISTENING_CONTEXTS, MOODS, type Mood } from './moods';
import {
  createRanker,
  normalizeRanker,
  trainRanker,
  type FeatureVector,
  type RankerModel,
} from './ranker';

/** The listener's taste. Everything the recommendation engine knows about them lives here. */
export interface TasteProfileV2 {
  version: 2;
  vibe: VibeVector;
  genreWeights: Record<Id, number>;
  /** 0..1 per provider mood label, e.g. "Melancholy". */
  moodWeights: Record<string, number>;
  artistAffinity: Record<Id, number>;
  likedTrackIds: Id[];
  dislikedTrackIds: Id[];
  onboarding: OnboardingAnswers | null;
  listenCount: number;
  /** Per-listener ranking model (ADR 0011). */
  ranker: RankerModel;
  createdAt: number;
  updatedAt: number;
}

/**
 * Learning rates. Tuned by hand for sessions of a few dozen plays. Kept in one place so tuning is a
 * one-line diff and tests can reference them.
 */
export const LEARNING = Object.freeze({
  completeRate: 0.08,
  partialRate: 0.04,
  skipRate: 0.03,
  likeRate: 0.15,
  dislikeRate: 0.1,
  genreStep: 0.06,
  moodStep: 0.06,
  artistStep: 0.1,
  /** Multiplicative forgetting applied to all affinities on each positive event. */
  decay: 0.985,
  minPlayedMsForSignal: 30_000,
  skipThresholdMs: 10_000,
  contextNudge: 0.15,
  followNudge: 0.05,
});

export type ListenSignal = 'positive' | 'negative' | 'neutral';

export function classifyListen(event: ListenEvent): ListenSignal {
  if (event.completed) return 'positive';
  if (event.msPlayed >= LEARNING.minPlayedMsForSignal) return 'positive';
  if (event.skipped && event.msPlayed < LEARNING.skipThresholdMs) return 'negative';
  return 'neutral';
}

export function createEmptyProfile(now: number): TasteProfileV2 {
  return {
    version: 2,
    vibe: NEUTRAL_VIBE,
    genreWeights: {},
    moodWeights: {},
    artistAffinity: {},
    likedTrackIds: [],
    dislikedTrackIds: [],
    onboarding: null,
    listenCount: 0,
    ranker: createRanker(),
    createdAt: now,
    updatedAt: now,
  };
}

export interface OnboardingReferences {
  /** The artists the listener picked, as full objects, so their vibe and genres can be used. */
  artists: readonly Artist[];
  moods?: readonly Mood[];
  genres?: readonly Genre[];
}

/** Seed a profile from the questionnaire (ADR 0009). */
export function createProfileFromOnboarding(
  answers: OnboardingAnswers,
  refs: OnboardingReferences,
  now: number,
): TasteProfileV2 {
  const moods = (refs.moods ?? MOODS).filter((mood) => answers.moodIds.includes(mood.id));
  const genres = answers.genreIds
    .map((id) => refs.genres?.find((genre) => genre.id === id) ?? genreById(id))
    .filter((genre) => genre !== undefined);
  const artists = refs.artists.filter((artist) => answers.artistIds.includes(artist.id));

  let vibe = centroid([
    ...moods.map((mood) => ({ vibe: mood.vibe, weight: 1 })),
    ...genres.map((genre) => ({ vibe: genre.vibe, weight: 0.7 })),
    ...artists.map((artist) => ({ vibe: artist.vibe, weight: 0.5 })),
  ]);
  const context = LISTENING_CONTEXTS.find((option) => option.id === answers.context);
  if (context) vibe = nudge(vibe, context.vibeNudge, LEARNING.contextNudge);

  const genreWeights: Record<Id, number> = {};
  for (const genre of genres) genreWeights[genre.id] = 1;
  for (const artist of artists) {
    for (const genreId of artist.genreIds)
      genreWeights[genreId] = Math.max(genreWeights[genreId] ?? 0, 0.5);
  }

  const moodWeights: Record<string, number> = {};
  for (const mood of moods) for (const label of mood.providerMoods) moodWeights[label] = 1;

  const artistAffinity: Record<Id, number> = {};
  for (const artist of artists) artistAffinity[artist.id] = 1;

  return {
    ...createEmptyProfile(now),
    vibe,
    genreWeights,
    moodWeights,
    artistAffinity,
    onboarding: {
      genreIds: [...answers.genreIds],
      moodIds: [...answers.moodIds],
      artistIds: [...answers.artistIds],
      context: answers.context,
    },
  };
}

export interface ListenLearning {
  /** Feature vector the track was scored with, so the ranker can learn from the outcome. */
  features?: FeatureVector;
}

/** Learn from one playback session. Pure: returns a new profile. */
export function applyListen(
  profile: TasteProfileV2,
  track: TrackLike,
  event: ListenEvent,
  now: number,
  learning: ListenLearning = {},
): TasteProfileV2 {
  const signal = classifyListen(event);
  const base = { ...profile, listenCount: profile.listenCount + 1, updatedAt: now };
  if (signal === 'neutral') return base;

  const ranker = learning.features
    ? trainRanker(profile.ranker, {
        features: learning.features,
        label: signal === 'positive' ? 1 : 0,
      })
    : profile.ranker;

  if (signal === 'positive') {
    const rate = event.completed ? LEARNING.completeRate : LEARNING.partialRate;
    return {
      ...base,
      vibe: blend(profile.vibe, track.vibe, rate),
      genreWeights: bump(decay(profile.genreWeights), track.genreIds, LEARNING.genreStep),
      moodWeights: bump(
        decay(profile.moodWeights),
        track.mood ? [track.mood] : [],
        LEARNING.moodStep,
      ),
      artistAffinity: bump(
        decay(profile.artistAffinity),
        track.artistId ? [track.artistId] : [],
        LEARNING.artistStep,
      ),
      ranker,
    };
  }

  return {
    ...base,
    vibe: moveAway(profile.vibe, track.vibe, LEARNING.skipRate),
    genreWeights: bump(profile.genreWeights, track.genreIds, -LEARNING.genreStep / 2),
    moodWeights: bump(profile.moodWeights, track.mood ? [track.mood] : [], -LEARNING.moodStep / 2),
    artistAffinity: bump(
      profile.artistAffinity,
      track.artistId ? [track.artistId] : [],
      -LEARNING.artistStep / 2,
    ),
    ranker,
  };
}

/** The slice of a track the profile cares about. */
export interface TrackLike {
  id: Id;
  artistId: Id | null;
  genreIds: readonly Id[];
  mood: string | null;
  vibe: VibeVector;
}

/** Like or unlike. Liking is a strong positive signal; unliking is not a negative one. */
export function setLike(
  profile: TasteProfileV2,
  track: TrackLike,
  liked: boolean,
  now: number,
): TasteProfileV2 {
  const has = profile.likedTrackIds.includes(track.id);
  if (liked === has) return profile;
  if (!liked) {
    return {
      ...profile,
      likedTrackIds: profile.likedTrackIds.filter((id) => id !== track.id),
      updatedAt: now,
    };
  }
  return {
    ...profile,
    vibe: blend(profile.vibe, track.vibe, LEARNING.likeRate),
    genreWeights: bump(profile.genreWeights, track.genreIds, LEARNING.genreStep * 1.5),
    moodWeights: bump(profile.moodWeights, track.mood ? [track.mood] : [], LEARNING.moodStep * 1.5),
    artistAffinity: bump(
      profile.artistAffinity,
      track.artistId ? [track.artistId] : [],
      LEARNING.artistStep * 1.5,
    ),
    likedTrackIds: [...profile.likedTrackIds, track.id],
    dislikedTrackIds: profile.dislikedTrackIds.filter((id) => id !== track.id),
    updatedAt: now,
  };
}

/** "Not for me." Strong negative signal; also removes a like if present. */
export function setDislike(
  profile: TasteProfileV2,
  track: TrackLike,
  disliked: boolean,
  now: number,
): TasteProfileV2 {
  const has = profile.dislikedTrackIds.includes(track.id);
  if (disliked === has) return profile;
  if (!disliked) {
    return {
      ...profile,
      dislikedTrackIds: profile.dislikedTrackIds.filter((id) => id !== track.id),
      updatedAt: now,
    };
  }
  return {
    ...profile,
    vibe: moveAway(profile.vibe, track.vibe, LEARNING.dislikeRate),
    genreWeights: bump(profile.genreWeights, track.genreIds, -LEARNING.genreStep),
    moodWeights: bump(profile.moodWeights, track.mood ? [track.mood] : [], -LEARNING.moodStep),
    artistAffinity: bump(
      profile.artistAffinity,
      track.artistId ? [track.artistId] : [],
      -LEARNING.artistStep,
    ),
    likedTrackIds: profile.likedTrackIds.filter((id) => id !== track.id),
    dislikedTrackIds: [...profile.dislikedTrackIds, track.id],
    updatedAt: now,
  };
}

export type FollowTarget = { kind: 'artist'; artist: Artist } | { kind: 'genre'; genre: Genre };

/** Following is an explicit statement of taste, so it moves the profile a little. */
export function applyFollowSignal(
  profile: TasteProfileV2,
  target: FollowTarget,
  now: number,
): TasteProfileV2 {
  if (target.kind === 'artist') {
    return {
      ...profile,
      vibe: blend(profile.vibe, target.artist.vibe, LEARNING.followNudge),
      artistAffinity: bump(profile.artistAffinity, [target.artist.id], 0.3),
      genreWeights: bump(profile.genreWeights, target.artist.genreIds, 0.15),
      updatedAt: now,
    };
  }
  return {
    ...profile,
    vibe: blend(profile.vibe, target.genre.vibe, LEARNING.followNudge),
    genreWeights: bump(profile.genreWeights, [target.genre.id], 0.3),
    updatedAt: now,
  };
}

/** Genre ids by descending weight. */
export function topGenreIds(profile: Pick<TasteProfileV2, 'genreWeights'>, limit = 3): Id[] {
  return topKeys(profile.genreWeights, limit);
}

/** Provider mood labels by descending weight. */
export function topMoods(profile: Pick<TasteProfileV2, 'moodWeights'>, limit = 3): string[] {
  return topKeys(profile.moodWeights, limit);
}

/**
 * Accept any persisted profile (including version 1 from before moods and the ranker existed) and
 * return a valid current one, or null when it is beyond repair.
 */
export function normalizeProfile(raw: unknown, now: number): TasteProfileV2 | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (!isVibeVector(record['vibe'])) return null;
  const fresh = createEmptyProfile(now);
  return {
    version: 2,
    vibe: record['vibe'],
    genreWeights: numberRecord(record['genreWeights']),
    moodWeights: numberRecord(record['moodWeights']),
    artistAffinity: numberRecord(record['artistAffinity']),
    likedTrackIds: stringList(record['likedTrackIds']),
    dislikedTrackIds: stringList(record['dislikedTrackIds']),
    onboarding: isOnboarding(record['onboarding']) ? record['onboarding'] : null,
    listenCount: typeof record['listenCount'] === 'number' ? Math.max(0, record['listenCount']) : 0,
    ranker: normalizeRanker(record['ranker']),
    createdAt: typeof record['createdAt'] === 'number' ? record['createdAt'] : fresh.createdAt,
    updatedAt: typeof record['updatedAt'] === 'number' ? record['updatedAt'] : fresh.updatedAt,
  };
}

/* ------------------------------------------------------------------------------------------- */

function topKeys(weights: Record<string, number>, limit: number): string[] {
  return Object.entries(weights)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key]) => key);
}

function bump(
  weights: Record<string, number>,
  keys: readonly string[],
  delta: number,
): Record<string, number> {
  if (keys.length === 0 || delta === 0) return weights;
  const out = { ...weights };
  for (const key of keys) {
    const next = clamp01((out[key] ?? 0) + delta);
    if (next <= 0) delete out[key];
    else out[key] = next;
  }
  return out;
}

function decay(weights: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(weights)) {
    const next = value * LEARNING.decay;
    if (next > 0.01) out[key] = next;
  }
  return out;
}

function numberRecord(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null) return {};
  const out: Record<string, number> = {};
  for (const [key, n] of Object.entries(value as Record<string, unknown>)) {
    if (typeof n === 'number' && Number.isFinite(n)) out[key] = clamp01(n);
  }
  return out;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function isOnboarding(value: unknown): value is OnboardingAnswers {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record['genreIds']) &&
    Array.isArray(record['moodIds']) &&
    Array.isArray(record['artistIds'])
  );
}

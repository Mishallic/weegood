import type {
  Artist,
  Genre,
  Id,
  ListenEvent,
  OnboardingAnswers,
  TasteProfile,
  Track,
} from '../domain/types';
import { blend, centroid, clamp01, moveAway, NEUTRAL_VIBE, nudge } from '../domain/vibe';
import { LISTENING_CONTEXTS, MOODS, type Mood } from './moods';

/**
 * Learning rates. Tuned by hand for a catalog of ~100 tracks and sessions of a few dozen plays.
 * Kept in one place so tuning is a one-line diff and tests can reference them.
 */
export const LEARNING = Object.freeze({
  /** Pull toward a track that played to the end. */
  completeRate: 0.08,
  /** Pull toward a track that played at least `minPlayedMsForSignal` but did not finish. */
  partialRate: 0.04,
  /** Push away from a track skipped within `skipThresholdMs`. */
  skipRate: 0.03,
  likeRate: 0.15,
  dislikeRate: 0.1,
  genreStep: 0.06,
  artistStep: 0.1,
  /** Multiplicative forgetting applied to all affinities on each positive event. */
  decay: 0.985,
  minPlayedMsForSignal: 30_000,
  skipThresholdMs: 10_000,
  /** How much a listening context bends the onboarding vibe. */
  contextNudge: 0.15,
  /** How much following an artist or genre bends the vibe. */
  followNudge: 0.05,
});

export type ListenSignal = 'positive' | 'negative' | 'neutral';

/** What a listen tells us. Short skips are negative, long plays are positive, the rest is noise. */
export function classifyListen(event: ListenEvent): ListenSignal {
  if (event.completed) return 'positive';
  if (event.msPlayed >= LEARNING.minPlayedMsForSignal) return 'positive';
  if (event.skipped && event.msPlayed < LEARNING.skipThresholdMs) return 'negative';
  return 'neutral';
}

export function createEmptyProfile(now: number): TasteProfile {
  return {
    version: 1,
    vibe: NEUTRAL_VIBE,
    genreWeights: {},
    artistAffinity: {},
    likedTrackIds: [],
    dislikedTrackIds: [],
    onboarding: null,
    listenCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export interface OnboardingReferences {
  genres: readonly Genre[];
  artists: readonly Artist[];
  moods?: readonly Mood[];
}

/**
 * Seed a profile from the questionnaire (ADR 0009). Moods weigh most because they are the most
 * direct statement of taste; genres and artists refine. The listening context is a gentle nudge.
 */
export function createProfileFromOnboarding(
  answers: OnboardingAnswers,
  refs: OnboardingReferences,
  now: number,
): TasteProfile {
  const moods = (refs.moods ?? MOODS).filter((mood) => answers.moodIds.includes(mood.id));
  const genres = refs.genres.filter((genre) => answers.genreIds.includes(genre.id));
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
    for (const genreId of artist.genreIds) {
      genreWeights[genreId] = Math.max(genreWeights[genreId] ?? 0, 0.5);
    }
  }

  const artistAffinity: Record<Id, number> = {};
  for (const artist of artists) artistAffinity[artist.id] = 1;

  return {
    ...createEmptyProfile(now),
    vibe,
    genreWeights,
    artistAffinity,
    onboarding: {
      genreIds: [...answers.genreIds],
      moodIds: [...answers.moodIds],
      artistIds: [...answers.artistIds],
      context: answers.context,
    },
  };
}

/** Learn from one playback session. Pure: returns a new profile. */
export function applyListen(
  profile: TasteProfile,
  track: Track,
  event: ListenEvent,
  now: number,
): TasteProfile {
  const signal = classifyListen(event);
  const base = { ...profile, listenCount: profile.listenCount + 1, updatedAt: now };

  if (signal === 'neutral') return base;

  if (signal === 'positive') {
    const rate = event.completed ? LEARNING.completeRate : LEARNING.partialRate;
    return {
      ...base,
      vibe: blend(profile.vibe, track.vibe, rate),
      genreWeights: bump(decay(profile.genreWeights), track.genreIds, LEARNING.genreStep),
      artistAffinity: bump(
        decay(profile.artistAffinity),
        track.artistId ? [track.artistId] : [],
        LEARNING.artistStep,
      ),
    };
  }

  return {
    ...base,
    vibe: moveAway(profile.vibe, track.vibe, LEARNING.skipRate),
    genreWeights: bump(profile.genreWeights, track.genreIds, -LEARNING.genreStep / 2),
    artistAffinity: bump(
      profile.artistAffinity,
      track.artistId ? [track.artistId] : [],
      -LEARNING.artistStep / 2,
    ),
  };
}

/** Like or unlike. Liking is a strong positive signal; unliking is not a negative one. */
export function setLike(
  profile: TasteProfile,
  track: Track,
  liked: boolean,
  now: number,
): TasteProfile {
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
  profile: TasteProfile,
  track: Track,
  disliked: boolean,
  now: number,
): TasteProfile {
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
  profile: TasteProfile,
  target: FollowTarget,
  now: number,
): TasteProfile {
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
export function topGenreIds(profile: TasteProfile, limit = 3): Id[] {
  return Object.entries(profile.genreWeights)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id]) => id);
}

function bump(weights: Record<Id, number>, ids: readonly Id[], delta: number): Record<Id, number> {
  if (ids.length === 0 || delta === 0) return weights;
  const out = { ...weights };
  for (const id of ids) {
    const next = clamp01((out[id] ?? 0) + delta);
    if (next <= 0) delete out[id];
    else out[id] = next;
  }
  return out;
}

function decay(weights: Record<Id, number>): Record<Id, number> {
  const out: Record<Id, number> = {};
  for (const [id, value] of Object.entries(weights)) {
    const next = value * LEARNING.decay;
    if (next > 0.01) out[id] = next;
  }
  return out;
}

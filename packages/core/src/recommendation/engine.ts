import { genreById } from '../catalog/genres';
import type {
  Artist,
  ArtistRecommendation,
  Follow,
  Id,
  ListenEvent,
  Recommendation,
  Track,
} from '../domain/types';
import { describeVibe, vibeSimilarity } from '../domain/vibe';
import { followedIds } from '../social/follow';
import {
  contributions,
  emptyFeatures,
  scoreFeatures,
  type FeatureVector,
  type RankFeature,
} from './ranker';
import type { TasteProfileV2 } from './tasteProfile';

/** Something a person the listener follows did with a track: put it on a playlist, reposted or loved it. */
export interface PeopleSignal {
  user: Artist;
  kind: 'playlist' | 'repost' | 'favorite';
  playlistName: string | null;
  trackIds: readonly Id[];
}

/** Everything the engine needs to know about the listener and the world. All read-only. */
export interface RecommendationInput {
  profile: TasteProfileV2;
  /** Candidate pool. The caller decides what is in it. */
  tracks: readonly Track[];
  artistsById: ReadonlyMap<Id, Artist>;
  follows: readonly Follow[];
  recentListens: readonly ListenEvent[];
  peopleSignals?: readonly PeopleSignal[];
  now: number;
}

export interface RecommendOptions {
  /** Default 10. */
  limit?: number;
  /** 0 = pure relevance, 1 = pure variety. Default 0.3. */
  diversity?: number;
  /** Default 2. */
  maxPerArtist?: number;
  excludeTrackIds?: ReadonlySet<Id>;
  /** Drop anything the listener has played before. For "fresh" rows. */
  excludeListened?: boolean;
  /** Keep liked tracks in (they are excluded from discovery rows by default). */
  includeLiked?: boolean;
  /** Rank by closeness to this track instead of to the profile. For "more like this". */
  seed?: Track;
}

/** How seed mode blends closeness to the seed with the personal score. */
export const SEED_BLEND = Object.freeze({ seedVibe: 0.65, seedGenre: 0.15, profile: 0.2 });

const DAY_MS = 86_400_000;
const DIVERSIFY_POOL = 200;

export function recommendTracks(
  input: RecommendationInput,
  options: RecommendOptions = {},
): Recommendation[] {
  const limit = options.limit ?? 10;
  if (limit <= 0) return [];
  const context = prepare(input, options);

  const scored: Recommendation[] = [];
  for (const track of input.tracks) {
    const result = scoreTrack(track, input, options, context);
    if (result) scored.push(result);
  }
  scored.sort(byScoreThenId);
  return diversify(scored.slice(0, DIVERSIFY_POOL), {
    limit,
    diversity: options.diversity ?? 0.3,
    maxPerArtist: options.maxPerArtist ?? 2,
  });
}

/** Every candidate in personal order, nothing excluded. For genre and artist pages. */
export function rankAll(input: RecommendationInput): Recommendation[] {
  return recommendTracks(input, {
    limit: input.tracks.length,
    diversity: 0,
    maxPerArtist: Number.MAX_SAFE_INTEGER,
    includeLiked: true,
  });
}

/** "More like this": tracks closest to `seed`, lightly personalised. */
export function similarTracks(
  seed: Track,
  input: RecommendationInput,
  limit = 8,
): Recommendation[] {
  return recommendTracks(input, {
    seed,
    limit,
    diversity: 0.15,
    excludeTrackIds: new Set<Id>([seed.id]),
  });
}

/** The feature vector a track would be scored with right now. Stored with listens so the ranker can learn. */
export function featuresForTrack(track: Track, input: RecommendationInput): FeatureVector {
  return computeFeatures(track, input, prepare(input, {}));
}

/** Artists worth following, excluding ones already followed. */
export function recommendArtists(
  input: RecommendationInput,
  artists: readonly Artist[],
  limit = 6,
): ArtistRecommendation[] {
  const followedArtists = followedIds(input.follows, 'artist');
  const followedGenres = followedIds(input.follows, 'genre');
  const profile = input.profile;
  const profileWords = describeVibe(profile.vibe);

  const scored: ArtistRecommendation[] = [];
  for (const artist of artists) {
    if (followedArtists.has(artist.id)) continue;
    const vibeMatch = vibeSimilarity(profile.vibe, artist.vibe);
    const genreAffinity = maxWeight(profile.genreWeights, artist.genreIds);
    const genreFollowed = artist.genreIds.some((id) => followedGenres.has(id));
    const affinity = profile.artistAffinity[artist.id] ?? 0;
    const popularity = Math.min(1, Math.log10(1 + artist.followerCount) / 6);
    const score = clamp(
      0.45 * vibeMatch +
        0.25 * genreAffinity +
        0.1 * affinity +
        0.1 * popularity +
        (genreFollowed ? 0.1 : 0),
    );

    const reasons: Array<[number, string]> = [];
    if (affinity >= 0.5) reasons.push([3, `You already like ${artist.name}`]);
    const followedGenre = artist.genreIds
      .map(genreById)
      .find((genre) => genre && followedGenres.has(genre.id));
    if (followedGenre) reasons.push([2.5, `Because you follow ${followedGenre.name}`]);
    if (genreAffinity >= 0.6) {
      const genre = strongestGenre(profile, artist.genreIds);
      if (genre) reasons.push([2, `You're into ${genre.name}`]);
    }
    if (vibeMatch >= 0.75) reasons.push([1, `Shares your ${profileWords.join(', ')} vibe`]);
    if (popularity >= 0.6) reasons.push([0.8, `Big on Audius`]);
    scored.push({ artist, score, reasons: finalizeReasons(reasons, artist.vibe) });
  }
  scored.sort((a, b) => b.score - a.score || a.artist.id.localeCompare(b.artist.id));
  return scored.slice(0, limit);
}

/* ---------------------------------------------------------------------------------------------
 * Internals
 * ------------------------------------------------------------------------------------------ */

interface ListenMemory {
  lastAt: number;
  skippedLast: boolean;
}

interface ScoringContext {
  followedArtists: ReadonlySet<Id>;
  followedGenres: ReadonlySet<Id>;
  listens: ReadonlyMap<Id, ListenMemory>;
  people: ReadonlyMap<Id, PeopleSignal>;
  liked: ReadonlySet<Id>;
  disliked: ReadonlySet<Id>;
  profileWords: string[];
}

function prepare(input: RecommendationInput, options: RecommendOptions): ScoringContext {
  const listens = new Map<Id, ListenMemory>();
  for (const event of input.recentListens) {
    const existing = listens.get(event.trackId);
    if (!existing || event.startedAt > existing.lastAt) {
      listens.set(event.trackId, { lastAt: event.startedAt, skippedLast: event.skipped });
    }
  }
  const people = new Map<Id, PeopleSignal>();
  for (const signal of input.peopleSignals ?? []) {
    for (const trackId of signal.trackIds) if (!people.has(trackId)) people.set(trackId, signal);
  }
  return {
    followedArtists: followedIds(input.follows, 'artist'),
    followedGenres: followedIds(input.follows, 'genre'),
    listens,
    people,
    liked: new Set(input.profile.likedTrackIds),
    disliked: new Set(input.profile.dislikedTrackIds),
    profileWords: describeVibe(options.seed ? options.seed.vibe : input.profile.vibe),
  };
}

/** Similarity is compressed toward 1 in practice; stretch 0.5..1 onto 0..1 so the model can see differences. */
function contrast(similarity: number): number {
  return clamp((similarity - 0.5) / 0.5);
}

function computeFeatures(
  track: Track,
  input: RecommendationInput,
  ctx: ScoringContext,
): FeatureVector {
  const profile = input.profile;
  const features = emptyFeatures();
  features.vibe = contrast(vibeSimilarity(profile.vibe, track.vibe));
  features.genre = maxWeight(profile.genreWeights, track.genreIds);
  features.mood = track.mood ? (profile.moodWeights[track.mood] ?? 0) : 0;
  features.artist = track.artistId ? (profile.artistAffinity[track.artistId] ?? 0) : 0;
  features.popularity = clamp(track.popularity);
  features.followArtist = track.artistId && ctx.followedArtists.has(track.artistId) ? 1 : 0;
  features.followGenre = track.genreIds.some((id) => ctx.followedGenres.has(id)) ? 1 : 0;
  features.people = ctx.people.has(track.id) ? 1 : 0;

  const memory = ctx.listens.get(track.id);
  features.novelty = memory ? 0 : 1;
  if (memory) {
    const age = input.now - memory.lastAt;
    features.playedRecently = age < DAY_MS ? 1 : age < 7 * DAY_MS ? 0.5 : 0;
    features.skippedRecently = memory.skippedLast && age < 7 * DAY_MS ? 1 : 0;
  }
  return features;
}

function scoreTrack(
  track: Track,
  input: RecommendationInput,
  options: RecommendOptions,
  ctx: ScoringContext,
): Recommendation | null {
  if (options.excludeTrackIds?.has(track.id)) return null;
  if (ctx.disliked.has(track.id)) return null;
  if (!options.includeLiked && ctx.liked.has(track.id)) return null;
  if (options.excludeListened && ctx.listens.has(track.id)) return null;

  const features = computeFeatures(track, input, ctx);
  let score = scoreFeatures(input.profile.ranker, features);
  const reasons: Array<[number, string]> = [];

  if (options.seed) {
    const seedSim = contrast(vibeSimilarity(options.seed.vibe, track.vibe));
    const sharesGenre = track.genreIds.some((id) => options.seed?.genreIds.includes(id)) ? 1 : 0;
    score =
      SEED_BLEND.seedVibe * seedSim +
      SEED_BLEND.seedGenre * sharesGenre +
      SEED_BLEND.profile * score;
    reasons.push([10, `Similar to "${options.seed.title}"`]);
  }

  for (const { feature, value } of contributions(input.profile.ranker, features)) {
    if (value < 0.2) break;
    const text = reasonFor(feature, features, track, input, ctx, Boolean(options.seed));
    if (text) reasons.push([value, text]);
  }

  return { track, score: clamp(score), reasons: finalizeReasons(reasons, track.vibe) };
}

function reasonFor(
  feature: RankFeature,
  features: FeatureVector,
  track: Track,
  input: RecommendationInput,
  ctx: ScoringContext,
  seeded: boolean,
): string | null {
  const artist = track.artistId ? input.artistsById.get(track.artistId) : undefined;
  const artistName = artist?.name ?? track.artistName;
  switch (feature) {
    case 'vibe':
      return seeded || features.vibe < 0.5
        ? null
        : `Matches your ${ctx.profileWords.join(', ')} vibe`;
    case 'genre': {
      const genre = strongestGenre(input.profile, track.genreIds);
      return genre ? `You're into ${genre.name}` : null;
    }
    case 'mood':
      return track.mood ? `Fits your ${track.mood.toLowerCase()} mood` : null;
    case 'artist':
      return features.artist >= 0.5 ? `You like ${artistName}` : null;
    case 'popularity': {
      if (features.popularity < 0.6) return null;
      const genre = genreById(track.genreIds[0] ?? '');
      return genre ? `Trending in ${genre.name}` : 'Trending right now';
    }
    case 'followArtist':
      return `Because you follow ${artistName}`;
    case 'followGenre': {
      const genre = track.genreIds.map(genreById).find((g) => g && ctx.followedGenres.has(g.id));
      return genre ? `Because you follow ${genre.name}` : null;
    }
    case 'people': {
      const signal = ctx.people.get(track.id);
      if (!signal) return null;
      if (signal.kind === 'repost') return `Reposted by ${signal.user.name}`;
      if (signal.kind === 'favorite') return `Loved by ${signal.user.name}`;
      return `On ${signal.user.name}'s playlist "${signal.playlistName ?? 'untitled'}"`;
    }
    case 'novelty':
      return 'New to you';
    default:
      return null;
  }
}

interface DiversifyOptions {
  limit: number;
  diversity: number;
  maxPerArtist: number;
}

/**
 * Maximal marginal relevance: each pick balances its own score against its similarity to what is
 * already picked, so a row is not twelve near-identical tracks. Also caps tracks per artist.
 */
function diversify(scored: Recommendation[], opts: DiversifyOptions): Recommendation[] {
  const diversity = clamp(opts.diversity);
  const pool = [...scored];
  const selected: Recommendation[] = [];
  const perArtist = new Map<string, number>();

  while (selected.length < opts.limit && pool.length > 0) {
    let bestIndex = -1;
    let bestValue = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i] as Recommendation;
      const artistKey = candidate.track.artistId ?? `name:${candidate.track.artistName}`;
      if ((perArtist.get(artistKey) ?? 0) >= opts.maxPerArtist) continue;
      let maxSimilarity = 0;
      if (diversity > 0) {
        for (const chosen of selected) {
          const s = vibeSimilarity(chosen.track.vibe, candidate.track.vibe);
          if (s > maxSimilarity) maxSimilarity = s;
        }
      }
      const value = (1 - diversity) * candidate.score - diversity * maxSimilarity;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = i;
      }
    }
    if (bestIndex < 0) break;
    const [chosen] = pool.splice(bestIndex, 1) as [Recommendation];
    selected.push(chosen);
    const key = chosen.track.artistId ?? `name:${chosen.track.artistName}`;
    perArtist.set(key, (perArtist.get(key) ?? 0) + 1);
  }
  return selected;
}

function finalizeReasons(reasons: Array<[number, string]>, fallbackVibe: Track['vibe']): string[] {
  const unique = new Set<string>();
  for (const [, text] of [...reasons].sort((a, b) => b[0] - a[0])) unique.add(text);
  const out = [...unique].filter((text) => text !== 'New to you').slice(0, 2);
  if (out.length === 0) {
    if (unique.has('New to you')) return ['New to you'];
    const [word] = describeVibe(fallbackVibe, 1);
    out.push(`A ${word ?? 'balanced'} pick to explore`);
  }
  return out;
}

function strongestGenre(profile: Pick<TasteProfileV2, 'genreWeights'>, genreIds: readonly Id[]) {
  let best = undefined as ReturnType<typeof genreById>;
  let bestWeight = 0;
  for (const id of genreIds) {
    const weight = profile.genreWeights[id] ?? 0;
    const genre = genreById(id);
    if (genre && weight > bestWeight) {
      best = genre;
      bestWeight = weight;
    }
  }
  return best;
}

function maxWeight(weights: Record<string, number>, keys: readonly string[]): number {
  let max = 0;
  for (const key of keys) {
    const w = weights[key] ?? 0;
    if (w > max) max = w;
  }
  return max;
}

function clamp(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function byScoreThenId(a: Recommendation, b: Recommendation): number {
  return b.score - a.score || a.track.id.localeCompare(b.track.id);
}
